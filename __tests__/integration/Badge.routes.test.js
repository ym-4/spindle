const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
// This router has no authenticateJWT middleware, so no auth mock is needed.
// "Badges" catalog rows are created per-test with a "test_" key prefix so
// this suite is self-contained and doesn't depend on seed.js's real catalog.

beforeEach(async () => {
  await pool.query('DELETE FROM "UserBadges"');
  await pool.query(`DELETE FROM "Badges" WHERE key LIKE 'test\\_%'`);
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "UserBadges"');
  await pool.query(`DELETE FROM "Badges" WHERE key LIKE 'test\\_%'`);
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helper ───────────────────────────────────────────────
async function createTestUser(name = 'Test User', email = 'test@test.com') {
  const { rows } = await pool.query(
    `
    INSERT INTO "Person"
    (name, email, hashed_password, role, email_verified)
    VALUES ($1, $2, 'fakehash', 'user', TRUE)
    RETURNING id
    `,
    [name, email],
  );
  return { id: rows[0].id };
}

async function createTestBadge(key, name = 'Test Badge', description = 'A test badge.') {
  const { rows } = await pool.query(
    `INSERT INTO "Badges" (key, name, description, image_url)
     VALUES ($1, $2, $3, '/test-badge.png')
     RETURNING id`,
    [key, name, description],
  );
  return { id: rows[0].id };
}

async function awardTestBadge(userId, badgeId) {
  await pool.query(`INSERT INTO "UserBadges" (user_id, badge_id) VALUES ($1, $2)`, [
    userId,
    badgeId,
  ]);
}

// ─────────────────────────────────────────────────────────
// GET /badges/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /badges/:user_id', () => {
  // Valid partition: returns the catalog with unlocked flags
  test("should return the badge catalog with the user's unlock status", async () => {
    const user = await createTestUser('BadgeUser', 'badgeuser@example.com');
    const owned = await createTestBadge('test_first_post', 'First Post');
    const notOwned = await createTestBadge('test_prolific_poster', 'Prolific Poster');
    await awardTestBadge(user.id, owned.id);

    const res = await request(app).get(`/badges/${user.id}`);

    expect(res.status).toBe(200);
    const ownedEntry = res.body.find((b) => b.id === owned.id);
    const notOwnedEntry = res.body.find((b) => b.id === notOwned.id);
    expect(ownedEntry.unlocked).toBe(true);
    expect(ownedEntry.awarded_at).not.toBeNull();
    expect(notOwnedEntry.unlocked).toBe(false);
    expect(notOwnedEntry.awarded_at).toBeNull();
  });

  // Boundary: a user who hasn't earned any badges yet
  test('should return all badges as locked for a user with no badges', async () => {
    const user = await createTestUser('NoBadgesUser', 'nobadgesuser@example.com');
    await createTestBadge('test_group_joiner', 'Group Joiner');

    const res = await request(app).get(`/badges/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body.every((b) => b.unlocked === false)).toBe(true);
  });

  // Boundary: a non-existent user_id should return everything locked
  test('should return all badges as locked for a non-existent user_id', async () => {
    await createTestBadge('test_night_owl', 'Night Owl');

    const res = await request(app).get('/badges/999999999');

    expect(res.status).toBe(200);
    expect(res.body.every((b) => b.unlocked === false)).toBe(true);
  });

  // Error handling: a non-integer user_id causes a DB type error
  test('should return 500 for a non-numeric user_id', async () => {
    const res = await request(app).get('/badges/not-a-number');

    expect(res.status).toBe(500);
  });
});
