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

async function seedAdmin() {
  const hashed = require('../../src/models/Auth.model').hashPassword('adminpass1');
  const { rows } = await pool.query(
    `INSERT INTO "Person" (email, name, hashed_password, role, email_verified)
     VALUES ('admin@test.com', 'RootAdmin', $1, 'admin', TRUE) RETURNING id`,
    [hashed],
  );
  const login = await request(app).post('/auth/login').send({
    username: 'RootAdmin',
    password: 'adminpass1',
  });
  return { adminId: rows[0].id, token: login.body.token };
}

describe('Auth — admin dashboard', () => {
  test('stats require admin role', async () => {
    const { token } = await registerAndVerify('adminreg@test.com', 'adminreg@test.com');
    const res = await request(app).get('/auth/admin/stats').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(403);
  });

  test('stats, banned users, audit log all work for admin', async () => {
    const { token } = await seedAdmin();
    const stats = await request(app)
      .get('/auth/admin/stats')
      .set('Authorization', `Bearer ${token}`);
    expect(stats.status).toBe(200);

    const banned = await request(app)
      .get('/auth/admin/banned-users')
      .set('Authorization', `Bearer ${token}`);
    expect(banned.status).toBe(200);
    expect(Array.isArray(banned.body.users)).toBe(true);

    const audit = await request(app)
      .get('/auth/admin/audit-log')
      .set('Authorization', `Bearer ${token}`);
    expect(audit.status).toBe(200);
  });

  test('admin bans and unsuspends a user', async () => {
    const { token } = await seedAdmin();
    const { user } = await registerAndVerify('banme@test.com', 'banme@test.com');

    const ban = await request(app)
      .post('/auth/admin/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, duration_hours: 24 });
    expect(ban.status).toBe(200);
    expect(ban.body.suspended_until).toBeTruthy();

    const bannedList = await request(app)
      .get('/auth/admin/banned-users')
      .set('Authorization', `Bearer ${token}`);
    expect(bannedList.body.users.some((u) => u.id === user.id)).toBe(true);

    const unban = await request(app)
      .post('/auth/admin/unsuspend')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id });
    expect(unban.status).toBe(200);
  });

  test('ban requires user_id and rejects banning yourself', async () => {
    const { adminId, token } = await seedAdmin();
    const noId = await request(app)
      .post('/auth/admin/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(noId.status).toBe(400);

    const self = await request(app)
      .post('/auth/admin/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: adminId });
    expect(self.status).toBe(400);
  });

  test('ban-with-reason requires reason', async () => {
    const { token } = await seedAdmin();
    const { user } = await registerAndVerify('br@test.com', 'br@test.com');
    const res = await request(app)
      .post('/auth/admin/ban-with-reason')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id });
    expect(res.status).toBe(400);

    const ok = await request(app)
      .post('/auth/admin/ban-with-reason')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, reason: 'spam' });
    expect(ok.status).toBe(200);
  });

  test('role update validates role and rejects demoting self', async () => {
    const { adminId, token } = await seedAdmin();
    const { user } = await registerAndVerify('role@test.com', 'role@test.com');

    const badRole = await request(app)
      .put(`/auth/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'superadmin' });
    expect(badRole.status).toBe(400);

    const promote = await request(app)
      .put(`/auth/admin/users/${user.id}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'admin' });
    expect(promote.status).toBe(200);

    const demoteSelf = await request(app)
      .put(`/auth/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${token}`)
      .send({ role: 'user' });
    expect(demoteSelf.status).toBe(400);
  });

  test('delete user rejects deleting self', async () => {
    const { adminId, token } = await seedAdmin();
    const res = await request(app)
      .delete(`/auth/admin/users/${adminId}`)
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(400);
  });

  test('appeal lifecycle: submit, list, approve', async () => {
    const { token } = await seedAdmin();
    const { user } = await registerAndVerify('appl@test.com', 'appl@test.com');

    const submit = await request(app)
      .post('/auth/appeal')
      .send({ user_id: user.id, message: 'I was framed' });
    expect(submit.status).toBe(200);

    const appeals = await request(app)
      .get('/auth/admin/appeals')
      .set('Authorization', `Bearer ${token}`);
    expect(appeals.status).toBe(200);
    expect(appeals.body.appeals.length).toBeGreaterThanOrEqual(1);

    const appealId = appeals.body.appeals[0].id;
    const approve = await request(app)
      .post(`/auth/admin/appeals/${appealId}/approve`)
      .set('Authorization', `Bearer ${token}`);
    expect(approve.status).toBe(200);
  });

  test('appeal without message is rejected', async () => {
    const { user } = await registerAndVerify('appl2@test.com', 'appl2@test.com');
    const res = await request(app).post('/auth/appeal').send({ user_id: user.id });
    expect(res.status).toBe(400);
  });

  test('report-user validates inputs', async () => {
    const { token } = await registerAndVerify('rep@test.com', 'rep@test.com');
    const victim = await registerAndVerify('repv@test.com', 'repv@test.com');

    const missing = await request(app)
      .post('/auth/report-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ reported_id: victim.user.id });
    expect(missing.status).toBe(400);

    const self = await request(app)
      .post('/auth/report-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ reported_id: (await registerAndVerify('rep3@test.com', 'rep3@test.com')).user.id });
    expect(self.status).toBe(400);

    const ok = await request(app)
      .post('/auth/report-user')
      .set('Authorization', `Bearer ${token}`)
      .send({ reported_id: victim.user.id, reason: 'spam' });
    expect(ok.status).toBe(201);
  });

  test('check-ban returns banned status', async () => {
    const { token } = await seedAdmin();
    const { user } = await registerAndVerify('chk@test.com', 'chk@test.com');
    await request(app)
      .post('/auth/admin/ban')
      .set('Authorization', `Bearer ${token}`)
      .send({ user_id: user.id, duration_hours: 24 });

    const res = await request(app).post('/auth/check-ban').send({ email: 'chk@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.banned).toBe(true);
    expect(res.body.user_id).toBe(user.id);
  });

  test('admin search users returns matches', async () => {
    const { token } = await seedAdmin();
    const res = await request(app)
      .get('/auth/admin/search-users?q=Root')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
  });
});
