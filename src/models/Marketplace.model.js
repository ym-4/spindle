const pool = require('./db');

module.exports.createItem = async function createItem(seller_id, name, description, price, quality, meetup) {
  const { rows } = await pool.query(
    'INSERT INTO "MarketplaceItems" ("seller_id", "name", "description", "price", "quality", "meetup") VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    [seller_id, name, description, price, quality, meetup]
  );
  return rows[0];
};

// GET ALL items (each item includes an "images" array, empty if none uploaded)
module.exports.getAllItems = async function getAllItems() {
  const { rows } = await pool.query(`
    SELECT m.*,
      COALESCE(
        json_agg(
          json_build_object('id', li.id, 'image_url', li.image_url)
          ORDER BY li.sort_order
        ) FILTER (WHERE li.id IS NOT NULL), '[]'
      ) AS images
    FROM "MarketplaceItems" m
    LEFT JOIN "ListingImages" li ON li.item_id = m.id
    GROUP BY m.id
  `);
  return rows;
};

// GET items by id (includes an "images" array, empty if none uploaded)
module.exports.getAllItemsById = async function getAllItemsById(id) {
  const { rows } = await pool.query(`
    SELECT m.*,
      COALESCE(
        json_agg(
          json_build_object('id', li.id, 'image_url', li.image_url)
          ORDER BY li.sort_order
        ) FILTER (WHERE li.id IS NOT NULL), '[]'
      ) AS images
    FROM "MarketplaceItems" m
    LEFT JOIN "ListingImages" li ON li.item_id = m.id
    WHERE m.id = $1
    GROUP BY m.id
  `, [id]);
  return rows[0];
};

// Save uploaded image paths against a listing, preserving upload order
module.exports.addImagesToItem = async function addImagesToItem(itemId, imagePaths) {
  const inserted = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const { rows } = await pool.query(
      'INSERT INTO "ListingImages" ("item_id", "image_url", "sort_order") VALUES ($1, $2, $3) RETURNING "id", "image_url", "sort_order"',
      [itemId, imagePaths[i], i]
    );
    inserted.push(rows[0]);
  }
  return inserted;
};

// Remove a single image from a listing
module.exports.deleteItemImage = async function deleteItemImage(imageId, itemId) {
  const { rows } = await pool.query(
    'DELETE FROM "ListingImages" WHERE "id" = $1 AND "item_id" = $2 RETURNING *',
    [imageId, itemId]
  );
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
  const { rows } = await pool.query(
    'DELETE FROM "MarketplaceItems" WHERE "id" = $1 RETURNING *',
    [id]
  );
  return rows[0];
};