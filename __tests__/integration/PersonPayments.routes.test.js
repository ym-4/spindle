const { Pool } = require('pg');
const bcrypt = require('bcrypt');
const request = require('supertest');
const app = require('../../src/app');

const pool = new Pool({ connectionString: process.env.DATABASE_URL });

describe('Person router', () => {
  test('GET /persons returns an array', async () => {
    const res = await request(app).get('/persons');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('GET /persons/:id returns one person or 404', async () => {
    const { rows } = await pool.query(
      `INSERT INTO "Person" ("email","name","hashed_password","role") VALUES ($1, $2, 'x', 'user') RETURNING id`,
      [`${uniquePersonEmail()}`, `${uniquePersonEmail()}`],
    );
    const ok = await request(app).get(`/persons/${rows[0].id}`);
    expect(ok.status).toBe(200);
    expect(ok.body.id).toBe(rows[0].id);

    const missing = await request(app).get('/persons/9999999');
    expect(missing.status).toBe(404);
  });

  test('GET /persons/:id rejects invalid id', async () => {
    const res = await request(app).get('/persons/notanumber');
    expect(res.status).toBe(400);
  });

  test('POST /persons creates and returns 409 on duplicates', async () => {
    const base = `create_${Date.now()}`;
    const created = await request(app)
      .post('/persons')
      .send({
        name: base,
        email: `${base}@test.com`,
        bio: 'hello',
        password: 'password123',
      });
    expect(created.status).toBe(201);
    expect(created.body.name).toBe(base);

    const dupName = await request(app)
      .post('/persons')
      .send({ name: base, email: `${base}2@test.com`, bio: 'x', password: 'y' });
    expect(dupName.status).toBe(409);

    const dupEmail = await request(app)
      .post('/persons')
      .send({ name: `${base}2`, email: `${base}@test.com`, bio: 'x', password: 'y' });
    expect(dupEmail.status).toBe(409);
  });

  test('POST /persons requires fields', async () => {
    const res = await request(app).post('/persons').send({ name: 'only' });
    expect(res.status).toBe(400);
  });

  test('login route: validator, 404, wrong password, success', async () => {
    const base = `login_${Date.now()}`;
    const hash = await bcrypt.hash('password', 4);
    await pool.query(
      `INSERT INTO "Person" ("email", "name", "hashed_password", "role")
       VALUES ($1, $2, $3, 'user')`,
      [`${base}@test.com`, base, hash],
    );

    const missing = await request(app).post('/persons/login').send({ name: base });
    expect(missing.status).toBe(400);

    const notFound = await request(app)
      .post('/persons/login')
      .send({ name: 'nobodylike_me', password: 'x' });
    expect(notFound.status).toBe(404);

    const wrong = await request(app).post('/persons/login').send({ name: base, password: 'wrong' });
    expect(wrong.status).toBe(401);

    const ok = await request(app).post('/persons/login').send({ name: base, password: 'password' });
    expect(ok.status).toBe(200);
    expect(ok.body.token).toBeDefined();
    expect(ok.body.userId).toBeDefined();
  });

  test('register route validates, creates, and rejects duplicates', async () => {
    const base = `reg_${Date.now()}`;
    const reg = await request(app)
      .post('/persons/register')
      .send({ name: base, email: `${base}@test.com`, password: 'password123' });
    expect(reg.status).toBe(201);
    expect(reg.body.token).toBeDefined();

    const again = await request(app)
      .post('/persons/register')
      .send({ name: `${base}2`, email: `${base}@test.com`, password: 'password123' });
    expect(again.status).toBe(409);
  });
});

describe('Payments / Orders router', () => {
  async function seedSellerAndItem() {
    const userRes = await pool.query(
      `INSERT INTO "Person" ("email","name","hashed_password","role")
       VALUES ($1, $2, 'x', 'user') RETURNING id`,
      [`pay_${Date.now()}@test.com`, `pay_${Date.now()}`],
    );
    const itemRes = await pool.query(
      `INSERT INTO "MarketplaceItems" (seller_id, name, description, price, quality, meetup)
       VALUES ($1, 'Test Book', 'desc', 20, 'good', 'Library') RETURNING id`,
      [userRes.rows[0].id],
    );
    return { sellerId: userRes.rows[0].id, itemId: itemRes.rows[0].id };
  }

  test('checkout refuses missing buyer/items', async () => {
    const res = await request(app).post('/payments/checkout').send({ buyer_id: 1 });
    expect(res.status).toBe(400);
  });

  test('checkout rejects bad card, cvv, expiry', async () => {
    const { sellerId, itemId } = await seedSellerAndItem();
    const base = {
      buyer_id: sellerId,
      items: [{ item_id: itemId, seller_id: sellerId, quantity: 1, price: 20 }],
    };

    const badCard = await request(app)
      .post('/payments/checkout')
      .send({ ...base, cardNumber: '123', expiry: '12/28', cvv: '123' });
    expect(badCard.status).toBe(400);

    const badCvv = await request(app)
      .post('/payments/checkout')
      .send({ ...base, cardNumber: '4242424242424242', expiry: '12/28', cvv: '12' });
    expect(badCvv.status).toBe(400);

    const badExpiry = await request(app)
      .post('/payments/checkout')
      .send({ ...base, cardNumber: '4242424242424242', expiry: '2028', cvv: '123' });
    expect(badExpiry.status).toBe(400);
  });

  test('checkout declines 0000 cards and succeeds otherwise', async () => {
    const { sellerId, itemId } = await seedSellerAndItem();
    const base = {
      buyer_id: sellerId,
      items: [{ item_id: itemId, seller_id: sellerId, quantity: 1, price: 20 }],
    };

    const declined = await request(app)
      .post('/payments/checkout')
      .send({
        ...base,
        cardNumber: '4111110000050000',
        expiry: '12/28',
        cvv: '123',
      });
    expect(declined.status).toBe(402);

    const ok = await request(app)
      .post('/payments/checkout')
      .send({
        ...base,
        cardNumber: '4242424242424242',
        expiry: '12/28',
        cvv: '123',
      });
    expect(ok.status).toBe(200);
    expect(ok.body.success).toBe(true);
    expect(ok.body.order.total_amount).toBe('20.00');
    expect(ok.body.last4).toBe('4242');

    const order = await request(app).get(`/payments/orders/${ok.body.order.id}`);
    expect(order.status).toBe(200);
    expect(order.body.items.length).toBe(1);
    expect(order.body.items[0].item_id).toBe(itemId);

    const missing = await request(app).get('/payments/orders/999999');
    expect(missing.status).toBe(404);
  });
});

let personEmailCounter = 0;
function uniquePersonEmail() {
  personEmailCounter += 1;
  return `pp_${personEmailCounter}_${Date.now()}@test.com`;
}
