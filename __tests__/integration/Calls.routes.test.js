const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

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
  await pool.end();
});

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

describe('Calls — logs', () => {
  test('succeeds when logged as friends', async () => {
    const alice = await registerAndVerify('cf1@test.com', 'cf1@test.com');
    const bob = await registerAndVerify('cf2@test.com', 'cf2@test.com');
    await becomeFriends(alice, bob);

    const res = await request(app)
      .post('/calls/logs')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ peer_id: bob.user.id, status: 'completed', call_type: 'video' });
    expect(res.status).toBe(201);
    expect(res.body.log.status).toBe('completed');

    const logs = await request(app)
      .get('/calls/logs')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(logs.status).toBe(200);
    expect(logs.body.logs.length).toBeGreaterThanOrEqual(1);
  });

  test('rejects logging a call with a non-friend', async () => {
    const alice = await registerAndVerify('nf1@test.com', 'nf1@test.com');
    const bob = await registerAndVerify('nf2@test.com', 'nf2@test.com');
    const res = await request(app)
      .post('/calls/logs')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ peer_id: bob.user.id, status: 'missed' });
    expect(res.status).toBe(403);
  });

  test('rejects missing peer_id', async () => {
    const { token } = await registerAndVerify('np@test.com', 'np@test.com');
    const res = await request(app)
      .post('/calls/logs')
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'completed' });
    expect(res.status).toBe(400);
  });

  test('rejects invalid call status', async () => {
    const alice = await registerAndVerify('st1@test.com', 'st1@test.com');
    const bob = await registerAndVerify('st2@test.com', 'st2@test.com');
    await becomeFriends(alice, bob);
    const res = await request(app)
      .post('/calls/logs')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ peer_id: bob.user.id, status: 'maybe' });
    expect(res.status).toBe(400);
  });

  test('requires auth to list logs', async () => {
    const res = await request(app).get('/calls/logs');
    expect(res.status).toBe(401);
  });
});
