const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.

beforeEach(async () => {
  // Clean slate for every test
  await pool.query('DELETE FROM "PollVotes"');
  await pool.query('DELETE FROM "PollOptions"');
  await pool.query('DELETE FROM "PostPolls"');
  await pool.query('DELETE FROM "PostReactions"');
  await pool.query('DELETE FROM "SavedPosts"');
  await pool.query('DELETE FROM "Posts"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "PollVotes"');
  await pool.query('DELETE FROM "PollOptions"');
  await pool.query('DELETE FROM "PostPolls"');
  await pool.query('DELETE FROM "PostReactions"');
  await pool.query('DELETE FROM "SavedPosts"');
  await pool.query('DELETE FROM "Posts"');
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

async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function loginAndVerify(username, password, rememberMe = false) {
  const login = await request(app).post('/auth/login').send({ username, password });
  if (login.body.needs2FA) {
    const verify = await request(app).post('/auth/verify-login').send({
      email: login.body.email,
      code: login.body.previewCode,
      remember_me: rememberMe,
    });
    return {
      user: verify.body.user,
      token: verify.body.token,
      remember_token: verify.body.remember_token,
    };
  }
  return { user: login.body.user, token: login.body.token };
}

async function makeFriends(alice, bob) {
  await request(app)
    .post('/friends/request')
    .set('Authorization', `Bearer ${alice.token}`)
    .send({ receiver_id: bob.user.id });
  const reqs = await request(app)
    .get('/friends/requests?tab=received')
    .set('Authorization', `Bearer ${bob.token}`);
  const requestId = reqs.body.requests[0].request_id;
  await request(app)
    .post('/friends/accept')
    .set('Authorization', `Bearer ${bob.token}`)
    .send({ request_id: requestId });
}

// ─────────────────────────────────────────────────────────
// GET /posts
// ─────────────────────────────────────────────────────────
describe('GET /posts', () => {
  // Boundary: zero rows – empty table returns an empty array
  test('should return 200 and an empty array when no posts exist', async () => {
    const res = await request(app).get('/posts');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: existing posts are returned
  test('should return 200 and all posts', async () => {
    const user = await registerAndVerify('PostAuthor', 'postauthor@example.com');

    await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1,'First Post','general','Hello World'),
      ($1,'Second Post','qna','Need help')`,
      [user.user.id],
    );

    const res = await request(app).get('/posts');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('title');
    expect(res.body[0]).toHaveProperty('category');
    expect(res.body[0]).toHaveProperty('content');
    expect(res.body[0]).toHaveProperty('user_id');
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/tag/:category
// ─────────────────────────────────────────────────────────
describe('GET /posts/tag/:category', () => {
  // Valid partition: returns only posts belonging to the category
  test('should return 200 and an empty array when the category has no posts', async () => {
    const user = await registerAndVerify('CategoryUser', 'category@example.com');

    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES
       ($1, 'General Post', 'general', 'General content'),
       ($1, 'Question', 'qna', 'Question content'),
       ($1, 'Another General', 'general', 'More content')`,
      [user.user.id],
    );

    const res = await request(app).get('/posts/tag/general');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);

    res.body.forEach((post) => {
      expect(post.category).toBe('general');
    });
  });

  // Boundary: no posts exist for the category
  test('should return 200 and an empty array when no posts match the category', async () => {
    const user = await registerAndVerify('EmptyCategoryUser', 'emptycategory@example.com');

    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'General Post', 'general', 'Content')`,
      [user.user.id],
    );

    const res = await request(app).get('/posts/tag/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: unknown category value
  test('should return 200 and an empty array for an invalid category', async () => {
    const res = await request(app).get('/posts/tag/events');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/:id
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id', () => {
  // Valid partition: existing post id returns the correct post
  test('should return 200 and the requested post', async () => {
    const user = await registerAndVerify('SinglePostUser', 'singlepost@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'My Post', 'general', 'Hello World')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app).get(`/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);
    expect(res.body.title).toBe('My Post');
    expect(res.body.category).toBe('general');
    expect(res.body.content).toBe('Hello World');
    expect(res.body.user_id).toBe(user.user.id);
  });

  // Boundary: non-existent id
  test('should return 404 when the post does not exist', async () => {
    const res = await request(app).get('/posts/999999');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Post not found');
  });

  // Boundary: id = 0
  test('should return 404 for id = 0 (boundary)', async () => {
    const res = await request(app).get('/posts/0');

    expect(res.status).toBe(404);
    expect(res.body).toHaveProperty('error');
    expect(res.body.error).toBe('Post not found');
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/related/:category/:id
// ─────────────────────────────────────────────────────────
describe('GET /posts/related/:category/:id', () => {
  // Valid partition: returns related posts from the same category
  test('should return related posts from the same category', async () => {
    const user = await registerAndVerify('RelatedUser', 'related@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1, 'Current Post', 'general', 'Current'),
      ($1, 'Related One', 'general', 'Related 1'),
      ($1, 'Related Two', 'general', 'Related 2'),
      ($1, 'Different Category', 'qna', 'Not related')
      RETURNING id`,
      [user.user.id],
    );

    const currentPostId = rows[0].id;

    const res = await request(app).get(`/posts/related/general/${currentPostId}`);

    expect(res.status).toBe(200);

    res.body.forEach((post) => {
      expect(post.category).toBe('general');
      expect(post.id).not.toBe(currentPostId);
    });
  });

  // Boundary: no related posts exist
  test('should return an empty array when no related posts exist', async () => {
    const user = await registerAndVerify('LonelyUser', 'lonely@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Only General Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app).get(`/posts/related/general/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Boundary: non-existent post id
  test('should return an empty array for a non-existent post id', async () => {
    const res = await request(app).get('/posts/related/general/999999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts
// ─────────────────────────────────────────────────────────
describe('POST /posts', () => {
  // Valid partition: create a new post successfully
  test('should return 201 and create a new post', async () => {
    const user = await registerAndVerify('CreatePostUser', 'createpost@example.com');

    const res = await request(app)
      .post('/posts')
      .field('user_id', user.user.id)
      .field('title', 'My First Post')
      .field('category', 'general')
      .field('content', 'Hello everyone!');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My First Post');
    expect(res.body.category).toBe('general');
    expect(res.body.content).toBe('Hello everyone!');
    expect(res.body.user_id).toBe(user.user.id);
  });

  // Valid partition: verify created post in the database
  test('created post should be persisted', async () => {
    const user = await registerAndVerify('PersistUser', 'persist@example.com');

    await request(app)
      .post('/posts')
      .field('user_id', user.user.id)
      .field('title', 'Persistent Post')
      .field('category', 'general')
      .field('content', 'Persistence test');

    const res = await request(app).get('/posts');

    expect(res.body).toHaveLength(1);
    expect(res.body[0].title).toBe('Persistent Post');
  });

  // Invalid partition: required fields missing
  test('should return 400 when required fields are missing', async () => {
    const res = await request(app).post('/posts').field('title', 'Incomplete Post');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/undefined/i);
  });
});

// ─────────────────────────────────────────────────────────
// PUT /posts/:id
// ─────────────────────────────────────────────────────────
describe('PUT /posts/:id', () => {
  // Valid partition: update an existing post
  test('should return 200 and update the post', async () => {
    const user = await registerAndVerify('UpdateUser', 'update@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Old Title', 'general', 'Old content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .put(`/posts/${postId}`)
      .field('title', 'New Title')
      .field('category', 'qna')
      .field('content', 'Updated content');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);
    expect(res.body.title).toBe('New Title');
    expect(res.body.category).toBe('qna');
    expect(res.body.content).toBe('Updated content');
  });

  // Valid partition: verify updated values
  test('updated post should persist in the database', async () => {
    const user = await registerAndVerify('PersistUpdateUser', 'persistupdate@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Before', 'general', 'Old content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .put(`/posts/${postId}`)
      .field('title', 'After')
      .field('category', 'news')
      .field('content', 'New content');

    const getRes = await request(app).get(`/posts/${postId}`);

    expect(getRes.status).toBe(200);
    expect(getRes.body.title).toBe('After');
    expect(getRes.body.category).toBe('news');
    expect(getRes.body.content).toBe('New content');
  });

  // Boundary: non-existent id
  test('should return 404 when updating a non-existent post', async () => {
    const res = await request(app)
      .put('/posts/999999')
      .field('title', 'Ghost')
      .field('category', 'general')
      .field('content', 'Ghost content');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/post not found/i);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/:id', () => {
  // Valid partition: owner deletes their own post
  test('should return 200 and delete the post', async () => {
    const user = await registerAndVerify('DeleteOwner', 'deleteowner@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Delete Me', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);

    const check = await request(app).get(`/posts/${postId}`);

    expect(check.status).toBe(404);
  });

  // Invalid partition: authenticated user is not the owner
  test("should return 403 when deleting another user's post", async () => {
    const owner = await registerAndVerify('PostOwner', 'owner@example.com');

    const stranger = await registerAndVerify('OtherUser', 'other@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Protected Post', 'general', 'Content')
      RETURNING id`,
      [owner.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .delete(`/posts/${postId}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  // Boundary: non-existent id
  test('should return 404 when deleting a non-existent post', async () => {
    const user = await registerAndVerify('GhostDelete', 'ghostdelete@example.com');

    const res = await request(app)
      .delete('/posts/999999')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/post not found/i);
  });
});

// ─────────────────────────────────────────────────────────
// GET /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/poll', () => {
  // Valid partition: poll exists and returns question with options
  test('should return 200 and the poll with its options', async () => {
    const user = await registerAndVerify('PollOwner', 'pollowner@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = postRows[0].id;

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls"
      (post_id, question)
      VALUES ($1, 'Favourite language?')
      RETURNING id`,
      [postId],
    );

    const pollId = pollRows[0].id;

    await pool.query(
      `INSERT INTO "PollOptions"
      (poll_id, option_text)
      VALUES
      ($1,'JavaScript'),
      ($1,'Python')`,
      [pollId],
    );

    const res = await request(app).get(`/posts/${postId}/poll`);

    expect(res.status).toBe(200);
    expect(res.body.question).toBe('Favourite language?');
    expect(res.body.options).toHaveLength(2);
  });

  // Boundary: post has no poll
  test('should return 404 when the post has no poll', async () => {
    const user = await registerAndVerify('NoPollUser', 'nopoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id,title,category,content)
      VALUES($1,'Normal Post','general','Content')
      RETURNING id`,
      [user.user.id],
    );

    const res = await request(app).get(`/posts/${rows[0].id}/poll`);

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no poll/i);
  });

  // Boundary: post id does not exist
  test('should return 404 for a non-existent post', async () => {
    const res = await request(app).get('/posts/999999/poll');

    expect(res.status).toBe(404);
    expect(res.body.message).toMatch(/no poll/i);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/poll', () => {
  // Valid partition: create a poll with two options
  test('should return 201 and create a poll', async () => {
    const user = await registerAndVerify('CreatePollUser', 'createpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        question: 'Favourite programming language?',
        options: ['JavaScript', 'Python'],
      });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.question).toBe('Favourite programming language?');
    expect(res.body.options).toHaveLength(2);
  });

  // Valid partition: verify poll in the database
  test('created poll should persist', async () => {
    const user = await registerAndVerify('PersistPollUser', 'persistpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .post(`/posts/${postId}/poll`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        question: 'Favourite IDE?',
        options: ['VS Code', 'WebStorm'],
      });

    const res = await request(app).get(`/posts/${postId}/poll`);

    expect(res.status).toBe(200);
    expect(res.body.question).toBe('Favourite IDE?');
    expect(res.body.options).toHaveLength(2);
  });

  // Invalid partition: fewer than two options
  test('should return 400 when fewer than two options are provided', async () => {
    const user = await registerAndVerify('InvalidPollUser', 'invalidpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        question: 'Invalid poll',
        options: ['Only one'],
      });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/at least 2 options/i);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/:id/poll/vote
// ─────────────────────────────────────────────────────────
describe('POST /posts/:id/poll/vote', () => {
  // Valid partition: user votes successfully
  test('should return 201 and create a vote', async () => {
    const user = await registerAndVerify('VoteUser', 'voteuser@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = postRows[0].id;

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls"
      (post_id, question)
      VALUES ($1, 'Favourite language?')
      RETURNING id`,
      [postId],
    );

    const pollId = pollRows[0].id;

    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions"
      (poll_id, option_text)
      VALUES ($1, 'JavaScript')
      RETURNING id`,
      [pollId],
    );

    const optionId = optionRows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollId,
        option_id: optionId,
      });

    expect(res.status).toBe(201);
    expect(res.body.vote).toHaveProperty('id');
    expect(res.body.vote.poll_id).toBe(pollId);
    expect(res.body.vote.option_id).toBe(optionId);
    expect(res.body.poll.options[0].vote_count).toBe(1);
  });

  // Invalid partition: duplicate vote
  test('should return 409 when the user has already voted', async () => {
    const user = await registerAndVerify('DuplicateVoteUser', 'duplicatevote@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.user.id],
    );

    const postId = postRows[0].id;

    const { rows: pollRows } = await pool.query(
      `INSERT INTO "PostPolls"
      (post_id, question)
      VALUES ($1, 'Favourite IDE?')
      RETURNING id`,
      [postId],
    );

    const pollId = pollRows[0].id;

    const { rows: optionRows } = await pool.query(
      `INSERT INTO "PollOptions"
      (poll_id, option_text)
      VALUES ($1, 'VS Code')
      RETURNING id`,
      [pollId],
    );

    const optionId = optionRows[0].id;

    await request(app)
      .post(`/posts/${postId}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollId,
        option_id: optionId,
      });

    const res = await request(app)
      .post(`/posts/${postId}/poll/vote`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        poll_id: pollId,
        option_id: optionId,
      });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already voted/i);
  });

  // Invalid partition: missing required fields
  test('should return 400 when poll_id or option_id is missing', async () => {
    const user = await registerAndVerify('MissingVoteUser', 'missingvote@example.com');

    const res = await request(app)
      .post('/posts/1/poll/vote')
      .set('Authorization', `Bearer ${user.token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });
});

// ─────────────────────────────────────────────────────────
// Saved Posts
// ─────────────────────────────────────────────────────────
describe('Saved Posts', () => {
  test('should allow a user to save a post', async () => {
    const owner = await registerAndVerify('SaveOwner', 'saveowner@example.com');
    const user = await registerAndVerify('SaveUser', 'saveuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1,'Save Me','general','Content')
       RETURNING id`,
      [owner.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/save`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('should return all saved posts for the logged in user', async () => {
    const owner = await registerAndVerify('ListOwner', 'listowner@example.com');
    const user = await registerAndVerify('ListUser', 'listuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id,title,category,content)
       VALUES ($1,'Saved Post','general','Hello')
       RETURNING id`,
      [owner.user.id],
    );

    await request(app)
      .post(`/posts/${rows[0].id}/save`)
      .set('Authorization', `Bearer ${user.token}`);

    const res = await request(app).get('/posts/saved').set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].post_id).toBe(rows[0].id);
  });

  test('should allow a user to unsave a post', async () => {
    const owner = await registerAndVerify('DeleteOwner', 'deleteowner@example.com');
    const user = await registerAndVerify('DeleteUser', 'deleteuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"(user_id,title,category,content)
       VALUES($1,'Delete Me','general','Hello')
       RETURNING id`,
      [owner.user.id],
    );

    await request(app)
      .post(`/posts/${rows[0].id}/save`)
      .set('Authorization', `Bearer ${user.token}`);

    const saved = await request(app)
      .get('/posts/saved')
      .set('Authorization', `Bearer ${user.token}`);

    const saveId = saved.body[0].id;

    const res = await request(app)
      .delete(`/posts/saved/${saveId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saveId);
  });
});

// ─────────────────────────────────────────────────────────
// Post Reactions
// ─────────────────────────────────────────────────────────
describe('Post Reactions', () => {
  test('should allow a user to like a post', async () => {
    const owner = await registerAndVerify('LikeOwner', 'likeowner@example.com');
    const user = await registerAndVerify('LikeUser', 'likeuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'React Post', 'general', 'Content')
       RETURNING id`,
      [owner.user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/reaction`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ reaction_type: 'like' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
  });

  test('should return the logged in user reactions', async () => {
    const owner = await registerAndVerify('ReactionOwner', 'reactionowner@example.com');
    const user = await registerAndVerify('ReactionUser', 'reactionuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'Reaction Test', 'general', 'Content')
       RETURNING id`,
      [owner.user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .post(`/posts/${postId}/reaction`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ reaction_type: 'like' });

    const res = await request(app)
      .get('/posts/reactions')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.length).toBe(1);
    expect(res.body[0].post_id).toBe(postId);
    expect(res.body[0].reaction_type).toBe('like');
  });

  test('should allow a user to change a like into a dislike', async () => {
    const owner = await registerAndVerify('UpdateOwner', 'updateowner@example.com');
    const user = await registerAndVerify('UpdateUser', 'updateuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'Update Reaction', 'general', 'Content')
       RETURNING id`,
      [owner.user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .post(`/posts/${postId}/reaction`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ reaction_type: 'like' });

    const reactions = await request(app)
      .get('/posts/reactions')
      .set('Authorization', `Bearer ${user.token}`);

    const reactionId = reactions.body[0].id;

    const res = await request(app)
      .put(`/posts/reaction/${reactionId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ reaction_type: 'dislike' });

    expect(res.status).toBe(200);
    expect(res.body.reaction_type).toBe('dislike');
  });

  test('should allow a user to remove a reaction', async () => {
    const owner = await registerAndVerify('DeleteReactionOwner', 'deletereactionowner@example.com');
    const user = await registerAndVerify('DeleteReactionUser', 'deletereactionuser@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'Delete Reaction', 'general', 'Content')
       RETURNING id`,
      [owner.user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .post(`/posts/${postId}/reaction`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({ reaction_type: 'like' });

    const reactions = await request(app)
      .get('/posts/reactions')
      .set('Authorization', `Bearer ${user.token}`);

    const reactionId = reactions.body[0].id;

    const res = await request(app)
      .delete(`/posts/reaction/${reactionId}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reactionId);
  });
});
