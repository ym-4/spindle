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

describe('Study Sessions — CRUD', () => {
  test('creates a session and lists upcoming', async () => {
    const alice = await registerAndVerify('ss1@test.com', 'ss1@test.com');
    const bob = await registerAndVerify('ss2@test.com', 'ss2@test.com');

    const create = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        title: 'SQL Study',
        description: 'revise joins',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        invitee_ids: [bob.user.id],
      });
    expect(create.status).toBe(201);
    expect(create.body.title).toBe('SQL Study');
    expect(create.body.status).toBe('scheduled');

    const upcoming = await request(app)
      .get('/sessions')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(upcoming.status).toBe(200);
    expect(upcoming.body.some((s) => s.id === create.body.id)).toBe(true);
  });

  test('requires title and scheduled_at', async () => {
    const { token } = await registerAndVerify('ss3@test.com', 'ss3@test.com');
    const res = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'No date' });
    expect(res.status).toBe(400);
  });

  test('gets session by id and 404 for missing', async () => {
    const { token } = await registerAndVerify('ss4@test.com', 'ss4@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Find me', scheduled_at: new Date(Date.now() + 86400000).toISOString() });

    const get = await request(app)
      .get(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(200);
    expect(get.body.title).toBe('Find me');

    const missing = await request(app)
      .get('/sessions/999999')
      .set('Authorization', `Bearer ${token}`);
    expect(missing.status).toBe(404);
  });

  test('updates session status', async () => {
    const { token } = await registerAndVerify('ss5@test.com', 'ss5@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'status', scheduled_at: new Date(Date.now() + 86400000).toISOString() });

    const update = await request(app)
      .put(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ status: 'active' });
    expect(update.status).toBe(200);
    expect(update.body.status).toBe('active');
  });

  test('deletes a session', async () => {
    const { token } = await registerAndVerify('ss6@test.com', 'ss6@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'bye', scheduled_at: new Date(Date.now() + 86400000).toISOString() });

    const del = await request(app)
      .delete(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const get = await request(app)
      .get(`/sessions/${created.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(get.status).toBe(404);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/sessions');
    expect(res.status).toBe(401);
  });
});

describe('Study Sessions — participants & tasks', () => {
  test('manages participants', async () => {
    const host = await registerAndVerify('sp1@test.com', 'sp1@test.com');
    const invitee = await registerAndVerify('sp2@test.com', 'sp2@test.com');

    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${host.token}`)
      .send({
        title: 'group session',
        scheduled_at: new Date(Date.now() + 86400000).toISOString(),
        invitee_ids: [invitee.user.id],
      });

    const list = await request(app)
      .get(`/sessions/${created.body.id}/participants`)
      .set('Authorization', `Bearer ${host.token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((p) => p.user_id === invitee.user.id)).toBe(true);
  });

  test('full task lifecycle: add, list, toggle, delete', async () => {
    const { token } = await registerAndVerify('sp3@test.com', 'sp3@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'task session', scheduled_at: new Date(Date.now() + 86400000).toISOString() });

    const add = await request(app)
      .post(`/sessions/${created.body.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({ text: 'revise chapter 4' });
    expect(add.status).toBe(201);
    expect(add.body.text).toBe('revise chapter 4');

    const list = await request(app)
      .get(`/sessions/${created.body.id}/tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    const task = list.body[0];
    expect(task.is_done).toBe(false);

    const toggle = await request(app)
      .put(`/sessions/${created.body.id}/tasks/${task.id}/toggle`)
      .set('Authorization', `Bearer ${token}`)
      .send({ is_done: true });
    expect(toggle.status).toBe(200);
    expect(toggle.body.is_done).toBe(true);

    const toggleBack = await request(app)
      .put(`/sessions/${created.body.id}/tasks/${task.id}/toggle`)
      .set('Authorization', `Bearer ${token}`);
    expect(toggleBack.status).toBe(200);
    expect(toggleBack.body.is_done).toBe(false);

    const del = await request(app)
      .delete(`/sessions/${created.body.id}/tasks/${task.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(del.status).toBe(200);

    const after = await request(app)
      .get(`/sessions/${created.body.id}/tasks`)
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.length).toBe(0);
  });

  test('task requires text', async () => {
    const { token } = await registerAndVerify('sp3@test.com', 'sp3@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'x', scheduled_at: new Date(Date.now() + 86400000).toISOString() });
    const res = await request(app)
      .post(`/sessions/${created.body.id}/tasks`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});

describe('Study Sessions — recordings', () => {
  test('records a session recording metadata', async () => {
    const { token } = await registerAndVerify('sr1@test.com', 'sr1@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'record', scheduled_at: new Date(Date.now() + 86400000).toISOString() });

    const res = await request(app)
      .post(`/sessions/${created.body.id}/recordings`)
      .set('Authorization', `Bearer ${token}`)
      .send({ file_path: '/uploads/recordings/x.webm', duration_sec: 42 });
    expect(res.status).toBe(201);
    expect(res.body.file_path).toBe('/uploads/recordings/x.webm');

    const list = await request(app)
      .get(`/sessions/${created.body.id}/recordings`)
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((r) => r.file_path === '/uploads/recordings/x.webm')).toBe(true);
  });

  test('requires file_path', async () => {
    const { token } = await registerAndVerify('sr2@test.com', 'sr2@test.com');
    const created = await request(app)
      .post('/sessions')
      .set('Authorization', `Bearer ${token}`)
      .send({ title: 'Rec2', scheduled_at: new Date(Date.now() + 86400000).toISOString() });
    const res = await request(app)
      .post(`/sessions/${created.body.id}/recordings`)
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });
});
