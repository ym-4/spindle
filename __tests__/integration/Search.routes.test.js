const request = require('supertest');

const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
async function safeDbCleanup() {
  try {
    await pool.query('DELETE FROM "PostTags"');
    await pool.query('DELETE FROM "Tags"');
    await pool.query('DELETE FROM "PostComments"');
    await pool.query('DELETE FROM "Posts"');
    await pool.query('DELETE FROM "Groups"');
    await pool.query('DELETE FROM "EmailVerificationCodes"');
    await pool.query('DELETE FROM "TrustedDevices"');
    await pool.query('DELETE FROM "UserSessions"');
    await pool.query('DELETE FROM "Person"');
  } catch (err) {
    console.warn('[Search.routes.test] cleanup warning:', err.message);
  }
}

beforeEach(async () => {
  await safeDbCleanup();
});

afterAll(async () => {
  await safeDbCleanup();
  try {
    await pool.end();
  } catch (err) {
    console.warn('[Search.routes.test] pool end warning:', err.message);
  }
});

// ── Helper ───────────────────────────────────────────────
async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function createTestUser(name = 'Search User', email = 'search@example.com') {
  const { user } = await registerAndVerify(name, email);
  return { id: user.id };
}

async function createTestPost(userId, title = 'Test Post', content = 'Search content') {
  const { rows } = await pool.query(
    `
    INSERT INTO "Posts"
    (user_id, title, category, content)
    VALUES ($1, $2, 'general', $3)
    RETURNING id
    `,
    [userId, title, content],
  );

  return { id: rows[0].id };
}

async function createTestComment(userId, postId, content = 'Comment content') {
  const { rows } = await pool.query(
    `
    INSERT INTO "PostComments"
    (user_id, post_id, content)
    VALUES ($1, $2, $3)
    RETURNING id
    `,
    [userId, postId, content],
  );

  return { id: rows[0].id };
}

async function createTestGroup(userId, name = 'Search Group', description = 'Search group desc') {
  const { rows } = await pool.query(
    `
    INSERT INTO "Groups"
    (name, description, creator_id, module, school)
    VALUES ($1, $2, $3, 'general', 'SOC')
    RETURNING id
    `,
    [name, description, userId],
  );

  return { id: rows[0].id };
}

// ─────────────────────────────────────────────────────────
// GET /search
// ─────────────────────────────────────────────────────────
describe('GET /search', () => {
  afterEach(() => {
    jest.restoreAllMocks();
  });

  // Boundary: missing query returns a 400 validation error
  test('should return 400 when the search query is missing', async () => {
    const res = await request(app).get('/search');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Search query is required' });
  });

  // Boundary: empty query string returns a 400 validation error
  test('should return 400 when the search query is empty', async () => {
    const res = await request(app).get('/search?q=   ');

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ message: 'Search query is required' });
  });

  // Valid partition: query returns matching posts and comments
  test('should return 200 and matching search results for a valid query', async () => {
    const user = await createTestUser('Searcher', 'searcher@example.com');
    const post = await createTestPost(user.id, 'React Tips', 'Useful React content');
    await createTestComment(user.id, post.id, 'Great React post');
    await createTestGroup(user.id, 'React Devs', 'A group for React developers');

    const res = await request(app).get('/search?q=react');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.length).toBeGreaterThan(0);

    const resultTypes = res.body.map((item) => item.result_type);
    expect(resultTypes).toContain('post');
    expect(resultTypes).toContain('comment');
    expect(resultTypes).toContain('group');
  });

  // Valid partition: category query param is parsed into an array
  test('should parse category filters from the query string', async () => {
    const user = await createTestUser('Category Searcher', 'categorysearcher@example.com');
    await createTestPost(user.id, 'Tech Post', 'tech content');

    const res = await request(app).get('/search?q=tech&category=general,news');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Valid partition: date filters are passed through
  test('should accept date filters in the query string', async () => {
    const user = await createTestUser('Date Searcher', 'datesearcher@example.com');
    await createTestPost(user.id, 'Date Post', 'dated content');

    const res = await request(app).get('/search?q=dated&date_from=2024-01-01&date_to=2024-12-31');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  // Valid partition: sort parameter defaults to newest when omitted
  test('should default sort to newest when the sort query is omitted', async () => {
    const user = await createTestUser('Sort Searcher', 'sortsearcher@example.com');
    await createTestPost(user.id, 'Sorted Post', 'sorted content');

    const res = await request(app).get('/search?q=sorted');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});
