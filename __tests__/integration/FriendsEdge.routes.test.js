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

describe('Friends — edge branches', () => {
  test('search returns empty for missing q', async () => {
    const alice = await registerAndVerify('fs@test.com', 'fs@test.com');
    const res = await request(app)
      .get('/friends/search')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  test('user profile lookup (invalid id / not found)', async () => {
    const alice = await registerAndVerify('fp@test.com', 'fp@test.com');
    const bad = await request(app)
      .get('/friends/users/abc/profile')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(bad.status).toBe(400);

    const miss = await request(app)
      .get('/friends/users/999999/profile')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(miss.status).toBe(404);
  });

  test('sendRequest rejects self / duplicate / already friends / reverse-pending', async () => {
    const alice = await registerAndVerify('f1@test.com', 'f1@test.com');
    const bob = await registerAndVerify('f2@test.com', 'f2@test.com');

    const self = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: alice.user.id });
    expect(self.status).toBe(400);

    const first = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });
    expect(first.status).toBe(201);

    const dup = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });
    expect(dup.status).toBe(409);

    const reverse = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ receiver_id: alice.user.id });
    expect(reverse.status).toBe(409);

    const received = await request(app)
      .get('/friends/requests?tab=received')
      .set('Authorization', `Bearer ${bob.token}`);
    await request(app)
      .post('/friends/accept')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ request_id: received.body.requests[0].request_id });

    const alreadydFriends = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });
    expect(alreadydFriends.status).toBe(409);
  });

  test('request/accept/decline require request_id', async () => {
    const alice = await registerAndVerify('f3@test.com', 'f3@test.com');
    const r1 = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(r1.status).toBe(400);
    const r2 = await request(app)
      .post('/friends/accept')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(r2.status).toBe(400);
    const r3 = await request(app)
      .post('/friends/decline')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(r3.status).toBe(400);
  });

  test('decline removes pending request', async () => {
    const alice = await registerAndVerify('f4@test.com', 'f4@test.com');
    const bob = await registerAndVerify('f5@test.com', 'f5@test.com');
    await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });
    const received = await request(app)
      .get('/friends/requests?tab=received')
      .set('Authorization', `Bearer ${bob.token}`);
    const dec = await request(app)
      .post('/friends/decline')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ request_id: received.body.requests[0].request_id });
    expect(dec.status).toBe(200);
  });

  test('unfriend removes friendship (invalid id 400)', async () => {
    const alice = await registerAndVerify('f6@test.com', 'f6@test.com');
    const bob = await registerAndVerify('f7@test.com', 'f7@test.com');
    await becomeFriends(alice, bob);

    const bad = await request(app)
      .delete('/friends/abc')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(bad.status).toBe(400);

    const ok = await request(app)
      .delete(`/friends/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(ok.status).toBe(200);

    const friends = await request(app)
      .get('/friends')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(friends.body.friends.find((x) => x.id === bob.user.id)).toBeUndefined();
  });

  test('favorite toggles and requires friend_id', async () => {
    const alice = await registerAndVerify('f8@test.com', 'f8@test.com');
    const missing = await request(app)
      .post('/friends/favorite')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({});
    expect(missing.status).toBe(400);

    const bob = await registerAndVerify('f9@test.com', 'f9@test.com');
    await becomeFriends(alice, bob);

    const fav = await request(app)
      .post('/friends/favorite')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ friend_id: bob.user.id });
    expect(fav.status).toBe(200);

    const unfav = await request(app)
      .post('/friends/favorite')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ friend_id: bob.user.id });
    expect(unfav.status).toBe(200);
  });

  test('mutual list with invalid id and real mutual friend', async () => {
    const alice = await registerAndVerify('f10@test.com', 'f10@test.com');
    const bob = await registerAndVerify('f11@test.com', 'f11@test.com');
    const carol = await registerAndVerify('f12@test.com', 'f12@test.com');
    await becomeFriends(alice, bob);
    await becomeFriends(alice, carol);
    await becomeFriends(bob, carol);

    const bad = await request(app)
      .get('/friends/mutual/abc')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(bad.status).toBe(400);

    const mutual = await request(app)
      .get(`/friends/mutual/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(mutual.status).toBe(200);
    expect(mutual.body.users.some((u) => u.id === carol.user.id)).toBe(true);
  });

  test('suggested friends returns list (empty ok)', async () => {
    const alice = await registerAndVerify('f13@test.com', 'f13@test.com');
    const res = await request(app)
      .get('/friends/suggested')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });

  test('requests sent tab', async () => {
    const alice = await registerAndVerify('f14@test.com', 'f14@test.com');
    const bob = await registerAndVerify('f15@test.com', 'f15@test.com');
    await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });

    const sent = await request(app)
      .get('/friends/requests?tab=sent')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(sent.status).toBe(200);
    expect(sent.body.requests.length).toBe(1);
    expect(sent.body.requests[0].user.id).toBe(bob.user.id);
  });
});
