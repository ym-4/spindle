const http = require('http');
const WebSocket = require('ws');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');
const { attachWebSocket } = require('../../src/realtime/wsHub');

let server;
let hub;

beforeAll(async () => {
  server = http.createServer(app);
  hub = attachWebSocket(server);
  await new Promise((resolve) => server.listen(0, resolve));
});

beforeEach(async () => {
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
});

afterAll(async () => {
  const wss = hub && hub.wss;
  if (wss && Array.isArray(Array.from(wss.clients))) {
    Array.from(wss.clients).forEach((c) => c && c.terminate && c.terminate());
  }
  await new Promise((resolve) => {
    server.close(resolve);
    setTimeout(resolve, 1000);
  });
  await pool.end();
});

const port = () => server.address().port;

async function registerAndVerify(name, email, password = 'secret1') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function becomeFriends(alice, bob) {
  await request(app)
    .post('/friends/request')
    .set('Authorization', `Bearer ${alice.token}`)
    .send({ receiver_id: bob.user.id });
  const received = await request(app)
    .get('/friends/requests?tab=received')
    .set('Authorization', `Bearer ${bob.token}`);
  await request(app)
    .post('/friends/accept')
    .set('Authorization', `Bearer ${bob.token}`)
    .send({ request_id: received.body.requests[0].request_id });
}

function connect(token, { timeout = 3000 } = {}) {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`ws://127.0.0.1:${port()}/ws?token=${token}`);
    const buffer = [];
    const waiters = [];
    ws.on('message', (raw) => {
      const parsed = parse(raw);
      const hit = waiters.findIndex((w) => w.pred(parsed));
      if (hit >= 0) {
        const [waiter] = waiters.splice(hit, 1);
        clearTimeout(waiter.timer);
        waiter.resolve(parsed);
      } else {
        buffer.push(parsed);
      }
    });
    ws.__next = (predicate = () => true, opt = {}) =>
      new Promise((res, rej) => {
        const idx = buffer.findIndex(predicate);
        if (idx >= 0) {
          const [found] = buffer.splice(idx, 1);
          res(found);
          return;
        }
        const timer = setTimeout(() => rej(new Error('ws message timeout')), opt.timeout || 3000);
        waiters.push({ pred: predicate, resolve: res, timer });
      });
    const timer = setTimeout(() => reject(new Error('ws connect timeout')), timeout);
    ws.on('open', () => {
      clearTimeout(timer);
      resolve(ws);
    });
    ws.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
  });
}

const parse = (raw) => JSON.parse(raw.toString());

describe('WebSocket wsHub', () => {
  test('rejects connections with invalid token (closes 4001)', async () => {
    const ws = new WebSocket(`ws://127.0.0.1:${port()}/ws?token=bad-token`);
    const closed = await new Promise((resolve) => {
      ws.on('close', (code, reason) => resolve({ code, reason }));
      ws.on('error', () => {});
    });
    expect(closed.code).toBe(4001);
  });

  test('connects, receives connected + pong', async () => {
    const alice = await registerAndVerify('ws1@test.com', 'ws1@test.com');
    const ws = await connect(alice.token);
    const connected = await ws.__next((m) => m.type === 'connected');
    expect(connected.userId).toBe(alice.user.id);

    ws.send(JSON.stringify({ type: 'ping' }));
    const pong = await ws.__next((m) => m.type === 'pong');
    expect(pong).toEqual({ type: 'pong' });
    ws.close();
  });

  test('sends message to friends over the socket', async () => {
    const alice = await registerAndVerify('ws2@test.com', 'ws2@test.com');
    const bob = await registerAndVerify('ws3@test.com', 'ws3@test.com');
    await becomeFriends(alice, bob);

    const a = await connect(alice.token);
    const b = await connect(bob.token);
    await b.__next((m) => m.type === 'connected');

    const bobGot = b.__next((m) => m.type === 'message');
    a.send(JSON.stringify({ type: 'message', recipientId: bob.user.id, body: 'hey bob' }));
    const received = await bobGot;
    expect(received.message.body).toBe('hey bob');

    const aliceGot = a.__next((m) => m.type === 'message' && m.message.body === 'gossip');
    a.send(JSON.stringify({ type: 'message', recipientId: bob.user.id, body: '  gossip  ' }));
    const echoed = await aliceGot;
    expect(echoed.message.body).toBe('gossip');
    a.close();
    b.close();
  });

  test('rejects messaging non-friends', async () => {
    const alice = await registerAndVerify('ws4@test.com', 'ws4@test.com');
    const bob = await registerAndVerify('ws5@test.com', 'ws5@test.com');
    const a = await connect(alice.token);

    const errorGot = a.__next((m) => m.type === 'error');
    a.send(JSON.stringify({ type: 'message', recipientId: bob.user.id, body: 'hello' }));
    const err = await errorGot;
    expect(err.error).toContain('friends');
    a.close();
  });

  test('call:invite relayed to friend and rejected for strangers', async () => {
    const alice = await registerAndVerify('ws6@test.com', 'ws6@test.com');
    const bob = await registerAndVerify('ws7@test.com', 'ws7@test.com');
    await becomeFriends(alice, bob);

    const a = await connect(alice.token);
    const b = await connect(bob.token);
    await b.__next((m) => m.type === 'connected');

    const invite = b.__next((m) => m.type === 'call:invite');
    a.send(
      JSON.stringify({
        type: 'call:invite',
        toUserId: bob.user.id,
        callId: 'c1',
        callType: 'video',
      }),
    );
    const inv = await invite;
    expect(inv.fromUserId).toBe(alice.user.id);
    expect(inv.callId).toBe('c1');
    expect(inv.callType).toBe('video');
    a.close();
    b.close();

    const carol = await registerAndVerify('ws8@test.com', 'ws8@test.com');
    const c = await connect(carol.token);
    const errorGot = c.__next((m) => m.type === 'error');
    c.send(JSON.stringify({ type: 'call:invite', toUserId: bob.user.id, callId: 'c2' }));
    const err = await errorGot;
    expect(err.error).toContain('call friends');
    c.close();
  });

  test('call signals relayed', async () => {
    const alice = await registerAndVerify('ws9@test.com', 'ws9@test.com');
    const bob = await registerAndVerify('ws10@test.com', 'ws10@test.com');
    await becomeFriends(alice, bob);
    const a = await connect(alice.token);
    const b = await connect(bob.token);
    await b.__next((m) => m.type === 'connected');

    const signal = b.__next((m) => m.type === 'call:signal');
    a.send(
      JSON.stringify({
        type: 'call:signal',
        toUserId: bob.user.id,
        signal: 'SDP',
        callType: 'voice',
        callId: 'c3',
      }),
    );
    const s = await signal;
    expect(s.signal).toBe('SDP');
    expect(s.callType).toBe('voice');
    a.close();
    b.close();
  });

  test('invalid JSON triggers error message', async () => {
    const alice = await registerAndVerify('ws11@test.com', 'ws11@test.com');
    const a = await connect(alice.token);
    const errGot = a.__next((m) => m.type === 'error');
    a.send('{not json');
    const err = await errGot;
    expect(err).toHaveProperty('error');
    a.close();
  });

  test('sessions: task_added and screenshare broadcast to participants', async () => {
    const host = await registerAndVerify('wshost@test.com', 'wshost@test.com');
    const member = await registerAndVerify('wsmem@test.com', 'wsmem@test.com');
    await becomeFriends(host, member);

    const session = await pool.query(
      `INSERT INTO "StudySessions" ("host_id", "title", "scheduled_at", "status")
       VALUES ($1, 'Study', NOW(), 'in_progress') RETURNING id`,
      [host.user.id],
    );
    await pool.query(
      `INSERT INTO "SessionParticipants" ("session_id", "user_id", "status")
       VALUES ($1, $2, 'accepted'), ($1, $3, 'accepted')`,
      [session.rows[0].id, host.user.id, member.user.id],
    );

    const h = await connect(host.token);
    const m = await connect(member.token);
    await m.__next((x) => x.type === 'connected');

    const gotTask = m.__next((x) => x.type === 'session:task_added');
    h.send(
      JSON.stringify({
        type: 'session:task_added',
        sessionId: session.rows[0].id,
        task: { text: 'revise' },
      }),
    );
    const task = await gotTask;
    expect(task.task.text).toBe('revise');

    const gotShare = m.__next((x) => x.type === 'session:screenshare_started');
    h.send(JSON.stringify({ type: 'session:screenshare_started', sessionId: session.rows[0].id }));
    const share = await gotShare;
    expect(share.fromUserId).toBe(host.user.id);

    const gotSignal = m.__next((x) => x.type === 'session:call_signal');
    h.send(
      JSON.stringify({
        type: 'session:call_signal',
        sessionId: session.rows[0].id,
        signal: 'sdp',
        callType: 'video',
      }),
    );
    const callSig = await gotSignal;
    expect(callSig.signal).toBe('sdp');
    h.close();
    m.close();
  });

  test('session events for missing session still respond without crash', async () => {
    const alice = await registerAndVerify('ws12@test.com', 'ws12@test.com');
    const a = await connect(alice.token);
    a.send(JSON.stringify({ type: 'session:task_added', sessionId: 999999, task: { text: 'x' } }));
    a.send(
      JSON.stringify({ type: 'session:task_toggled', sessionId: 999999, task: { text: 'x' } }),
    );
    a.send(JSON.stringify({ type: 'session:screenshare_stopped', sessionId: 999999 }));
    await new Promise((r) => setTimeout(r, 300));
    expect(a.readyState).toBe(WebSocket.OPEN);
    a.close();
  });

  test('typing and friend:refresh relays', async () => {
    const alice = await registerAndVerify('ws13@test.com', 'ws13@test.com');
    const bob = await registerAndVerify('ws14@test.com', 'ws14@test.com');
    await becomeFriends(alice, bob);
    const a = await connect(alice.token);
    const b = await connect(bob.token);
    await b.__next((x) => x.type === 'connected');

    const typing = b.__next((x) => x.type === 'typing');
    a.send(JSON.stringify({ type: 'typing', toUserId: bob.user.id }));
    expect((await typing).fromUserId).toBe(alice.user.id);

    const refresh = b.__next((x) => x.type === 'friend:refresh');
    a.send(JSON.stringify({ type: 'friend:refresh', toUserId: bob.user.id }));
    expect(await refresh).toEqual({ type: 'friend:refresh' });

    const end = b.__next((x) => x.type === 'call:end');
    a.send(JSON.stringify({ type: 'call:end', toUserId: bob.user.id, callId: 'c9' }));
    expect((await end).callId).toBe('c9');
    a.close();
    b.close();
  });
});
