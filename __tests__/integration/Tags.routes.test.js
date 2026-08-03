const request = require('supertest');

const app = require('../../src/app');
const pool = require('../../src/models/db');
const Tag = require('../../src/models/Tags.model');

// ── DB Setup / Teardown ──────────────────────────────────
beforeEach(async () => {
  await pool.query('DELETE FROM "ItemTags"');
  await pool.query('DELETE FROM "Tags"');
  await pool.query('DELETE FROM "MarketplaceItems"');
  await pool.query('DELETE FROM "Person"');

  Tag.getListingsByTag = jest.fn();
  Tag.setListingTags = jest.fn();
});

afterAll(async () => {
  await pool.query('DELETE FROM "ItemTags"');
  await pool.query('DELETE FROM "Tags"');
  await pool.query('DELETE FROM "MarketplaceItems"');
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

  return { id: rows[0].id };
}

// ─────────────────────────────────────────────────────────
// GET /tags/tags
// ─────────────────────────────────────────────────────────
describe('GET /tags/tags', () => {
  // Boundary: zero rows – empty table returns an empty array
  test('should return 200 and an empty array when no tags exist', async () => {
    const res = await request(app).get('/tags/tags');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: existing tags are returned in sorted order
  test('should return 200 and all tags sorted by name', async () => {
    await pool.query('INSERT INTO "Tags" ("name") VALUES ($1), ($2)', ['beta', 'alpha']);

    const res = await request(app).get('/tags/tags');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((tag) => tag.name)).toEqual(['alpha', 'beta']);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });

  test('should return 500 when fetching tags fails', async () => {
    Tag.getAllTags = jest.fn().mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/tags/tags');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch tags' });
  });
});

// ─────────────────────────────────────────────────────────
// GET /tags/marketplace/by-tag/:tagName
// ─────────────────────────────────────────────────────────
describe('GET /tags/marketplace/by-tag/:tagName', () => {
  test('should return 200 and listings for a matching tag', async () => {
    const listings = [{ id: 1, title: 'Vintage bike' }];
    Tag.getListingsByTag.mockResolvedValue(listings);

    const res = await request(app).get('/tags/marketplace/by-tag/bike');

    expect(res.status).toBe(200);
    expect(res.body).toEqual(listings);
  });

  test('should return 500 when retrieving listings by tag fails', async () => {
    Tag.getListingsByTag.mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/tags/marketplace/by-tag/bike');

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch listings' });
  });
});

// ─────────────────────────────────────────────────────────
// PUT /tags/listings/:id/tags
// ─────────────────────────────────────────────────────────
describe('PUT /tags/listings/:id/tags', () => {
  test('should return 400 when tags payload is not an array', async () => {
    const res = await request(app).put('/tags/listings/7/tags').send({ tags: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'tags must be an array' });
  });

  test('should return 200 and update tags when an array is provided', async () => {
    Tag.setListingTags.mockResolvedValue();

    const res = await request(app)
      .put('/tags/listings/7/tags')
      .send({ tags: ['used', 'bike'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Tags updated' });
    expect(Tag.setListingTags).toHaveBeenCalledWith('7', ['used', 'bike']);
  });

  test('should return 500 when updating listing tags fails', async () => {
    Tag.setListingTags.mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .put('/tags/listings/7/tags')
      .send({ tags: ['used'] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to update tags' });
  });
});
