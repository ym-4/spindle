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

describe('Notifications', () => {
  test('lists notifications with unread count', async () => {
    const { user, token } = await registerAndVerify('notif@test.com', 'notif@test.com');
    await pool.query(
      `INSERT INTO "Notifications" (user_id, type, title, body, ref_id)
       VALUES ($1, 'test', 'Hello', 'Body text', 1)`,
      [user.id],
    );

    const res = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.notifications.length).toBeGreaterThanOrEqual(1);
    expect(res.body.unread).toBeGreaterThanOrEqual(1);
  });

  test('marks single notification read', async () => {
    const { user, token } = await registerAndVerify('notif2@test.com', 'notif2@test.com');
    const { rows } = await pool.query(
      `INSERT INTO "Notifications" (user_id, type, title, body)
       VALUES ($1, 'test', 'Hi', 'b') RETURNING id`,
      [user.id],
    );

    const res = await request(app)
      .patch(`/notifications/${rows[0].id}/read`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);

    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(list.body.unread).toBe(0);
  });

  test('marks all read', async () => {
    const { user, token } = await registerAndVerify('notif3@test.com', 'notif3@test.com');
    await pool.query(
      `INSERT INTO "Notifications" (user_id, type, title, body) VALUES ($1,'a','1','x'),($1,'a','2','y')`,
      [user.id],
    );
    const res = await request(app)
      .patch('/notifications/read-all')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    const list = await request(app).get('/notifications').set('Authorization', `Bearer ${token}`);
    expect(list.body.unread).toBe(0);
  });

  test('requires auth', async () => {
    const res = await request(app).get('/notifications');
    expect(res.status).toBe(401);
  });
});

describe('Blocked users', () => {
  test('blocks, checks, lists, and unblocks', async () => {
    const alice = await registerAndVerify('bl1@test.com', 'bl1@test.com');
    const bob = await registerAndVerify('bl2@test.com', 'bl2@test.com');

    const block = await request(app).post('/block').send({
      blocker_id: alice.user.id,
      blocked_id: bob.user.id,
    });
    expect(block.status).toBe(201);

    const check = await request(app).get(`/block/check/${alice.user.id}/${bob.user.id}`);
    expect(check.status).toBe(200);
    expect(check.body.blocked).toBe(true);

    const list = await request(app)
      .get('/block/list')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(list.status).toBe(200);
    expect(list.body.some((u) => u.blocked_id === bob.user.id)).toBe(true);

    const un = await request(app)
      .delete(`/block/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(un.status).toBe(200);

    const checkAfter = await request(app).get(`/block/check/${alice.user.id}/${bob.user.id}`);
    expect(checkAfter.body.blocked).toBe(false);
  });

  test('cannot block yourself', async () => {
    const alice = await registerAndVerify('bl3@test.com', 'bl3@test.com');
    const res = await request(app)
      .post('/block')
      .send({ blocker_id: alice.user.id, blocked_id: alice.user.id });
    expect(res.status).toBe(400);
  });

  test('requires blocker and blocked ids', async () => {
    const res = await request(app).post('/block').send({});
    expect(res.status).toBe(400);
  });

  test('already-blocked returns 200', async () => {
    const alice = await registerAndVerify('bl4@test.com', 'bl4@test.com');
    const bob = await registerAndVerify('bl5@test.com', 'bl5@test.com');
    await request(app).post('/block').send({ blocker_id: alice.user.id, blocked_id: bob.user.id });
    const again = await request(app)
      .post('/block')
      .send({ blocker_id: alice.user.id, blocked_id: bob.user.id });
    expect(again.status).toBe(200);
  });
});
