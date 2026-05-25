const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.

beforeEach(async () => {
  // Clean slate for every test
  await pool.query('DELETE FROM "PersonalMessages"');
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "PersonalMessages"');
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helper ───────────────────────────────────────────────
async function seedPersons() {
  await pool.query(
    `INSERT INTO "Person" ("email","name") VALUES
      ('alice@example.com','Alice'),
      ('bob@example.com','Bob')`,
  );
}

async function seedSomethings() {
  await pool.query(`INSERT INTO "Something" ("name") VALUES ('Seed 1'),('Seed 2')`);
}

// ─────────────────────────────────────────────────────────
// GET /persons
// ─────────────────────────────────────────────────────────
describe('GET /persons', () => {
  // Boundary: zero rows – empty table returns empty array
  test('should return 200 and an empty array when no persons exist', async () => {
    const res = await request(app).get('/persons');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: seeded data returns all rows with expected fields
  test('should return 200 and all persons', async () => {
    await seedPersons();

    const res = await request(app).get('/persons');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('email');
    expect(res.body[0]).toHaveProperty('name');
  });
});

// ─────────────────────────────────────────────────────────
// GET /somethings
// ─────────────────────────────────────────────────────────
describe('GET /somethings', () => {
  // Boundary: zero rows – empty table returns empty array
  test('should return 200 and an empty array when none exist', async () => {
    const res = await request(app).get('/somethings');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: seeded data returns all rows with expected fields
  test('should return 200 and all somethings', async () => {
    await seedSomethings();

    const res = await request(app).get('/somethings');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });
});

// ─────────────────────────────────────────────────────────
// POST /somethings
// ─────────────────────────────────────────────────────────
describe('POST /somethings', () => {
  // Valid partition: valid name creates and returns the new record
  test('should return 201 and the created something', async () => {
    const res = await request(app).post('/somethings').send({ name: 'cheese' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.name).toBe('cheese');
  });

  // Valid partition: verify data persists in DB after creation
  test('created something should be persisted in the database', async () => {
    await request(app).post('/somethings').send({ name: 'milk' });

    const res = await request(app).get('/somethings');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('milk');
  });
});

// ─────────────────────────────────────────────────────────
// PUT /somethings/:id
// ─────────────────────────────────────────────────────────
describe('PUT /somethings/:id', () => {
  // Valid partition: update an existing record with a valid name
  test('should return 200 and the updated something', async () => {
    // Create one first
    const createRes = await request(app).post('/somethings').send({ name: 'original' });
    const id = createRes.body.id;

    const res = await request(app).put(`/somethings/${id}`).send({ name: 'updated' });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('updated');
  });

  // Valid partition: verify updated value persists when retrieved
  test('updated value should persist when retrieved', async () => {
    const createRes = await request(app).post('/somethings').send({ name: 'before' });
    const id = createRes.body.id;

    await request(app).put(`/somethings/${id}`).send({ name: 'after' });

    const getRes = await request(app).get('/somethings');
    const item = getRes.body.find((s) => s.id === id);

    expect(item.name).toBe('after');
  });

  // Boundary: non-existent id – large id that doesn't match any row
  test('should return 404 for non-existing id (boundary)', async () => {
    const res = await request(app).put('/somethings/999999').send({ name: 'ghost' });

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /somethings/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /somethings/:id', () => {
  // Valid partition: delete an existing record and return it
  test('should return 200 and the deleted something', async () => {
    const createRes = await request(app).post('/somethings').send({ name: 'doomed' });
    const id = createRes.body.id;

    const res = await request(app).delete(`/somethings/${id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(id);
    expect(res.body.name).toBe('doomed');
  });

  // Valid partition: verify deleted item is no longer retrievable
  test('deleted item should no longer appear in GET', async () => {
    const createRes = await request(app).post('/somethings').send({ name: 'temporary' });
    const id = createRes.body.id;

    await request(app).delete(`/somethings/${id}`);

    const getRes = await request(app).get('/somethings');
    const ids = getRes.body.map((s) => s.id);

    expect(ids).not.toContain(id);
  });

  // Valid partition: other records remain unaffected after deleting one
  test('other items should remain after deleting one', async () => {
    await request(app).post('/somethings').send({ name: 'keep' });
    const deleteRes = await request(app).post('/somethings').send({ name: 'remove' });
    const removeId = deleteRes.body.id;

    await request(app).delete(`/somethings/${removeId}`);

    const getRes = await request(app).get('/somethings');

    expect(getRes.body).toHaveLength(1);
    expect(getRes.body[0].name).toBe('keep');
  });

  // Boundary: non-existent id – large id that doesn't match any row
  test('should return 404 for non-existing id (boundary)', async () => {
    const res = await request(app).delete('/somethings/999999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
  });
});

// ─────────────────────────────────────────────────────────
// Auth
// ─────────────────────────────────────────────────────────
describe('POST /auth/register', () => {
  test('should register a new user and return a JWT', async () => {
    const res = await request(app).post('/auth/register').send({
      name: 'testuser',
      email: 'test@example.com',
      password: 'secret',
    });

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({
      name: 'testuser',
      email: 'test@example.com',
      role: 'user',
    });
    expect(res.body.user).toHaveProperty('id');
    expect(res.body.user).not.toHaveProperty('hashed_password');
    expect(res.body).toHaveProperty('token');
    expect(typeof res.body.token).toBe('string');
  });

  test('should return 409 when username is taken', async () => {
    await request(app).post('/auth/register').send({
      name: 'dupuser',
      email: 'dup1@example.com',
      password: 'secret',
    });

    const res = await request(app).post('/auth/register').send({
      name: 'dupuser',
      email: 'dup2@example.com',
      password: 'secret',
    });

    expect(res.status).toBe(409);
    expect(res.body.error).toMatch(/username/i);
  });
});

describe('POST /auth/login', () => {
  test('should log in with valid credentials', async () => {
    await request(app).post('/auth/register').send({
      name: 'loginuser',
      email: 'login@example.com',
      password: 'mypass',
    });

    const res = await request(app).post('/auth/login').send({
      username: 'loginuser',
      password: 'mypass',
    });

    expect(res.status).toBe(200);
    expect(res.body.user.name).toBe('loginuser');
    expect(res.body.user.role).toBe('user');
    expect(res.body).toHaveProperty('token');
  });

  test('should return 401 for invalid password', async () => {
    await request(app).post('/auth/register').send({
      name: 'badlogin',
      email: 'badlogin@example.com',
      password: 'correct',
    });

    const res = await request(app).post('/auth/login').send({
      username: 'badlogin',
      password: 'wrong',
    });

    expect(res.status).toBe(401);
    expect(res.body.error).toMatch(/invalid/i);
  });
});

describe('GET /auth/me', () => {
  test('should return profile with stats when JWT is valid', async () => {
    const registerRes = await request(app).post('/auth/register').send({
      name: 'profileuser',
      email: 'profile@example.com',
      password: 'secret',
    });
    const token = registerRes.body.token;

    const res = await request(app)
      .get('/auth/me')
      .set('Authorization', `Bearer ${token}`);

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('profileuser');
    expect(res.body.stats).toMatchObject({
      posts: 0,
      comments: 0,
      friends: 0,
      groups: 0,
      marketplace_items: 0,
    });
  });

  test('should return 401 without a token', async () => {
    const res = await request(app).get('/auth/me');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });
});

describe('GET /auth/admin/users', () => {
  const { hashPassword } = require('../../src/models/Auth.model');

  async function seedAdmin() {
    const hashed = hashPassword('adminpass');
    await pool.query(
      `INSERT INTO "Person" (email, name, hashed_password, role)
       VALUES ('admin@test.com', 'TestAdmin', $1, 'admin')`,
      [hashed],
    );
  }

  test('should return all users for admin', async () => {
    await seedAdmin();
    const loginRes = await request(app).post('/auth/login').send({
      username: 'TestAdmin',
      password: 'adminpass',
    });

    const res = await request(app)
      .get('/auth/admin/users')
      .set('Authorization', `Bearer ${loginRes.body.token}`);

    expect(res.status).toBe(200);
    expect(res.body.users.length).toBeGreaterThanOrEqual(1);
    expect(res.body.users.some((u) => u.role === 'admin')).toBe(true);
  });

  test('should return 403 for regular users', async () => {
    const registerRes = await request(app).post('/auth/register').send({
      name: 'regularuser',
      email: 'regular@example.com',
      password: 'secret',
    });

    const res = await request(app)
      .get('/auth/admin/users')
      .set('Authorization', `Bearer ${registerRes.body.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/admin/i);
  });
});

// ─────────────────────────────────────────────────────────
// Personal messages
// ─────────────────────────────────────────────────────────
describe('Personal messages', () => {
  async function registerUser(name, email) {
    const res = await request(app).post('/auth/register').send({
      name,
      email,
      password: 'secret',
    });
    return { user: res.body.user, token: res.body.token };
  }

  test('user A can send a message and sees it as sent; user B sees it as received', async () => {
    const alice = await registerUser('AliceChat', 'alicechat@example.com');
    const bob = await registerUser('BobChat', 'bobchat@example.com');

    const sendRes = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id, body: 'Hey Bob, want to study?' });

    expect(sendRes.status).toBe(201);
    expect(sendRes.body.message).toMatchObject({
      sender_id: alice.user.id,
      recipient_id: bob.user.id,
      body: 'Hey Bob, want to study?',
    });

    const aliceView = await request(app)
      .get(`/messages/with/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(aliceView.status).toBe(200);
    expect(aliceView.body.messages).toHaveLength(1);
    expect(aliceView.body.messages[0].sender_id).toBe(alice.user.id);
    expect(aliceView.body.messages[0].recipient_id).toBe(bob.user.id);

    const bobView = await request(app)
      .get(`/messages/with/${alice.user.id}`)
      .set('Authorization', `Bearer ${bob.token}`);

    expect(bobView.status).toBe(200);
    expect(bobView.body.messages).toHaveLength(1);
    expect(bobView.body.messages[0].sender_id).toBe(alice.user.id);
    expect(bobView.body.messages[0].recipient_id).toBe(bob.user.id);
    expect(bobView.body.messages[0].body).toBe('Hey Bob, want to study?');
  });

  test('both users can exchange multiple messages in order', async () => {
    const alice = await registerUser('MsgAlice', 'msgalice@example.com');
    const bob = await registerUser('MsgBob', 'msgbob@example.com');

    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ recipientId: bob.user.id, body: 'First from Alice' });

    await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${bob.token}`)
      .send({ recipientId: alice.user.id, body: 'Reply from Bob' });

    const aliceView = await request(app)
      .get(`/messages/with/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(aliceView.body.messages).toHaveLength(2);
    expect(aliceView.body.messages[0].body).toBe('First from Alice');
    expect(aliceView.body.messages[1].body).toBe('Reply from Bob');
    expect(aliceView.body.messages[0].sender_id).toBe(alice.user.id);
    expect(aliceView.body.messages[1].sender_id).toBe(bob.user.id);
  });

  test('should return 400 when messaging yourself', async () => {
    const user = await registerUser('SoloChat', 'solochat@example.com');

    const res = await request(app)
      .post('/messages')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ recipientId: user.user.id, body: 'Hello me' });

    expect(res.status).toBe(400);
    expect(res.body.error).toMatch(/yourself/i);
  });

  test('should return 401 without a token', async () => {
    const res = await request(app).get('/messages/contacts');

    expect(res.status).toBe(401);
    expect(res.body).toHaveProperty('error');
  });

  test('contacts list excludes the logged-in user', async () => {
    const alice = await registerUser('ContactAlice', 'contactalice@example.com');
    await registerUser('ContactBob', 'contactbob@example.com');

    const res = await request(app)
      .get('/messages/contacts')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.contacts.some((c) => c.id === alice.user.id)).toBe(false);
    expect(res.body.contacts.some((c) => c.name === 'ContactBob')).toBe(true);
  });
});

// ─────────────────────────────────────────────────────────
// Profile features (settings, friends, posts, groups, chatroom)
// ─────────────────────────────────────────────────────────
describe('Profile features', () => {
  async function registerUser(name, email) {
    const res = await request(app).post('/auth/register').send({
      name,
      email,
      password: 'secret',
    });
    return { user: res.body.user, token: res.body.token };
  }

  async function insertPost(userId, title) {
    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, $2, 'general', 'Test content') RETURNING id`,
      [userId, title],
    );
    return rows[0].id;
  }

  test('GET/PUT settings stores personal info', async () => {
    const user = await registerUser('SettingsUser', 'settings@example.com');

    const putRes = await request(app)
      .put('/profile/settings')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ bio: 'Hello campus', campus: 'SP', phone: '80001111' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.settings.bio).toBe('Hello campus');
    expect(putRes.body.settings.campus).toBe('SP');

    const getRes = await request(app)
      .get('/profile/settings')
      .set('Authorization', `Bearer ${user.token}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.settings.bio).toBe('Hello campus');
  });

  test('GET/PUT payment stores marketplace payment details', async () => {
    const user = await registerUser('PayUser', 'pay@example.com');

    const putRes = await request(app)
      .put('/profile/payment')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ billing_name: 'Pay User', payment_method: 'card', card_last4: '1234' });

    expect(putRes.status).toBe(200);
    expect(putRes.body.payment).toMatchObject({
      billing_name: 'Pay User',
      payment_method: 'card',
      card_last4: '1234',
    });
  });

  test('can add and remove friends', async () => {
    const alice = await registerUser('FriendAlice', 'falice@example.com');
    const bob = await registerUser('FriendBob', 'fbob@example.com');

    const addRes = await request(app)
      .post('/profile/friends')
      .set('Authorization', `Bearer ${alice.token}`)
      .send({ friendId: bob.user.id });

    expect(addRes.status).toBe(201);
    expect(addRes.body.friends.some((f) => f.id === bob.user.id)).toBe(true);

    const removeRes = await request(app)
      .delete(`/profile/friends/${bob.user.id}`)
      .set('Authorization', `Bearer ${alice.token}`);

    expect(removeRes.status).toBe(200);
    expect(removeRes.body.friends.some((f) => f.id === bob.user.id)).toBe(false);
  });

  test('can save and unsave posts; list saved posts', async () => {
    const alice = await registerUser('SaveAlice', 'savealice@example.com');
    const bob = await registerUser('SaveBob', 'savebob@example.com');
    const postId = await insertPost(bob.user.id, 'Post to save');

    await request(app)
      .post(`/profile/saved-posts/${postId}`)
      .set('Authorization', `Bearer ${alice.token}`);

    const listRes = await request(app)
      .get('/profile/saved-posts')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.posts).toHaveLength(1);
    expect(listRes.body.posts[0].title).toBe('Post to save');

    await request(app)
      .delete(`/profile/saved-posts/${postId}`)
      .set('Authorization', `Bearer ${alice.token}`);

    const afterRes = await request(app)
      .get('/profile/saved-posts')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(afterRes.body.posts).toHaveLength(0);
  });

  test('post history returns user posts', async () => {
    const user = await registerUser('HistoryUser', 'history@example.com');
    await insertPost(user.user.id, 'My wall post');

    const res = await request(app)
      .get('/profile/posts')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.posts).toHaveLength(1);
    expect(res.body.posts[0].title).toBe('My wall post');
  });

  test('lists joined study groups', async () => {
    const alice = await registerUser('GroupAlice', 'galice@example.com');
    const { rows } = await pool.query(
      `INSERT INTO "Groups" (name, creator_id, description, school, module)
       VALUES ('Test Group', $1, 'Desc', 'SP', 'MOD') RETURNING id`,
      [alice.user.id],
    );
    await pool.query(
      `INSERT INTO "GroupMembers" (group_id, user_id, role) VALUES ($1, $2, 'user')`,
      [rows[0].id, alice.user.id],
    );

    const res = await request(app)
      .get('/profile/groups')
      .set('Authorization', `Bearer ${alice.token}`);

    expect(res.status).toBe(200);
    expect(res.body.groups).toHaveLength(1);
    expect(res.body.groups[0].name).toBe('Test Group');
  });

  test('chatroom messages can be posted and listed', async () => {
    const user = await registerUser('ChatUser', 'chat@example.com');

    const postRes = await request(app)
      .post('/profile/chatroom')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ message: 'Hello chatroom!' });

    expect(postRes.status).toBe(201);

    const listRes = await request(app)
      .get('/profile/chatroom')
      .set('Authorization', `Bearer ${user.token}`);

    expect(listRes.status).toBe(200);
    expect(listRes.body.messages.some((m) => m.message === 'Hello chatroom!')).toBe(true);
  });

  test('profile endpoints require authentication', async () => {
    const res = await request(app).get('/profile/friends');
    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────
// 404 handling
// ─────────────────────────────────────────────────────────
describe('Unknown routes', () => {
  // Invalid partition: GET to a non-existent route
  test('GET /unknown should return 404', async () => {
    const res = await request(app).get('/unknown');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toMatch(/Unknown resource/);
  });

  // Invalid partition: POST to a non-existent route
  test('POST /unknown should return 404', async () => {
    const res = await request(app).post('/unknown').send({});

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/Unknown resource/);
  });
});
