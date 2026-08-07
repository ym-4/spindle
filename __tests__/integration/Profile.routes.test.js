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
    const alice = await registerAndVerify('ps@test.com', 'ps@test.com');
    const res = await request(app)
      .get('/profile/settings')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.settings.id).toBe(alice.user.id);
  });

  test('account settings require current password when changing protected fields', async () => {
    const alice = await registerAndVerify('acc@test.com', 'acc@test.com');
    const res = await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ display_name: 'NewName' });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('Current password');

    const ok = await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ display_name: 'NewName', current_password: 'secret1' });
    expect(ok.status).toBe(200);
    expect(ok.body.settings.display_name).toBe('NewName');
  });

  test('wrong current password rejected', async () => {
    const alice = await registerAndVerify('wrpw@test.com', 'wrpw@test.com');
    const res = await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ display_name: 'X', current_password: 'nope' });
    expect(res.status).toBe(401);
  });

  test('display name change cooldown rejected (429)', async () => {
    const alice = await registerAndVerify('cd@test.com', 'cd@test.com');
    await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ display_name: 'First', current_password: 'secret1' });
    const res = await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ display_name: 'Second', current_password: 'secret1' });
    expect(res.status).toBe(429);
  });

  test('security/notifications/appearance/privacy settings update', async () => {
    const alice = await registerAndVerify('sec@test.com', 'sec@test.com');
    const tok = { Authorization: `Bearer ${alice.token}` };
    const sec = await request(app)
      .put('/profile/settings/security')
      .set(tok)
      .send({ two_factor_enabled: true });
    expect(sec.status).toBe(200);
    const notif = await request(app)
      .put('/profile/settings/notifications')
      .set(tok)
      .send({ notify_email: false });
    expect(notif.status).toBe(200);
    const appear = await request(app)
      .put('/profile/settings/appearance')
      .set(tok)
      .send({ theme: 'dark' });
    expect(appear.status).toBe(200);
    expect(appear.body.settings.theme).toBe('dark');
    const priv = await request(app)
      .put('/profile/settings/privacy')
      .set(tok)
      .send({ public_profile: false });
    expect(priv.status).toBe(200);
  });

  test('account settings update email and bio', async () => {
    const alice = await registerAndVerify('bio@test.com', 'bio@test.com');
    const res = await request(app)
      .put('/profile/settings/account')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ current_password: 'secret1', email: 'newmail@test.com', bio: 'hi' });
    expect(res.status).toBe(200);
    expect(res.body.settings.email).toBe('newmail@test.com');
  });
});

describe('Profile — password flow', () => {
  test('request-code sends code', async () => {
    const alice = await registerAndVerify('pwreq@test.com', 'pwreq@test.com');
    const res = await request(app)
      .post('/profile/settings/password/request-code')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.previewCode).toBeDefined();
  });

  test('password change full flow with code + wrong current', async () => {
    const alice = await registerAndVerify('pwch@test.com', 'pwch@test.com');
    const codeReq = await request(app)
      .post('/profile/settings/password/request-code')
      .set('Authorization', `Bearer ${alice.token}`);
    const code = codeReq.body.previewCode;

    const ok = await request(app)
      .put('/profile/settings/password')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        current_password: 'secret1',
        new_password: 'secret2',
        new_password_confirm: 'secret2',
        code,
      });
    expect(ok.status).toBe(200);

    const newCodeReq = await request(app)
      .post('/profile/settings/password/request-code')
      .set('Authorization', `Bearer ${alice.token}`);
    const wrong = await request(app)
      .put('/profile/settings/password')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({
        current_password: 'wrong',
        new_password: 'secret3',
        new_password_confirm: 'secret3',
        code: newCodeReq.body.previewCode,
      });
    expect(wrong.status).toBe(401);
  });

  test('password change rejects missing fields / mismatch / short / bad code', async () => {
    const alice = await registerAndVerify('pwx@test.com', 'pwx@test.com');
    const tok = { Authorization: `Bearer ${alice.token}` };
    const missing = await request(app)
      .put('/profile/settings/password')
      .set(tok)
      .send({ current_password: 'secret1' });
    expect(missing.status).toBe(400);

    const short = await request(app).put('/profile/settings/password').set(tok).send({
      current_password: 'secret1',
      new_password: 'abc',
      new_password_confirm: 'abc',
      code: '123456',
    });
    expect(short.status).toBe(400);

    const mismatch = await request(app).put('/profile/settings/password').set(tok).send({
      current_password: 'secret1',
      new_password: 'longpass',
      new_password_confirm: 'other',
      code: '123456',
    });
    expect(mismatch.status).toBe(400);

    const badCode = await request(app).put('/profile/settings/password').set(tok).send({
      current_password: 'secret1',
      new_password: 'longpass',
      new_password_confirm: 'longpass',
      code: '999999',
    });
    expect(badCode.status).toBe(400);
  });
});

describe('Profile — sessions & lifecycle', () => {
  test('list/revoke sessions incl 404', async () => {
    const alice = await registerAndVerify('sess@test.com', 'sess@test.com');
    const list = await request(app)
      .get('/profile/settings/sessions')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(list.status).toBe(200);

    const miss = await request(app)
      .delete('/profile/settings/sessions/999999')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(miss.status).toBe(404);
  });

  test('export user data', async () => {
    const alice = await registerAndVerify('exp@test.com', 'exp@test.com');
    const res = await request(app)
      .get('/profile/settings/export')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.id).toBe(alice.user.id);
  });

  test('delete requires DELETE confirm', async () => {
    const alice = await registerAndVerify('del@test.com', 'del@test.com');
    const no = await request(app)
      .post('/profile/settings/delete')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(no.status).toBe(400);
    const ok = await request(app)
      .post('/profile/settings/delete')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ confirm: 'DELETE' });
    expect(ok.status).toBe(200);
  });

  test('deactivate + payment details', async () => {
    const alice = await registerAndVerify('pay@test.com', 'pay@test.com');
    const tok = { Authorization: `Bearer ${alice.token}` };

    const bad = await request(app).put('/profile/payment').set(tok).send({ card_last4: '12' });
    expect(bad.status).toBe(400);

    const pay = await request(app)
      .put('/profile/payment')
      .set(tok)
      .send({ billing_name: 'Alice', payment_method: 'visa', card_last4: '4242' });
    expect(pay.status).toBe(200);
    expect(pay.body.payment.card_last4).toBe('4242');

    const get = await request(app).get('/profile/payment').set(tok);
    expect(get.status).toBe(200);

    const deact = await request(app).post('/profile/settings/deactivate').set(tok);
    expect(deact.status).toBe(200);
  });

  test('saved-posts and posts history', async () => {
    const alice = await registerAndVerify('save@test.com', 'save@test.com');
    const tok = { Authorization: `Bearer ${alice.token}` };

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content) VALUES ($1, 'My Post', 'general', 'body') RETURNING id`,
      [alice.user.id],
    );
    const postId = rows[0].id;

    const saved = await request(app).post(`/profile/saved-posts/${postId}`).set(tok);
    expect(saved.status).toBe(201);

    const list = await request(app).get('/profile/saved-posts').set(tok);
    expect(list.status).toBe(200);
    expect(list.body.posts.length).toBe(1);

    const empty = await request(app).get('/profile/posts').set(tok);
    expect(empty.status).toBe(200);
    expect(empty.body.posts.length).toBe(1);

    const miss = await request(app).delete('/profile/saved-posts/999999').set(tok);
    expect(miss.status).toBe(404);
  });

  test('saved-posts invalid id or missing post', async () => {
    const alice = await registerAndVerify('save2@test.com', 'save2@test.com');
    const tok = { Authorization: `Bearer ${alice.token}` };
    const badId = await request(app).post('/profile/saved-posts/abc').set(tok);
    expect(badId.status).toBe(400);
    const miss = await request(app).post('/profile/saved-posts/999999').set(tok);
    expect(miss.status).toBe(404);
  });

  test('groups listing requires registered user', async () => {
    const alice = await registerAndVerify('grp@test.com', 'grp@test.com');
    const res = await request(app)
      .get('/profile/groups')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.groups)).toBe(true);
  });
});
