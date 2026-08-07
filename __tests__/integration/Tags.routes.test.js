const request = require('supertest');

const app = require('../../src/app');
const pool = require('../../src/models/db');
const Tag = require('../../src/models/Tags.model');

// ── DB Setup / Teardown ──────────────────────────────────
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

  Tag.getListingsByTag = jest.fn();
  Tag.setListingTags = jest.fn();
});

afterAll(async () => {
  await pool.query(`
    DO $$ DECLARE
      r RECORD;
    BEGIN
      FOR r IN (SELECT tablename FROM pg_tables WHERE schemaname = 'public') LOOP
        EXECUTE 'TRUNCATE TABLE ' || quote_ident(r.tablename) || ' CASCADE';
      END LOOP;
    END $$;
  `);
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
// GET /tags/tags
// ─────────────────────────────────────────────────────────
describe('GET /tags/tags', () => {
  // Boundary: zero rows – empty table returns an empty array
  test('should return 200 and an empty array when no tags exist', async () => {
    const user = await createTestUser('TagsEmptyUser', 'tagsemptyuser@example.com');

    const res = await request(app).get('/tags/tags').set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: existing tags are returned in sorted order
  test('should return 200 and all tags sorted by name', async () => {
    const user = await createTestUser('TagsSortedUser', 'tagssorteduser@example.com');
    await pool.query('INSERT INTO "Tags" ("name") VALUES ($1), ($2)', ['beta', 'alpha']);

    const res = await request(app).get('/tags/tags').set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body.map((tag) => tag.name)).toEqual(['alpha', 'beta']);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('name');
  });

  test('should return 500 when fetching tags fails', async () => {
    const user = await createTestUser('TagsFailUser', 'tagsfailuser@example.com');
    Tag.getAllTags = jest.fn().mockRejectedValue(new Error('boom'));

    const res = await request(app).get('/tags/tags').set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch tags' });
  });
});

// ─────────────────────────────────────────────────────────
// GET /tags/marketplace/by-tag/:tagName
// ─────────────────────────────────────────────────────────
describe('GET /tags/marketplace/by-tag/:tagName', () => {
  test('should return 200 and listings for a matching tag', async () => {
    const user = await createTestUser('ByTagUser', 'bytaguser@example.com');
    const listings = [{ id: 1, title: 'Vintage bike' }];
    Tag.getListingsByTag.mockResolvedValue(listings);

    const res = await request(app)
      .get('/tags/marketplace/by-tag/bike')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual(listings);
  });

  test('should return 500 when retrieving listings by tag fails', async () => {
    const user = await createTestUser('ByTagFailUser', 'bytagfailuser@example.com');
    Tag.getListingsByTag.mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .get('/tags/marketplace/by-tag/bike')
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to fetch listings' });
  });
});

// ─────────────────────────────────────────────────────────
// PUT /tags/listings/:id/tags
// ─────────────────────────────────────────────────────────
describe('PUT /tags/listings/:id/tags', () => {
  test('should return 400 when tags payload is not an array', async () => {
    const user = await createTestUser('BadTagsPayloadUser', 'badtagspayloaduser@example.com');

    const res = await request(app)
      .put('/tags/listings/7/tags')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ tags: 'not-an-array' });

    expect(res.status).toBe(400);
    expect(res.body).toEqual({ error: 'tags must be an array' });
  });

  test('should return 200 and update tags when an array is provided', async () => {
    const user = await createTestUser('UpdateTagsUser', 'updatetagsuser@example.com');
    Tag.setListingTags.mockResolvedValue();

    const res = await request(app)
      .put('/tags/listings/7/tags')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ tags: ['used', 'bike'] });

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ message: 'Tags updated' });
    expect(Tag.setListingTags).toHaveBeenCalledWith('7', ['used', 'bike']);
  });

  test('should return 500 when updating listing tags fails', async () => {
    const user = await createTestUser('UpdateTagsFailUser', 'updatetagsfailuser@example.com');
    Tag.setListingTags.mockRejectedValue(new Error('boom'));

    const res = await request(app)
      .put('/tags/listings/7/tags')
      .set('Authorization', `Bearer ${user.token}`)
      .send({ tags: ['used'] });

    expect(res.status).toBe(500);
    expect(res.body).toEqual({ error: 'Failed to update tags' });
  });
});
