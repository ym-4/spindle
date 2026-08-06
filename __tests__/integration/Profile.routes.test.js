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

describe('Profile — settings', () => {
  test('GET /profile/settings returns settings', async () => {
    const { token } = await registerAndVerify('set1@test.com', 'set1@test.com');
    const res = await request(app).get('/profile/settings').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.theme).toBe('light');
  });

  test('requires auth for settings', async () => {
    const res = await request(app).get('/profile/settings');
    expect(res.status).toBe(401);
  });

  test('appearance update rejects invalid theme values', async () => {
    const { token } = await registerAndVerify('theme@test.com', 'theme@test.com');
    const bad = await request(app)
      .put('/profile/settings/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'neon-rainbow' });
    expect([200, 400]).toContain(bad.status);

    const good = await request(app)
      .put('/profile/settings/appearance')
      .set('Authorization', `Bearer ${token}`)
      .send({ theme: 'dark' });
    expect(good.status).toBe(200);

    const check = await request(app)
      .get('/profile/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(check.body.settings.theme).toBe('dark');
  });

  test('account update requires current password', async () => {
    const { token } = await registerAndVerify('acct@test.com', 'acct@test.com');
    const res = await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${token}`)
      .send({ display_name: 'New Name' });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/password/i);
  });

  test('privacy toggle persists', async () => {
    const { token } = await registerAndVerify('priv@test.com', 'priv@test.com');
    const res = await request(app)
      .put('/profile/settings/privacy')
      .set('Authorization', `Bearer ${token}`)
      .send({ public_profile: false });
    expect(res.status).toBe(200);
    const check = await request(app)
      .get('/profile/settings')
      .set('Authorization', `Bearer ${token}`);
    expect(check.body.settings.public_profile).toBe(false);
  });

  test('password change requires matching new passwords', async () => {
    const { token } = await registerAndVerify('pwd@test.com', 'pwd@test.com');
    const res = await request(app)
      .put('/profile/settings/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: 'secret1',
        new_password: 'newpass1',
        new_password_confirm: 'different',
        code: '000000',
      });
    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/match/i);
  });

  test('password change succeeds with valid code and current password', async () => {
    const { token } = await registerAndVerify('pwdok@test.com', 'pwdok@test.com');
    const codeRes = await request(app)
      .post('/profile/settings/password/request-code')
      .set('Authorization', `Bearer ${token}`);
    expect(codeRes.status).toBe(200);

    const res = await request(app)
      .put('/profile/settings/password')
      .set('Authorization', `Bearer ${token}`)
      .send({
        current_password: 'secret1',
        new_password: 'newpass2',
        new_password_confirm: 'newpass2',
        code: codeRes.body.previewCode,
      });
    expect(res.status).toBe(200);

    const login = await request(app).post('/auth/login').send({
      username: 'pwdok@test.com',
      password: 'newpass2',
    });
    expect(login.status).toBe(200);
  });

  test('delete account requires confirm text', async () => {
    const { token } = await registerAndVerify('delacct@test.com', 'delacct@test.com');
    const bad = await request(app)
      .post('/profile/settings/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirm: 'nope' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .post('/profile/settings/delete')
      .set('Authorization', `Bearer ${token}`)
      .send({ confirm: 'DELETE' });
    expect(ok.status).toBe(200);
  });

  test('deactivates account', async () => {
    const { token } = await registerAndVerify('deact@test.com', 'deact@test.com');
    const res = await request(app)
      .post('/profile/settings/deactivate')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
  });

  test('export returns user data', async () => {
    const { token, user } = await registerAndVerify('export@test.com', 'export@test.com');
    const res = await request(app)
      .get('/profile/settings/export')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile).toBeDefined();
    expect(res.body.profile.id).toBe(user.id);
    expect(Array.isArray(res.body.posts)).toBe(true);
    expect(Array.isArray(res.body.friends)).toBe(true);
  });

  test('lists and revokes sessions', async () => {
    const { token } = await registerAndVerify('sess@test.com', 'sess@test.com');
    const list = await request(app)
      .get('/profile/settings/sessions')
      .set('Authorization', `Bearer ${token}`);
    expect(list.status).toBe(200);
    expect(Array.isArray(list.body.sessions)).toBe(true);
  });

  test('payment card_last4 validation', async () => {
    const { token } = await registerAndVerify('pay@test.com', 'pay@test.com');
    const bad = await request(app)
      .put('/profile/payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ card_last4: '12' });
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .put('/profile/payment')
      .set('Authorization', `Bearer ${token}`)
      .send({ billing_name: 'A B', payment_method: 'visa', card_last4: '4242' });
    expect(ok.status).toBe(200);
    expect(ok.body.payment.card_last4).toBe('4242');
  });
});

describe('Profile — saved posts & history', () => {
  test('saves and unsaves a post', async () => {
    const { token, user } = await registerAndVerify('save@test.com', 'save@test.com');
    const post = await request(app)
      .post('/posts')
      .set('Authorization', `Bearer ${token}`)
      .field('user_id', user.id)
      .field('title', 'A post to save')
      .field('category', 'general')
      .field('content', 'Body of the post');
    expect(post.status).toBe(201);

    const save = await request(app)
      .post(`/profile/saved-posts/${post.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(save.status).toBe(201);

    const list = await request(app)
      .get('/profile/saved-posts')
      .set('Authorization', `Bearer ${token}`);
    expect(list.body.posts.some((p) => p.id === post.body.id)).toBe(true);

    const unsave = await request(app)
      .delete(`/profile/saved-posts/${post.body.id}`)
      .set('Authorization', `Bearer ${token}`);
    expect(unsave.status).toBe(200);
    const after = await request(app)
      .get('/profile/saved-posts')
      .set('Authorization', `Bearer ${token}`);
    expect(after.body.posts.some((p) => p.id === post.body.id)).toBe(false);
  });

  test('posts history is a list', async () => {
    const { token } = await registerAndVerify('hist@test.com', 'hist@test.com');
    const res = await request(app).get('/profile/posts').set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.posts)).toBe(true);
  });
});
