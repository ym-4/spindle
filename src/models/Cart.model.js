const pool = require('./db');

// POST to user cart
module.exports.addToCart = async function addToCart(seller_id, user_id, item_id, amount) {
  const { rows } = await pool.query(
    'INSERT INTO "UserCart" (seller_id, user_id, item_id, amount) VALUES ($1, $2, $3, $4)RETURNING *',
    [seller_id, user_id, item_id, amount]
  );
  return rows[0];
};

// GET ALL cart items from user
module.exports.getAllUserCartItems = async function getAllItems() {
  const { rows } = await pool.query('SELECT * FROM "UserCart"');
  return rows;
};


