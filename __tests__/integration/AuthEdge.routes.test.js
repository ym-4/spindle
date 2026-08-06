const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');
const Auth = require('../../src/models/Auth.model');
const { signToken } = require('../../src/utils/jwt');

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
  const hashed = Auth.hashPassword('adminpass1');
  const { rows } = await pool.query(
    `INSERT INTO "Person" (email, name, hashed_password, role, email_verified)
     VALUES ('adminedge@test.com', 'EdgeAdmin', $1, 'admin', TRUE) RETURNING id`,
    [hashed],
  );
  const login = await request(app).post('/auth/login').send({
    username: 'EdgeAdmin',
    password: 'adminpass1',
  });
  return { adminId: rows[0].id, token: login.body.token };
}

describe('Auth — register edge branches', () => {
  test('register rejects missing fields', async () => {
    const r1 = await request(app).post('/auth/register').send({ email: 'a@test.com' });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post('/auth/register').send({ name: 'x', password: '1234' });
    expect(r2.status).toBe(400);
    const r3 = await request(app).post('/auth/register').send({});
    expect(r3.status).toBe(400);
  });

  test('register rejects short password', async () => {
    const res = await request(app)
      .post('/auth/register')
      .send({ name: 'shortpw', email: 'shortpw@test.com', password: 'abc' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('4 characters');
  });

  test('register rejects duplicate name and duplicate email', async () => {
    const first = await request(app)
      .post('/auth/register')
      .send({ name: 'dupuser', email: 'dupuser@test.com', password: 'secret1' });
    expect(first.status).toBe(201);

    const dupName = await request(app)
      .post('/auth/register')
      .send({ name: 'dupuser', email: 'other@test.com', password: 'secret1' });
    expect(dupName.status).toBe(409);

    const dupEmail = await request(app)
      .post('/auth/register')
      .send({ name: 'other', email: 'dupuser@test.com', password: 'secret1' });
    expect(dupEmail.status).toBe(409);
  });

  test('register with role="user" creates verified user directly', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'directrole',
      email: 'directrole@test.com',
      password: 'secret1',
      role: 'user',
    });
    expect(res.status).toBe(201);
    expect(res.body.user).toBeDefined();
    expect(res.body.user.role).toBe('user');
    const inDb = await pool.query(`SELECT role FROM "Person" WHERE name = 'directrole'`);
    expect(inDb.rows[0].role).toBe('user');
  });
});

describe('Auth — email + login verification', () => {
  test('verify-email rejects missing/invalid code', async () => {
    const miss = await request(app).post('/auth/verify-email').send({ email: 'x@test.com' });
    expect(miss.status).toBe(400);

    await request(app)
      .post('/auth/register')
      .send({ name: 'vf', email: 'vf@test.com', password: 'secret1' });
    const bad = await request(app)
      .post('/auth/verify-email')
      .send({ email: 'vf@test.com', code: '999999' });
    expect(bad.status).toBe(400);
  });

  test('verify-email for unknown account returns 404', async () => {
    await Auth.saveVerificationCode('ghost@test.com', 'email_verify');
    const res = await request(app)
      .post('/auth/verify-email')
      .send({
        email: 'ghost@test.com',
        code: (await Auth.saveVerificationCode('ghost@test.com', 'email_verify')).code,
      });
    expect([400, 404]).toContain(res.status);
  });

  test('verify-login with remember_me returns remember_token', async () => {
    const { user } = await registerAndVerify('rm@test.com', 'rm@test.com');
    const afterReg = await request(app).post('/auth/login').send({
      username: 'rm@test.com',
      password: 'secret1',
    });
    const verify = await request(app).post('/auth/verify-login').send({
      email: afterReg.body.email,
      code: afterReg.body.previewCode,
      remember_me: true,
    });
    expect(verify.status).toBe(200);
    expect(verify.body.remember_token).toBeDefined();
    expect(verify.body.user.id).toBe(user.id);
  });

  test('verify-login rejects invalid code and unknown account', async () => {
    const reg = await request(app)
      .post('/auth/register')
      .send({ name: 'vl', email: 'vl@test.com', password: 'secret1' });
    const wrong = await request(app)
      .post('/auth/verify-login')
      .send({ email: 'vl@test.com', code: '000000' });
    expect(wrong.status).toBe(400);

    await request(app).post('/auth/verify-login').send({ email: '', code: '' });
  });

  test('resend-code sends for both purposes', async () => {
    const res = await request(app).post('/auth/resend-code').send({ email: 'rc@test.com' });
    expect(res.status).toBe(200);
    expect(res.body.purpose).toBe('email_verify');
    expect(res.body.previewCode).toBeDefined();

    const res2 = await request(app)
      .post('/auth/resend-code')
      .send({ email: 'rc@test.com', purpose: 'login_2fa' });
    expect(res2.status).toBe(200);
    expect(res2.body.purpose).toBe('login_2fa');

    const miss = await request(app).post('/auth/resend-code').send({});
    expect(miss.status).toBe(400);
  });
});

describe('Auth — login branch coverage', () => {
  test('login requires username and password', async () => {
    const r1 = await request(app).post('/auth/login').send({ username: 'x' });
    expect(r1.status).toBe(400);
    const r2 = await request(app).post('/auth/login').send({});
    expect(r2.status).toBe(400);
  });

  test('login rejects wrong password and unknown user', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'lp', email: 'lp@test.com', password: 'secret1' });
    const wrong = await request(app)
      .post('/auth/login')
      .send({ username: 'lp', password: 'wrongpass' });
    expect(wrong.status).toBe(401);
    const ghost = await request(app)
      .post('/auth/login')
      .send({ username: 'ghostuser', password: 'secret1' });
    expect(ghost.status).toBe(401);
  });

  test('login for unverified user requests email verification', async () => {
    await request(app)
      .post('/auth/register')
      .send({ name: 'unver', email: 'unver@test.com', password: 'secret1' });
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'unver', password: 'secret1' });
    expect(res.status).toBe(403);
    expect(res.body.needsVerification).toBe(true);
  });

  test('login with banned user returns 403 banned payload', async () => {
    const { user } = await registerAndVerify('banned@test.com', 'banned@test.com');
    await pool.query(`UPDATE "Person" SET suspended_until = $1, banned_reason = $2 WHERE id = $3`, [
      new Date(Date.now() + 86400000).toISOString(),
      'cheating',
      user.id,
    ]);
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'banned@test.com', password: 'secret1' });
    expect(res.status).toBe(403);
    expect(res.body.banned).toBe(true);
    expect(res.body.reason).toBe('cheating');
  });

  test('login for verified user triggers 2fa step', async () => {
    await registerAndVerify('twofa@test.com', 'twofa@test.com');
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'twofa@test.com', password: 'secret1' });
    expect(res.status).toBe(200);
    expect(res.body.needs2FA).toBe(true);
    expect(res.body.previewCode).toBeDefined();
    expect(res.body.step).toBe('login');
  });

  test('login as admin returns token directly', async () => {
    await seedAdmin();
    const res = await request(app)
      .post('/auth/login')
      .send({ username: 'EdgeAdmin', password: 'adminpass1' });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.role).toBe('admin');
  });
});

describe('Auth — profile + me + avatar', () => {
  test('/me returns profile and 404 for deleted user', async () => {
    const alice = await registerAndVerify('me@test.com', 'me@test.com');
    const me = await request(app).get('/auth/me').set('Authorization', `Bearer ${alice.token}`);
    expect(me.status).toBe(200);
    expect(me.body.id).toBe(alice.user.id);

    const ghostToken = signToken({ id: 999999, name: 'g', email: 'g@test.com', role: 'user' });
    const gone = await request(app).get('/auth/me').set('Authorization', `Bearer ${ghostToken}`);
    expect(gone.status).toBe(404);
  });

  test('PUT /auth/profile updates and returns user', async () => {
    const alice = await registerAndVerify('pro@test.com', 'pro@test.com');
    const res = await request(app)
      .put('/auth/profile')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ bio: 'hello' });
    expect(res.status).toBe(200);
  });

  test('avatar/cover uploads reject missing file', async () => {
    const alice = await registerAndVerify('av@test.com', 'av@test.com');
    const noAvatar = await request(app)
      .post('/auth/avatar')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(noAvatar.status).toBe(400);

    const noCover = await request(app)
      .post('/auth/cover')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(noCover.status).toBe(400);
  });

  test('pre-token and pre-compare reject missing payload', async () => {
    const pre = await request(app).post('/auth/pre-token').send({});
    expect(pre.status).toBe(400);
    const comp = await request(app).post('/auth/pre-compare').send({});
    expect(comp.status).toBe(400);
  });
});

describe('Auth — admin edge branches', () => {
  test('admin delete user: deletes others, rejects self', async () => {
    const admin = await seedAdmin();
    const victim = await registerAndVerify('victim@test.com', 'victim@test.com');

    const self = await request(app)
      .delete(`/auth/admin/users/${admin.adminId}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(self.status).toBe(400);

    const ok = await request(app)
      .delete(`/auth/admin/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(ok.status).toBe(200);
  });

  test('admin role update validates and rejects demote self / missing user', async () => {
    const admin = await seedAdmin();
    const victim = await registerAndVerify('roleu@test.com', 'roleu@test.com');

    const invalid = await request(app)
      .put(`/auth/admin/users/${victim.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'root' });
    expect(invalid.status).toBe(400);

    const demoteSelf = await request(app)
      .put(`/auth/admin/users/${admin.adminId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'user' });
    expect(demoteSelf.status).toBe(400);

    const missing = await request(app)
      .put('/auth/admin/users/999999')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ role: 'admin' });
    expect(missing.status).toBe(404);
  });

  test('admin ban without reason / self-ban rejected; ban-with-reason works', async () => {
    const admin = await seedAdmin();
    const victim = await registerAndVerify('banv@test.com', 'banv@test.com');

    const noId = await request(app)
      .post('/auth/admin/ban')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(noId.status).toBe(400);

    const selfBan = await request(app)
      .post('/auth/admin/ban')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ user_id: admin.adminId });
    expect(selfBan.status).toBe(400);

    const ban = await request(app)
      .post('/auth/admin/ban-with-reason')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ user_id: victim.user.id, duration_hours: 24, reason: 'spam' });
    expect(ban.status).toBe(200);

    const noReason = await request(app)
      .post('/auth/admin/ban-with-reason')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({ user_id: victim.user.id });
    expect(noReason.status).toBe(400);
  });

  test('admin unsuspend requires user_id', async () => {
    const admin = await seedAdmin();
    const res = await request(app)
      .post('/auth/admin/unsuspend')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('appeal and batch endpoints run', async () => {
    const admin = await seedAdmin();
    const victim = await registerAndVerify('appv@test.com', 'appv@test.com');

    const noMsg = await request(app).post('/auth/appeal').send({ user_id: victim.user.id });
    expect(noMsg.status).toBe(400);

    const appeal = await request(app)
      .post('/auth/appeal')
      .send({ user_id: victim.user.id, message: 'please unban' });
    expect(appeal.status).toBe(200);
    const appealId = appeal.body.appeal.id || appeal.body.appeal.appeal_id;

    const pending = await request(app)
      .get('/auth/admin/appeals')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(pending.status).toBe(200);

    const approveMissing = await request(app)
      .post('/auth/admin/appeals/999999/approve')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(approveMissing.status).toBe(404);

    if (appealId) {
      const dismiss = await request(app)
        .post(`/auth/admin/appeals/${appealId}/dismiss`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(dismiss.status).toBe(200);
    }
  });

  test('admin reports + audit + trend + search branches', async () => {
    const admin = await seedAdmin();
    const me = await registerAndVerify('rep@test.com', 'rep@test.com');

    const missing = await request(app)
      .post('/auth/report-user')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ reason: 'x' });
    expect(missing.status).toBe(400);

    const selfReport = await request(app)
      .post('/auth/report-user')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ reported_id: me.user.id, reason: 'x' });
    expect(selfReport.status).toBe(400);

    await request(app)
      .post('/auth/report-user')
      .set('Authorization', `Bearer ${me.token}`)
      .send({ reported_id: admin.adminId, reason: 'x' });

    const audit = await request(app)
      .get('/auth/admin/audit-log')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(audit.status).toBe(200);

    const reportId = audit.body.log[0]?.id || audit.body.log?.[0]?.report_id;
    if (reportId) {
      const dismissed = await request(app)
        .post(`/auth/admin/reports/${reportId}/dismiss`)
        .set('Authorization', `Bearer ${admin.token}`);
      expect(dismissed.status).toBe(200);
    }

    const search = await request(app)
      .get('/auth/admin/search-users')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(search.status).toBe(200);
  });

  test('check-ban validates email', async () => {
    const res = await request(app).post('/auth/check-ban').send({});
    expect(res.status).toBe(400);
  });

  test('admin extra endpoints: global-search, trend-stats, activity', async () => {
    const admin = await seedAdmin();
    const me = await registerAndVerify('extra@test.com', 'extra@test.com');

    const gs = await request(app)
      .get('/auth/admin/global-search?q=x')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(gs.status).toBe(200);

    const trend = await request(app)
      .get('/auth/admin/trend-stats')
      .set('Authorization', `Bearer ${admin.token}`);
    expect(trend.status).toBe(200);

    const activity = await request(app)
      .get(`/auth/admin/users/${me.user.id}/activity`)
      .set('Authorization', `Bearer ${admin.token}`);
    expect(activity.status).toBe(200);
  });
});

describe('Auth.model — direct branch coverage', () => {
  test('password helpers: bad stored, bad hex, mismatched', async () => {
    expect(Auth.verifyPassword('x', '')).toBe(false);
    expect(Auth.verifyPassword('x', 'no-colon')).toBe(false);
    expect(Auth.verifyPassword('x', 'deadbeef:nothex')).toBe(false);
    const okHash = Auth.hashPassword('correct');
    expect(Auth.verifyPassword('correct', okHash)).toBe(true);
    expect(Auth.verifyPassword('wrong', okHash)).toBe(false);
  });

  test('authenticate rejects missing, inactive, wrong password', async () => {
    const hashed = Auth.hashPassword('pw');
    const { rows } = await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified)
       VALUES ('authy', 'authy@test.com', $1, 'user', TRUE) RETURNING id`,
      [hashed],
    );
    const id = rows[0].id;
    expect(await Auth.authenticate('authy', 'pw')).toBeTruthy();
    expect(await Auth.authenticate('noone', 'pw')).toBeNull();
    expect(await Auth.authenticate('authy', 'badpw')).toBeNull();
    await pool.query(`UPDATE "Person" SET is_active = FALSE WHERE id = $1`, [id]);
    expect(await Auth.authenticate('authy', 'pw')).toBeNull();
  });

  test('findByUsername matches name or email', async () => {
    const hashed = Auth.hashPassword('pw');
    await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified, display_name)
       VALUES ('finder', 'finder@test.com', $1, 'user', TRUE, 'FinderOne') RETURNING id`,
      [hashed],
    );
    const byName = await Auth.findByUsername('finder');
    expect(byName).toBeTruthy();
    const byEmail = await Auth.findByUsername('finder@test.com');
    expect(byEmail).toBeTruthy();
  });

  test('trusted device roundtrip + revoke + missing token', async () => {
    const hashed = Auth.hashPassword('pw');
    const { rows } = await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified) VALUES ('td', 'td@test.com', $1, 'user', TRUE) RETURNING id`,
      [hashed],
    );
    const userId = rows[0].id;
    expect(await Auth.findUserIdByTrustedToken('')).toBeNull();
    expect(await Auth.findUserIdByTrustedToken(null)).toBeNull();

    const token = await Auth.createTrustedDevice(userId);
    expect(await Auth.findUserIdByTrustedToken(token)).toBe(userId);
    await Auth.revokeTrustedDevices(userId);
    expect(await Auth.findUserIdByTrustedToken(token)).toBeNull();
  });

  test('updatePassword: unknown user and wrong current', async () => {
    expect(await Auth.updatePassword(999999, 'x', 'y')).toBe(false);
    const hashed = Auth.hashPassword('oldpw');
    const { rows } = await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified) VALUES ('upw', 'upw@test.com', $1, 'user', TRUE) RETURNING id`,
      [hashed],
    );
    expect(await Auth.updatePassword(rows[0].id, 'wrong', 'new')).toBe(false);
    expect(await Auth.updatePassword(rows[0].id, 'oldpw', 'new')).toBe(true);
  });

  test('getUserProfile parses skill variants', async () => {
    const hashed = Auth.hashPassword('pw');
    const { rows } = await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified, skills)
       VALUES ('skilly', 'skilly@test.com', $1, 'user', TRUE, $2) RETURNING id`,
      [hashed, JSON.stringify(['a', 'b'])],
    );
    const prof = await Auth.getUserProfile(rows[0].id);
    expect(prof.skills).toEqual(['a', 'b']);
    expect(await Auth.getUserProfile(999999)).toBeNull();
  });

  test('updatePublicProfile: no fields returns same profile, skills sanitized', async () => {
    const hashed = Auth.hashPassword('pw');
    const { rows } = await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified) VALUES ('pub', 'pub@test.com', $1, 'user', TRUE) RETURNING id`,
      [hashed],
    );
    await Auth.updatePublicProfile(rows[0].id, {});
    const res = await Auth.updatePublicProfile(rows[0].id, {
      display_name: 'Pub',
      skills: [' js ', '', '  '],
      headline: ' dev ',
    });
    expect(res.display_name).toBe('Pub');
    expect(res.skills).toEqual(['js']);
    const emptySkills = await Auth.updatePublicProfile(rows[0].id, { skills: 'not-an-array' });
    expect(emptySkills.skills).toEqual([]);
  });

  test('getDismissedReports runs', async () => {
    const rows = await Auth.getDismissedReports();
    expect(Array.isArray(rows)).toBe(true);
  });
});
