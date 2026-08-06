const fs = require('fs');
const path = require('path');
const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// Creates the tables the Marketplace routes need (no-op if they already exist).
async function applySchema() {
  const sql = fs.readFileSync(path.join('.', 'schema.sql'), 'utf8');
  await pool.query(sql);
}

// Wipes all Marketplace-related tables between tests so one test's data
// never leaks into the next. RESTART IDENTITY resets the SERIAL id counters
// too, so ids are predictable within a single test.
async function truncateAll() {
  await pool.query(
    'TRUNCATE TABLE "ItemTags", "ListingImages", "Tags", "MarketplaceItems" RESTART IDENTITY CASCADE',
  );
}

// async function closePool() {
//   await pool.end();
// }

// A real (tiny, valid) 1x1 PNG, so multer's fileFilter (which checks
// mimetype) and any future image-processing code have real bytes to work with.
const PNG_1PX = Buffer.from(
  '89504e470d0a1a0a0000000d494844520000000100000001080600000' +
    '01f15c4890000000a49444154789c6360000002000100ffff03000006000557bfabd40000000049454e44ae426082',
  'hex',
);

const uploadedFiles = []; // track real files written to disk so we can clean them up

async function seedSeller() {
  await pool.query(
    `INSERT INTO "Person" ("id", "email", "name")
     VALUES (1, 'seller@spindle.test', 'Test Seller')
     ON CONFLICT ("id") DO NOTHING`,
  );
}

async function createItem(overrides = {}) {
  const res = await request(app)
    .post('/marketplace')
    .send({
      seller_id: 1,
      name: 'Used Calculus Textbook',
      description: 'Barely used, no highlighting',
      price: 25,
      quality: 'good',
      meetup: 'Clementi MRT',
      ...overrides,
    });
  return res;
}

beforeAll(async () => {
  await applySchema();
  await seedSeller();
});

beforeEach(async () => {
  await truncateAll();
});

afterAll(async () => {
  // Remove any files multer actually wrote during the upload tests.
  for (const filePath of uploadedFiles) {
    fs.promises.unlink(filePath).catch(() => {});
  }
});

describe('POST /marketplace (create listing)', () => {
  test('creates a listing and returns it with a generated id', async () => {
    const res = await createItem();

    expect(res.status).toBe(201);
    expect(res.body).toMatchObject({
      seller_id: 1,
      name: 'Used Calculus Textbook',
      description: 'Barely used, no highlighting',
      quality: 'good',
      meetup: 'Clementi MRT',
      status: 'active',
    });
    expect(res.body.id).toEqual(expect.any(Number));
  });

  test('persists the price as a numeric value', async () => {
    const res = await createItem({ price: 25 });
    expect(Number(res.body.price)).toBe(25);
  });
});

describe('GET /marketplace (list all)', () => {
  test('returns an empty array when there are no listings', async () => {
    const res = await request(app).get('/marketplace');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  test('returns created listings with empty images/tags by default', async () => {
    await createItem({ name: 'Item A' });
    await createItem({ name: 'Item B' });

    const res = await request(app).get('/marketplace');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    const names = res.body.map((i) => i.name).sort();
    expect(names).toEqual(['Item A', 'Item B']);
    for (const item of res.body) {
      expect(item.images).toEqual([]);
      expect(item.tags).toEqual([]);
    }
  });
});

describe('GET /marketplace/:id (single listing)', () => {
  test('returns the listing with its id', async () => {
    const created = await createItem();

    const res = await request(app).get(`/marketplace/${created.body.id}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);
    expect(res.body.name).toBe('Used Calculus Textbook');
  });
});

describe('PUT /marketplace/:id (update listing)', () => {
  test('updates the listing fields and returns the updated row', async () => {
    const created = await createItem();

    const res = await request(app).put(`/marketplace/${created.body.id}`).send({
      name: 'Used Calculus Textbook (2nd Edition)',
      price: 20,
      description: created.body.description,
      quality: 'like new',
      meetup: created.body.meetup,
    });

    expect(res.status).toBe(200);
    expect(res.body.name).toBe('Used Calculus Textbook (2nd Edition)');
    expect(res.body.quality).toBe('like new');
    expect(Number(res.body.price)).toBe(20);
  });

  test('returns 404 for a listing that does not exist', async () => {
    const res = await request(app).put('/marketplace/999999').send({
      name: 'Ghost listing',
      price: 1,
      description: '',
      quality: 'good',
      meetup: 'Somewhere',
    });

    expect(res.status).toBe(404);
  });
});

describe('PATCH /marketplace/:id/status (mark sold / relist)', () => {
  test('marks a listing as sold', async () => {
    const created = await createItem();

    const res = await request(app).patch(`/marketplace/${created.body.id}/status`).send({
      status: 'sold',
    });

    expect(res.status).toBe(200);
    expect(res.body.status).toBe('sold');
  });

  test('rejects a status value outside active/sold', async () => {
    const created = await createItem();

    const res = await request(app).patch(`/marketplace/${created.body.id}/status`).send({
      status: 'deleted',
    });

    expect(res.status).toBe(400);
  });
});

describe('DELETE /marketplace/:id (delete listing)', () => {
  test('deletes the listing', async () => {
    const created = await createItem();

    const res = await request(app).delete(`/marketplace/${created.body.id}`);
    expect(res.status).toBe(200);
    expect(res.body.id).toBe(created.body.id);

    const all = await request(app).get('/marketplace');
    expect(all.body).toHaveLength(0);
  });

  test('returns 404 for a listing that does not exist', async () => {
    const res = await request(app).delete('/marketplace/999999');
    expect(res.status).toBe(404);
  });
});

describe('tags: PUT /marketplace/:id/tags and GET /marketplace/by-tag/:tagName', () => {
  test('rejects a non-array tags payload', async () => {
    const created = await createItem();

    const res = await request(app)
      .put(`/marketplace/${created.body.id}/tags`)
      .send({ tags: 'textbooks' });

    expect(res.status).toBe(400);
  });

  test('attaches tags, normalizing case, and persists them deduplicated', async () => {
    const created = await createItem();

    const res = await request(app)
      .put(`/marketplace/${created.body.id}/tags`)
      .send({ tags: ['Textbooks', 'MATH', 'textbooks'] });

    expect(res.status).toBe(200);
    const tagNames = res.body.tags.map((t) => t.name).sort();
    expect(tagNames).toEqual(['math', 'textbooks']);

    const listing = await request(app).get(`/marketplace/${created.body.id}`);
    expect(listing.body.tags.map((t) => t.name).sort()).toEqual(['math', 'textbooks']);
  });

  test('replaces previous tags rather than appending to them', async () => {
    const created = await createItem();
    await request(app)
      .put(`/marketplace/${created.body.id}/tags`)
      .send({ tags: ['textbooks'] });

    const res = await request(app)
      .put(`/marketplace/${created.body.id}/tags`)
      .send({ tags: ['electronics'] });

    expect(res.body.tags.map((t) => t.name)).toEqual(['electronics']);

    const listing = await request(app).get(`/marketplace/${created.body.id}`);
    expect(listing.body.tags.map((t) => t.name)).toEqual(['electronics']);
  });

  test('finds listings by tag, case-insensitively', async () => {
    const created = await createItem({ name: 'Graphing Calculator' });
    await request(app)
      .put(`/marketplace/${created.body.id}/tags`)
      .send({ tags: ['electronics'] });
    await createItem({ name: 'Untagged Item' });

    const res = await request(app).get('/marketplace/by-tag/ELECTRONICS');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Graphing Calculator');
  });

  test('returns an empty array for a tag nothing is attached to', async () => {
    const res = await request(app).get('/marketplace/by-tag/nonexistent-tag');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

describe('images: upload, cover selection, and delete', () => {
  test('rejects an upload with no files attached', async () => {
    const created = await createItem();

    const res = await request(app).post(`/marketplace/${created.body.id}/images`);
    expect(res.status).toBe(400);
  });

  test('uploads images and attaches them to the listing in order', async () => {
    const created = await createItem();

    const res = await request(app)
      .post(`/marketplace/${created.body.id}/images`)
      .attach('images', PNG_1PX, 'first.png')
      .attach('images', PNG_1PX, 'second.png');

    expect(res.status).toBe(201);
    expect(res.body.images).toHaveLength(2);
    expect(res.body.images[0].image_url).toContain('/uploads/marketplace-uploads/');

    for (const img of res.body.images) {
      uploadedFiles.push(path.join(__dirname, '../public', img.image_url));
    }

    const listing = await request(app).get(`/marketplace/${created.body.id}`);
    expect(listing.body.images).toHaveLength(2);
  });

  test('setting a later image as cover moves it to sort_order 0', async () => {
    const created = await createItem();
    const upload = await request(app)
      .post(`/marketplace/${created.body.id}/images`)
      .attach('images', PNG_1PX, 'a.png')
      .attach('images', PNG_1PX, 'b.png');
    for (const img of upload.body.images) {
      uploadedFiles.push(path.join(__dirname, '../public', img.image_url));
    }
    const secondImageId = upload.body.images[1].id;

    const res = await request(app).put(
      `/marketplace/${created.body.id}/images/${secondImageId}/cover`,
    );
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ itemId: created.body.id, coverImageId: secondImageId });

    const listing = await request(app).get(`/marketplace/${created.body.id}`);
    expect(listing.body.images[0].id).toBe(secondImageId);
  });

  test('returns 404 when setting cover to an image not on this item', async () => {
    const created = await createItem();
    const res = await request(app).put(`/marketplace/${created.body.id}/images/999999/cover`);
    expect(res.status).toBe(404);
  });

  test('deletes a single image from a listing', async () => {
    const created = await createItem();
    const upload = await request(app)
      .post(`/marketplace/${created.body.id}/images`)
      .attach('images', PNG_1PX, 'only.png');
    const imageId = upload.body.images[0].id;
    uploadedFiles.push(path.join(__dirname, '../public', upload.body.images[0].image_url));

    const res = await request(app).delete(`/marketplace/${created.body.id}/images/${imageId}`);
    expect(res.status).toBe(200);

    const listing = await request(app).get(`/marketplace/${created.body.id}`);
    expect(listing.body.images).toEqual([]);
  });

  test('returns 404 deleting an image that does not belong to the item', async () => {
    const created = await createItem();
    const res = await request(app).delete(`/marketplace/${created.body.id}/images/999999`);
    expect(res.status).toBe(404);
  });
});

describe('GET /marketplace/:id/recommended', () => {
  test('prioritizes items that share a tag over unrelated items', async () => {
    const target = await createItem({ name: 'Target Item' });
    await request(app)
      .put(`/marketplace/${target.body.id}/tags`)
      .send({ tags: ['textbooks'] });

    const sameTag = await createItem({ name: 'Same Tag Item' });
    await request(app)
      .put(`/marketplace/${sameTag.body.id}/tags`)
      .send({ tags: ['textbooks'] });

    await createItem({ name: 'Unrelated Item 1' });
    await createItem({ name: 'Unrelated Item 2' });

    const res = await request(app).get(`/marketplace/${target.body.id}/recommended?limit=1`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Same Tag Item');
  });

  test('falls back to other listings when there are no tag matches', async () => {
    const target = await createItem({ name: 'Target Item' });
    await createItem({ name: 'Other Item' });

    const res = await request(app).get(`/marketplace/${target.body.id}/recommended?limit=4`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].name).toBe('Other Item');
  });

  test('never includes the item itself', async () => {
    const target = await createItem({ name: 'Target Item' });

    const res = await request(app).get(`/marketplace/${target.body.id}/recommended`);

    expect(res.body.find((i) => i.id === target.body.id)).toBeUndefined();
  });
});
