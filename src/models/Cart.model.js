const pool = require('./db');

// POST to user cart
module.exports.addToCart = async function addToCart(data) {
  const { rows } = await pool.query(
    'INSERT INTO "UserCart" (seller_id, user_id, item_id, amount) VALUES ($1, $2, $3, $4) RETURNING *',
    [data.seller_id, data.user_id, data.item_id, data.amount]
  );
  return rows[0];
};

// GET ALL cart items from user
module.exports.getAllUserCartItems = async function getAllItems() {
  const { rows } = await pool.query('SELECT * FROM "UserCart"');
  return rows;
};

// GET ALL cart items from user by Id
module.exports.getAllUserCartItemsById = async function getAllItemsById(id) {
  const { rows } = await pool.query(`SELECT * FROM "UserCart" WHERE "user_id" = ${id}`);
  return rows;
};

// UPDATE a cart item from user by id
module.exports.updateCartItem = async function updateCartItem(data) {
  const { rows } = await pool.query(
    'UPDATE "UserCart" SET "amount" = $1 WHERE "item_id" = $2 AND "user_id" = $3 RETURNING *',
    [data.new_amount, data.item_id, data.user_id],
  );
  return rows[0];
};

// DELETE an item in a user cart by id
module.exports.removeCartItem = async function removeCartItem(id, user_id) {
  const { rows } = await pool.query(
    'DELETE FROM "UserCart" WHERE "item_id" = $1 AND "user_id" = $2 RETURNING *',
    [id, user_id]
  );
  return rows[0];
};