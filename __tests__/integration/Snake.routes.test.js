const request = require('supertest');

const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.

beforeEach(async () => {
  // Clean slate for every test
  await pool.query('DELETE FROM "SnakeScores"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "SnakeScores"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helpers ───────────────────────────────────────────────
async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function createTestUser(name = 'Test User', email = 'test@test.com', password = 'secret') {
  const { user, token } = await registerAndVerify(name, email, password);
  return { id: user.id, token };
}

// ─────────────────────────────────────────────────────────
// GET /snake/leaderboard
// ─────────────────────────────────────────────────────────
describe('GET /snake/leaderboard', () => {
  // Valid partition: returns scores ordered highest first
  test('should return the top scores in descending order', async () => {
    const alice = await createTestUser('Alice', 'alice@example.com');
    const bob = await createTestUser('Bob', 'bob@example.com');

    await pool.query(`INSERT INTO "SnakeScores" (user_id, best_score) VALUES ($1, $2)`, [
      alice.id,
      20,
    ]);
    await pool.query(`INSERT INTO "SnakeScores" (user_id, best_score) VALUES ($1, $2)`, [
      bob.id,
      55,
    ]);

    const res = await request(app).get('/snake/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0].user_id).toBe(bob.id);
    expect(res.body[0].best_score).toBe(55);
    expect(res.body[1].user_id).toBe(alice.id);
  });

  // Boundary: no scores exist yet
  test('should return an empty array when no scores exist', async () => {
    const res = await request(app).get('/snake/leaderboard');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /snake/score
// ─────────────────────────────────────────────────────────
describe('GET /snake/score', () => {
  // Valid partition: authenticated user has an existing best score
  test("should return the authenticated user's best score", async () => {
    const user = await createTestUser('ScoreGetter', 'scoregetter@example.com');
    await pool.query(`INSERT INTO "SnakeScores" (user_id, best_score) VALUES ($1, $2)`, [
      user.id,
      33,
    ]);

    const res = await request(app)
      .get('/snake/score')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.best_score).toBe(33);
  });

  // Boundary: authenticated user has never played
  test('should return 0 when the user has no score row yet', async () => {
    const user = await createTestUser('NeverPlayed', 'neverplayed@example.com');

    const res = await request(app)
      .get('/snake/score')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body.best_score).toBe(0);
  });
});

// ─────────────────────────────────────────────────────────
// POST /snake/score
// ─────────────────────────────────────────────────────────
describe('POST /snake/score', () => {
  // Valid partition: first score submission creates the row
  test('should return 200 and create a new best score on first submission', async () => {
    const user = await createTestUser('FirstScoreUser', 'firstscoreuser@example.com');

    const res = await request(app)
      .post('/snake/score')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ score: 15 });

    expect(res.status).toBe(200);
    expect(res.body.best_score).toBe(15);
    expect(res.body.is_new_best).toBe(true);
  });

  // Valid partition: a higher score overwrites the previous best
  test('should update the best score when the new score is higher', async () => {
    const user = await createTestUser('ImprovingUser', 'improvinguser@example.com');
    await pool.query(`INSERT INTO "SnakeScores" (user_id, best_score) VALUES ($1, $2)`, [
      user.id,
      10,
    ]);

    const res = await request(app)
      .post('/snake/score')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ score: 25 });

    expect(res.status).toBe(200);
    expect(res.body.best_score).toBe(25);
    expect(res.body.is_new_best).toBe(true);
  });

  // Boundary: a lower score should not overwrite the existing best
  test('should not overwrite the best score when the new score is lower', async () => {
    const user = await createTestUser('DecliningUser', 'declininguser@example.com');
    await pool.query(`INSERT INTO "SnakeScores" (user_id, best_score) VALUES ($1, $2)`, [
      user.id,
      50,
    ]);

    const res = await request(app)
      .post('/snake/score')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ score: 12 });

    expect(res.status).toBe(200);
    expect(res.body.best_score).toBe(50);
    expect(res.body.is_new_best).toBe(false);

    const { rows } = await pool.query(`SELECT best_score FROM "SnakeScores" WHERE user_id = $1`, [
      user.id,
    ]);
    expect(rows[0].best_score).toBe(50);
  });

  // Boundary: score = 0 is a valid, non-negative integer
  test('should accept a score of 0', async () => {
    const user = await createTestUser('ZeroScoreUser', 'zeroscoreuser@example.com');

    const res = await request(app)
      .post('/snake/score')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ score: 0 });

    expect(res.status).toBe(200);
    expect(res.body.best_score).toBe(0);
  });

  // Invalid partition: negative score is rejected
  test('should return 400 for a negative score', async () => {
    const user = await createTestUser('NegativeScoreUser', 'negativescoreuser@example.com');

    const res = await request(app)
      .post('/snake/score')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ score: -5 });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/non-negative/i);
  });

  // Invalid partition: non-numeric score is rejected
  test('should return 400 for a non-numeric score', async () => {
    const user = await createTestUser('BadScoreUser', 'badscoreuser@example.com');

    const res = await request(app)
      .post('/snake/score')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ score: 'abc' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/non-negative/i);
  });
});