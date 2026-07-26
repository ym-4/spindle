const pool = require('./db');

async function createOrder(buyerId, totalAmount, paymentRef, items) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { rows } = await client.query(
      `INSERT INTO "Orders" ("buyer_id", "total_amount", "status", "payment_ref")
       VALUES ($1, $2, 'paid', $3) RETURNING *`,
      [buyerId, totalAmount, paymentRef],
    );
    const order = rows[0];

    for (const item of items) {
      await client.query(
        `INSERT INTO "OrderItems" ("order_id", "item_id", "seller_id", "quantity", "price_at_purchase")
         VALUES ($1, $2, $3, $4, $5)`,
        [order.id, item.item_id, item.seller_id, item.quantity, item.price],
      );
    }

    await client.query('COMMIT');
    return order;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function getOrderById(orderId) {
  const { rows } = await pool.query('SELECT * FROM "Orders" WHERE "id" = $1', [orderId]);
  return rows[0];
}

async function getOrderItems(orderId) {
  const { rows } = await pool.query('SELECT * FROM "OrderItems" WHERE "order_id" = $1', [orderId]);
  return rows;
}

module.exports = { createOrder, getOrderById, getOrderItems };
