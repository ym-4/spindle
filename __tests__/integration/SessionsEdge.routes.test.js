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

async function seedSession(host, scheduled = '2026-12-31T09:00:00') {
  return request(app)
    .post('/sessions')
    .set('Authorization', `Bearer ${host.token}`)
    .send({ title: 'Review', description: 'Final', scheduled_at: scheduled });
}

describe('Session — coverage of edge branches', () => {
  test('create requires title and scheduled_at', async () => {
    const host = await registerAndVerify('s1@test.com', 's1@test.com');
    const miss = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ title: 'x' });
    expect(miss.status).toBe(400);
  });

  test('create list get status lifecycle', async () => {
    const host = await registerAndVerify('s2@test.com', 's2@test.com');
    const bob = await registerAndVerify('s3@test.com', 's3@test.com');
    await becomeFriends(host, bob);

    const created = await seedSession(host);
    expect(created.status).toBe(201);
    const sessionId = created.body.id;

    const list = await request(app).get('/sessions').set('Authorization', `Bearer ${host.token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);

    const get = await request(app)
      .get(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(get.status).toBe(200);
    expect(get.body.id).toBe(sessionId);

    const missing = await request(app)
      .get('/sessions/999999')
      .set('Authorization', `Bearer ${host.token}`);
    expect(missing.status).toBe(404);

    const updated = await request(app)
      .put(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${host.token}`)
      .send({ status: 'in_progress' });
    expect(updated.status).toBe(200);
    expect(updated.body.id).toBe(sessionId);

    const updMiss = await request(app)
      .put('/sessions/999999')
      .set('Authorization', `Bearer ${host.token}`)
      .send({ status: 'completed' });
    expect(updMiss.status).toBe(404);

    const deleted = await request(app)
      .delete(`/sessions/${sessionId}`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(deleted.status).toBe(200);

    const delMiss = await request(app)
      .delete('/sessions/999999')
      .set('Authorization', `Bearer ${host.token}`);
    expect(delMiss.status).toBe(404);
  });

  test('participants add/remove incl. not-found', async () => {
    const host = await registerAndVerify('s4@test.com', 's4@test.com');
    const bob = await registerAndVerify('s5@test.com', 's5@test.com');
    await becomeFriends(host, bob);
    const created = await seedSession(host);
    const sessionId = created.body.id;

    const list = await request(app)
      .get(`/sessions/${sessionId}/participants`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(list.status).toBe(200);

    const joined = await request(app)
      .post(`/sessions/${sessionId}/participants`)
      .set('Authorization', `Bearer ${bob.token}`)
      .send({});
    expect(joined.status).toBe(201);

    const removed = await request(app)
      .delete(`/sessions/${sessionId}/participants/${bob.user.id}`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(removed.status).toBe(200);

    const remMiss = await request(app)
      .delete(`/sessions/${sessionId}/participants/999999`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(remMiss.status).toBe(404);
  });

  test('tasks add/toggle/remove lifecycle incl. 400/404', async () => {
    const host = await registerAndVerify('s6@test.com', 's6@test.com');
    const created = await seedSession(host);
    const sessionId = created.body.id;

    const bad = await request(app)
      .post(`/sessions/${sessionId}/tasks`)
      .set('Authorization', `Bearer ${host.token}`)
      .send({});
    expect(bad.status).toBe(400);

    const task = await request(app)
      .post(`/sessions/${sessionId}/tasks`)
      .set('Authorization', `Bearer ${host.token}`)
      .send({ text: 'chapter 1' });
    expect(task.status).toBe(201);
    const taskId = task.body.id;

    const listTasks = await request(app)
      .get(`/sessions/${sessionId}/tasks`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(listTasks.status).toBe(200);
    expect(listTasks.body.length).toBe(1);

    const toggled = await request(app)
      .put(`/sessions/${sessionId}/tasks/${taskId}/toggle`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(toggled.status).toBe(200);
    expect(toggled.body.is_done).toBe(true);

    const togMiss = await request(app)
      .put(`/sessions/${sessionId}/tasks/999999/toggle`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(togMiss.status).toBe(404);

    const delTask = await request(app)
      .delete(`/sessions/${sessionId}/tasks/${taskId}`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(delTask.status).toBe(200);

    const delTaskMiss = await request(app)
      .delete(`/sessions/${sessionId}/tasks/999999`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(delTaskMiss.status).toBe(404);
  });

  test('recordings save/list roundtrip incl. 400', async () => {
    const host = await registerAndVerify('s7@test.com', 's7@test.com');
    const created = await seedSession(host);
    const sessionId = created.body.id;

    const bad = await request(app)
      .post(`/sessions/${sessionId}/recordings`)
      .set('Authorization', `Bearer ${host.token}`)
      .send({});
    expect(bad.status).toBe(400);

    const saved = await request(app)
      .post(`/sessions/${sessionId}/recordings`)
      .set('Authorization', `Bearer ${host.token}`)
      .send({ file_path: '/uploads/session.mp4', duration_sec: 90 });
    expect(saved.status).toBe(201);
    expect(saved.body.duration_sec).toBe(90);

    const list = await request(app)
      .get(`/sessions/${sessionId}/recordings`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBe(1);
  });

  test('create session with invitees propagates', async () => {
    const host = await registerAndVerify('s8@test.com', 's8@test.com');
    const bob = await registerAndVerify('s9@test.com', 's9@test.com');
    await becomeFriends(host, bob);

    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${host.token}`)
      .send({
        title: 'Review',
        scheduled_at: '2026-12-31T09:00:00',
        invitee_ids: [bob.user.id],
      });
    expect(res.status).toBe(201);
    const sessionId = res.body.id;

    const invited = await request(app).get('/sessions').set('Authorization', `Bearer ${bob.token}`);
    expect(invited.status).toBe(200);
    expect(invited.body.some((x) => x.id === sessionId)).toBe(true);
  });
});
