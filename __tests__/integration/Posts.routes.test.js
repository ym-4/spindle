const request = require('supertest');

let mockUserId = 1;

jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticateJWT: (req, res, next) => {
    req.user = {
      id: mockUserId,
      name: 'Test User',
      email: 'test@test.com',
      role: 'user',
    };
    next();
  },

  requireAdmin: (req, res, next) => {
    next();
  },
}));

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
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "PollVotes"');
  await pool.query('DELETE FROM "PollOptions"');
  await pool.query('DELETE FROM "PostPolls"');
  await pool.query('DELETE FROM "PostReactions"');
  await pool.query('DELETE FROM "SavedPosts"');
  await pool.query('DELETE FROM "Posts"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helper ───────────────────────────────────────────────
async function createTestUser(name = 'Test User', email = 'test@test.com') {
  const { rows } = await pool.query(
    `
    INSERT INTO "Person"
    (
      name,
      email,
      hashed_password,
      role,
      email_verified
    )
    VALUES
    (
      $1,
      $2,
      'fakehash',
      'user',
      TRUE
    )
    RETURNING id
    `,
    [name, email],
  );

  mockUserId = rows[0].id;

  return {
    id: mockUserId,
  };
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
    const user = await createTestUser('PostAuthor', 'postauthor@example.com');

    await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1,'First Post','general','Hello World'),
      ($1,'Second Post','qna','Need help')`,
      [user.id],
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
    const user = await createTestUser('CategoryUser', 'category@example.com');

    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES
       ($1, 'General Post', 'general', 'General content'),
       ($1, 'Question', 'qna', 'Question content'),
       ($1, 'Another General', 'general', 'More content')`,
      [user.id],
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
    const user = await createTestUser('EmptyCategoryUser', 'emptycategory@example.com');

    await pool.query(
      `INSERT INTO "Posts" (user_id, title, category, content)
       VALUES ($1, 'General Post', 'general', 'Content')`,
      [user.id],
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
    const user = await createTestUser('SinglePostUser', 'singlepost@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'My Post', 'general', 'Hello World')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app).get(`/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);
    expect(res.body.title).toBe('My Post');
    expect(res.body.category).toBe('general');
    expect(res.body.content).toBe('Hello World');
    expect(res.body.user_id).toBe(user.id);
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
    const user = await createTestUser('RelatedUser', 'related@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1, 'Current Post', 'general', 'Current'),
      ($1, 'Related One', 'general', 'Related 1'),
      ($1, 'Related Two', 'general', 'Related 2'),
      ($1, 'Different Category', 'qna', 'Not related')
      RETURNING id`,
      [user.id],
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
    const user = await createTestUser('LonelyUser', 'lonely@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Only General Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
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
    const user = await createTestUser('CreatePostUser', 'createpost@example.com');

    const res = await request(app)
      .post('/posts')
      .field('user_id', user.id)
      .field('title', 'My First Post')
      .field('category', 'general')
      .field('content', 'Hello everyone!');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.title).toBe('My First Post');
    expect(res.body.category).toBe('general');
    expect(res.body.content).toBe('Hello everyone!');
    expect(res.body.user_id).toBe(user.id);
  });

  // Valid partition: verify created post in the database
  test('created post should be persisted', async () => {
    const user = await createTestUser('PersistUser', 'persist@example.com');

    await request(app)
      .post('/posts')
      .field('user_id', user.id)
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
    const user = await createTestUser('UpdateUser', 'update@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Old Title', 'general', 'Old content')
      RETURNING id`,
      [user.id],
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
    const user = await createTestUser('PersistUpdateUser', 'persistupdate@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Before', 'general', 'Old content')
      RETURNING id`,
      [user.id],
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
    const user = await createTestUser('DeleteOwner', 'deleteowner@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Delete Me', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app).delete(`/posts/${postId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(postId);

    const check = await request(app).get(`/posts/${postId}`);

    expect(check.status).toBe(404);
  });

  // Invalid partition: authenticated user is not the owner
  test("should return 403 when deleting another user's post", async () => {
    const owner = await createTestUser('PostOwner', 'owner@example.com');

    const stranger = await createTestUser('OtherUser', 'other@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Protected Post', 'general', 'Content')
      RETURNING id`,
      [owner.id],
    );

    const postId = rows[0].id;

    const res = await request(app).delete(`/posts/${postId}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  // Boundary: non-existent id
  test('should return 404 when deleting a non-existent post', async () => {
    const user = await createTestUser('GhostDelete', 'ghostdelete@example.com');

    const res = await request(app).delete('/posts/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/post not found/i);
  });
});

// ==================== Poll Posts ========================
// ─────────────────────────────────────────────────────────
// GET /posts/:id/poll
// ─────────────────────────────────────────────────────────
describe('GET /posts/:id/poll', () => {
  // Valid partition: poll exists and returns question with options
  test('should return 200 and the poll with its options', async () => {
    const user = await createTestUser('PollOwner', 'pollowner@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
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
    const user = await createTestUser('NoPollUser', 'nopoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id,title,category,content)
      VALUES($1,'Normal Post','general','Content')
      RETURNING id`,
      [user.id],
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
    const user = await createTestUser('CreatePollUser', 'createpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll`)
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
    const user = await createTestUser('PersistPollUser', 'persistpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    await request(app)
      .post(`/posts/${postId}/poll`)
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
    const user = await createTestUser('InvalidPollUser', 'invalidpoll@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
    );

    const postId = rows[0].id;

    const res = await request(app)
      .post(`/posts/${postId}/poll`)
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
    const user = await createTestUser('VoteUser', 'voteuser@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
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

    const res = await request(app).post(`/posts/${postId}/poll/vote`).send({
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
    const user = await createTestUser('DuplicateVoteUser', 'duplicatevote@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Poll Post', 'general', 'Content')
      RETURNING id`,
      [user.id],
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

    await request(app).post(`/posts/${postId}/poll/vote`).send({
      poll_id: pollId,
      option_id: optionId,
    });

    const res = await request(app).post(`/posts/${postId}/poll/vote`).send({
      poll_id: pollId,
      option_id: optionId,
    });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already voted/i);
  });

  // Invalid partition: missing required fields
  test('should return 400 when poll_id or option_id is missing', async () => {
    const user = await createTestUser('MissingVoteUser', 'missingvote@example.com');

    const res = await request(app).post('/posts/1/poll/vote').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/required/i);
  });
});

// ==================== Saved Posts ========================
// ─────────────────────────────────────────────────────────
// GET /posts/saved/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/saved/:user_id', () => {
  // Valid partition: returns the posts a user has saved
  test('should return 200 and the saved posts for the user', async () => {
    const author = await createTestUser('SavedAuthor', 'savedauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES
      ($1, 'Saved Post One', 'general', 'Content 1'),
      ($1, 'Saved Post Two', 'qna', 'Content 2')
      RETURNING id`,
      [author.id],
    );

    const saver = await createTestUser('Saver', 'saver@example.com');

    await pool.query(`INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2)`, [
      saver.id,
      postRows[0].id,
    ]);

    const res = await request(app).get(`/posts/saved/${saver.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  // Boundary: user has not saved anything
  test('should return 200 and an empty array when the user has no saved posts', async () => {
    const user = await createTestUser('NoSavesUser', 'nosaves@example.com');

    const res = await request(app).get(`/posts/saved/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/saved
// ─────────────────────────────────────────────────────────
describe('POST /posts/saved', () => {
  // Valid partition: authenticated user saves a post
  test('should return 201 and save the post for the authenticated user', async () => {
    const author = await createTestUser('SaveAuthor', 'saveauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Save Me', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    const saver = await createTestUser('SaverUser', 'saveruser@example.com');
    const res = await request(app).post('/posts/saved').send({ post_id: postId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.post_id).toBe(postId);
    expect(res.body.user_id).toBe(saver.id);
  });

  // Invalid partition: post_id missing from body
  test('should return 400 when post_id is missing', async () => {
    await createTestUser('NoPostIdUser', 'nopostid@example.com');

    const res = await request(app).post('/posts/saved').send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/post_id/i);
  });

  // Boundary: saving the same post twice
  test('should not allow the same user to save the same post twice', async () => {
    const author = await createTestUser('DupAuthor', 'dupauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Duplicate Save', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;

    await createTestUser('DupSaver', 'dupsaver@example.com');

    await request(app).post('/posts/saved').send({ post_id: postId });
    const res = await request(app).post('/posts/saved').send({ post_id: postId });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already saved/i);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/saved/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/saved/:id', () => {
  // Valid partition: deletes an existing saved post record
  test('should return 200 and delete the saved post', async () => {
    const author = await createTestUser('DeleteSaveAuthor', 'deletesaveauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const saver = await createTestUser('DeleteSaver', 'deletesaver@example.com');

    const { rows: saveRows } = await pool.query(
      `INSERT INTO "SavedPosts" (user_id, post_id)
      VALUES ($1, $2)
      RETURNING id`,
      [saver.id, postRows[0].id],
    );

    const saveId = saveRows[0].id;
    const res = await request(app).delete(`/posts/saved/${saveId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saveId);

    const check = await pool.query('SELECT * FROM "SavedPosts" WHERE id = $1', [saveId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent save id
  test('should return 404 when the saved post does not exist', async () => {
    const res = await request(app).delete('/posts/saved/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/save not found/i);
  });
});

// ================== Posts Reactions ======================
// ─────────────────────────────────────────────────────────
// GET /posts/reaction/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /posts/reaction/:user_id', () => {
  // Valid partition: returns the reactions belonging to a user
  test('should return 200 and the reactions for the user', async () => {
    const author = await createTestUser('ReactAuthor', 'reactauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Reactable Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const reactor = await createTestUser('Reactor', 'reactor@example.com');

    await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type)
      VALUES ($1, $2, 'like')`,
      [postRows[0].id, reactor.id],
    );

    const res = await request(app).get(`/posts/reaction/${reactor.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reaction_type).toBe('like');
  });

  // Boundary: user has not reacted to anything
  test('should return 200 and an empty array when the user has no reactions', async () => {
    const user = await createTestUser('NoReactionsUser', 'noreactions@example.com');

    const res = await request(app).get(`/posts/reaction/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// POST /posts/like
// ─────────────────────────────────────────────────────────
describe('POST /posts/like', () => {
  // Valid partition: authenticated user likes a post
  test('should return 201 and create a like', async () => {
    const author = await createTestUser('LikeAuthor', 'likeauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Likeable Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    const liker = await createTestUser('Liker', 'liker@example.com');

    const res = await request(app)
      .post('/posts/like')
      .send({ post_id: postId, reaction_type: 'like' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.post_id).toBe(postId);
    expect(res.body.user_id).toBe(liker.id);
    expect(res.body.reaction_type).toBe('like');
  });

  // Invalid partition: post_id missing from body
  test('should return 400 when post_id is missing', async () => {
    await createTestUser('NoPostIdLiker', 'nopostidliker@example.com');

    const res = await request(app).post('/posts/like').send({ reaction_type: 'like' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/post_id/i);
  });

  // Boundary: reacting to the same post twice
  test('should not allow the same user to react to the same post twice', async () => {
    const author = await createTestUser('DupReactAuthor', 'dupreactauthor@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Duplicate Reaction Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const postId = rows[0].id;
    await createTestUser('DupReactor', 'dupreactor@example.com');

    await request(app).post('/posts/like').send({ post_id: postId, reaction_type: 'like' });
    const res = await request(app)
      .post('/posts/like')
      .send({ post_id: postId, reaction_type: 'dislike' });
    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already reacted/i);
  });
});

// ─────────────────────────────────────────────────────────
// PUT /posts/reaction/:id
// ─────────────────────────────────────────────────────────
describe('PUT /posts/reaction/:id', () => {
  // Valid partition: changes an existing reaction from like to dislike
  test('should return 200 and update the reaction type', async () => {
    const author = await createTestUser('UpdateReactionAuthor', 'updatereactionauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const reactor = await createTestUser('UpdateReactor', 'updatereactor@example.com');

    const { rows: reactionRows } = await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type)
      VALUES ($1, $2, 'like')
      RETURNING id`,
      [postRows[0].id, reactor.id],
    );

    const res = await request(app)
      .put(`/posts/reaction/${reactionRows[0].id}`)
      .send({ user_id: reactor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(200);
    expect(res.body.reaction_type).toBe('dislike');
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const res = await request(app)
      .put('/posts/reaction/999999')
      .send({ user_id: 1, reaction_type: 'dislike' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /posts/reaction/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /posts/reaction/:id', () => {
  // Valid partition: deletes an existing reaction
  test('should return 200 and delete the reaction', async () => {
    const author = await createTestUser('DeleteReactionAuthor', 'deletereactionauthor@example.com');

    const { rows: postRows } = await pool.query(
      `INSERT INTO "Posts"
      (user_id, title, category, content)
      VALUES ($1, 'Post', 'general', 'Content')
      RETURNING id`,
      [author.id],
    );

    const reactor = await createTestUser('DeleteReactor', 'deletereactor@example.com');

    const { rows: reactionRows } = await pool.query(
      `INSERT INTO "PostReactions" (post_id, user_id, reaction_type)
      VALUES ($1, $2, 'like')
      RETURNING id`,
      [postRows[0].id, reactor.id],
    );

    const reactionId = reactionRows[0].id;

    const res = await request(app)
      .delete(`/posts/reaction/${reactionId}`)
      .send({ user_id: reactor.id });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reactionId);

    const check = await pool.query('SELECT * FROM "PostReactions" WHERE id = $1', [reactionId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const res = await request(app).delete('/posts/reaction/999999').send({ user_id: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
  });
});
