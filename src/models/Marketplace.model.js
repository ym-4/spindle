const pool = require('./db');

module.exports.createItem = async function createItem(
  seller_id,
  name,
  description,
  price,
  quality,
  meetup,
) {
  const { rows } = await pool.query(
    'INSERT INTO "MarketplaceItems" ("seller_id", "name", "description", "price", "quality", "meetup") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [seller_id, name, description, price, quality, meetup],
  );
  return rows[0];
};

// GET ALL items
module.exports.getAllItems = async function getAllItems() {
  const { rows } = await pool.query('SELECT * FROM "MarketplaceItems"');
  return rows;
};

// GET items by id
module.exports.getAllItemsById = async function getAllItemsById(id) {
  const { rows } = await pool.query('SELECT * FROM "MarketplaceItems" WHERE "id" = $1', [id]);
  return rows[0];
};

module.exports.updateItem = async function updateItem(id, data) {
  const { rows } = await pool.query(
    'UPDATE "MarketplaceItems" SET "name" = $1, "price" = $2, "description" = $3, "quality" = $4, "meetup" = $5 WHERE "id" = $6 RETURNING *',
    [data.name, data.price, data.description, data.quality, data.meetup, id],
  );
  return rows[0];
};

module.exports.deleteItem = async function deleteItem(id) {
  const { rows } = await pool.query('DELETE FROM "MarketplaceItems" WHERE "id" = $1 RETURNING *', [
    id,
  ]);
  return rows[0];
};
