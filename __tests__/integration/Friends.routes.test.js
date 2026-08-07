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

async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

describe('Friends — full flow', () => {
  test('sends a request, appears in received, then accept makes both friends', async () => {
    const alice = await registerAndVerify('fralice', 'fralice@test.com');
    const bob = await registerAndVerify('frbob', 'frbob@test.com');

    const sent = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });
    expect(sent.status).toBe(201);

    const received = await request(app)
      .get('/friends/requests?tab=received')
      .set('Authorization', `Bearer ${bob.token}`);
    expect(received.status).toBe(200);
    expect(received.body.requests.some((r) => r.user.id === alice.user.id)).toBe(true);

    const requestId = received.body.requests.find((r) => r.user.id === alice.user.id).request_id;
    const accept = await request(app)
      .post('/friends/accept')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ request_id: requestId });
    expect(accept.status).toBe(200);

    const list = await request(app).get('/friends').set('Authorization', `Bearer ${alice.token}`);
    expect(list.body.friends.some((f) => f.id === bob.user.id)).toBe(true);
  });

  test('declines a request', async () => {
    const alice = await registerAndVerify('fa1@test.com', 'fa1@test.com');
    const bob = await registerAndVerify('fb1@test.com', 'fb1@test.com');

    await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ receiver_id: bob.user.id });

    const received = await request(app)
      .get('/friends/requests?tab=received')
      .set('Authorization', `Bearer ${bob.token}`);
    const requestId = received.body.requests[0].request_id;

    const decl = await request(app)
      .post('/friends/decline')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ request_id: requestId });
    expect(decl.status).toBe(200);

    const list = await request(app).get('/friends').set('Authorization', `Bearer ${alice.token}`);
    expect(list.body.friends.some((f) => f.id === bob.user.id)).toBe(false);
  });

  test('rejects request with missing receiver_id', async () => {
    const { token } = await registerAndVerify('norec@test.com', 'norec@test.com');
    const res = await request(app)
      .post('/friends/request')
      .set('Authorization', `Bearer ${token}`)
      .send({});
    expect(res.status).toBe(400);
  });

  test('requires auth for friend list', async () => {
    const res = await request(app).get('/friends');
    expect(res.status).toBe(401);
  });

  test('unfriends a friend', async () => {
    const alice = await registerAndVerify('ufa@test.com', 'ufa@test.com');
    const bob = await registerAndVerify('ufb@test.com', 'ufb@test.com');
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

    const un = await request(app)
      .delete(`/friends/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(un.status).toBe(200);

    const list = await request(app).get('/friends').set('Authorization', `Bearer ${alice.token}`);
    expect(list.body.friends.some((f) => f.id === bob.user.id)).toBe(false);
  });
});

describe('Friends — search & suggestions', () => {
  test('search only matches real name substrings', async () => {
    const { token } = await registerAndVerify('searcher', 'searcher@test.com');
    await registerAndVerify('Alice', 'alice@test.com');
    await registerAndVerify('Beni', 'beni@test.com');
    await registerAndVerify('Bobi', 'bobi@test.com');

    const res = await request(app)
      .get('/friends/search?q=ali')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.users.every((u) => u.name.toLowerCase().includes('ali'))).toBe(true);
  });

  test('returns empty result for short query', async () => {
    const { token } = await registerAndVerify('short@test.com', 'short@test.com');
    const res = await request(app)
      .get('/friends/search?q=')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body.users).toEqual([]);
  });

  test('suggested friends excludes self and existing friends', async () => {
    const alice = await registerAndVerify('sug1@test.com', 'sug1@test.com');
    const bob = await registerAndVerify('sug2@test.com', 'sug2@test.com');

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

    const res = await request(app)
      .get('/friends/suggested')
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.users.some((u) => u.id === bob.user.id)).toBe(false);
    expect(res.body.users.some((u) => u.id === alice.user.id)).toBe(false);
  });

  test('lists mutual friends route', async () => {
    const alice = await registerAndVerify('mut1@test.com', 'mut1@test.com');
    const bob = await registerAndVerify('mut2@test.com', 'mut2@test.com');
    const res = await request(app)
      .get(`/friends/mutual/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body.users)).toBe(true);
  });
});

describe('Friends — profile & favorite', () => {
  test('gets public profile of another user', async () => {
    const alice = await registerAndVerify('prof1@test.com', 'prof1@test.com');
    const bob = await registerAndVerify('prof2@test.com', 'prof2@test.com');
    const res = await request(app)
      .get(`/friends/users/${bob.user.id}/profile`)
      .set('Authorization', `Bearer ${alice.token}`);
    expect(res.status).toBe(200);
    expect(res.body.profile.id).toBe(bob.user.id);
  });

  test('returns 404 for missing user profile', async () => {
    const { token } = await registerAndVerify('prof3@test.com', 'prof3@test.com');
    const res = await request(app)
      .get('/friends/users/999999/profile')
      .set('Authorization', `Bearer ${token}`);
    expect(res.status).toBe(404);
  });

  test('toggles favorite on a friend', async () => {
    const alice = await registerAndVerify('fav1@test.com', 'fav1@test.com');
    const bob = await registerAndVerify('fav2@test.com', 'fav2@test.com');
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

    const fav = await request(app)
      .post('/friends/favorite')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ friend_id: bob.user.id });
    expect(fav.status).toBe(200);
    expect(fav.body.is_favorite).toBe(true);
  });
});
