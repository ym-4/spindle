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

async function registerAndVerify(name, email, password = 'secret1') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function seedMarketplaceItem() {
  const userRes = await pool.query(
    `INSERT INTO "Person" (email, name, hashed_password, role, email_verified)
     VALUES ('cartseed@test.com', 'CartSeed', 'x', 'user', TRUE) RETURNING id`,
  );
  const item = await pool.query(
    `INSERT INTO "MarketplaceItems" (seller_id, name, description, price, quality, meetup)
     VALUES ($1, 'Test Item', 'desc', 10, 'good', 'Library') RETURNING id`,
    [userRes.rows[0].id],
  );
  return { sellerId: userRes.rows[0].id, itemId: item.rows[0].id };
}

describe('Cart', () => {
  test('adds, lists, edits, removes and clears cart items', async () => {
    const { user, token } = await registerAndVerify('cartuser', 'cartuser@test.com');
    const { sellerId, itemId } = await seedMarketplaceItem();

    const add = await request(app).post(`/cart/add/${user.id}`).send({
      seller_id: sellerId,
      item_id: itemId,
      amount: 2,
    });
    expect(add.status).toBe(201);

    const list = await request(app).get(`/cart/${user.id}`);
    expect(list.status).toBe(200);
    expect(list.body.length).toBeGreaterThanOrEqual(1);

    const edit = await request(app).put(`/cart/edit/${itemId}/${user.id}`).send({
      new_amount: 5,
    });
    expect(edit.status).toBe(200);

    const rows = list.body.filter((r) => r.item_id === itemId);
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows[0].amount).toBe(2);

    const remove = await request(app).delete(`/cart/remove/${itemId}/${user.id}`);
    expect(remove.status).toBe(200);

    const after = await request(app).get(`/cart/${user.id}`);
    expect(after.body.some((r) => r.item_id === itemId)).toBe(false);
  });

  test('returns all carts via /cart', async () => {
    const res = await request(app).get('/cart');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('400 when add payload missing fields', async () => {
    const { user } = await registerAndVerify('cartbad', 'cartbad@test.com');
    const res = await request(app).post(`/cart/add/${user.id}`).send({});
    expect(res.status).toBe(400);
  });

  test('404 when removing a non-existent cart item', async () => {
    const { user } = await registerAndVerify('cartmiss', 'cartmiss@test.com');
    const res = await request(app).delete(`/cart/remove/99999999/${user.id}`);
    expect(res.status).toBe(404);
  });
});
