const pool = require('./db');
const { findOrCreateTag } = require('./Tags.model');

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

// GET ALL items (each item includes "images" and "tags" arrays, empty if none set)
module.exports.getAllItems = async function getAllItems() {
  const { rows } = await pool.query(`
    SELECT m.*,
      COALESCE(img.images, '[]') AS images,
      COALESCE(tg.tags, '[]') AS tags
    FROM "MarketplaceItems" m
    LEFT JOIN (
      SELECT "item_id",
        json_agg(json_build_object('id', "id", 'image_url', "image_url") ORDER BY "sort_order") AS images
      FROM "ListingImages"
      GROUP BY "item_id"
    ) img ON img."item_id" = m.id
    LEFT JOIN (
      SELECT it."item_id",
        json_agg(json_build_object('id', t."id", 'name', t."name") ORDER BY t."name") AS tags
      FROM "ItemTags" it
      JOIN "Tags" t ON t."id" = it."tag_id"
      GROUP BY it."item_id"
    ) tg ON tg."item_id" = m.id
  `);
  return rows;
};

// GET items by id (includes "images" and "tags" arrays, empty if none set)
module.exports.getAllItemsById = async function getAllItemsById(id) {
  const { rows } = await pool.query(
    `
    SELECT m.*,
      COALESCE(img.images, '[]') AS images,
      COALESCE(tg.tags, '[]') AS tags
    FROM "MarketplaceItems" m
    LEFT JOIN (
      SELECT "item_id",
        json_agg(json_build_object('id', "id", 'image_url', "image_url") ORDER BY "sort_order") AS images
      FROM "ListingImages"
      GROUP BY "item_id"
    ) img ON img."item_id" = m.id
    LEFT JOIN (
      SELECT it."item_id",
        json_agg(json_build_object('id', t."id", 'name', t."name") ORDER BY t."name") AS tags
      FROM "ItemTags" it
      JOIN "Tags" t ON t."id" = it."tag_id"
      GROUP BY it."item_id"
    ) tg ON tg."item_id" = m.id
    WHERE m.id = $1
  `,
    [id],
  );
  return rows[0];
};

// Save uploaded image paths against a listing, preserving upload order.
// Continues sort_order from whatever the item already has, so calling this
// more than once (e.g. adding photos to a listing that already has some,
// which happens in edit mode) doesn't collide sort_order values with the
// existing rows — that would make the "first" image ambiguous.
module.exports.addImagesToItem = async function addImagesToItem(itemId, imagePaths) {
  const { rows: maxRows } = await pool.query(
    'SELECT COALESCE(MAX("sort_order"), -1) AS "maxOrder" FROM "ListingImages" WHERE "item_id" = $1',
    [itemId],
  );
  const startOrder = Number(maxRows[0].maxOrder) + 1;

  const inserted = [];
  for (let i = 0; i < imagePaths.length; i++) {
    const { rows } = await pool.query(
      'INSERT INTO "ListingImages" ("item_id", "image_url", "sort_order") VALUES ($1, $2, $3) RETURNING "id", "image_url", "sort_order"',
      [itemId, imagePaths[i], startOrder + i],
    );
    inserted.push(rows[0]);
  }
  return inserted;
};

// Makes the given image the "cover" (i.e. the one used as the thumbnail,
// which is always whichever image has the lowest sort_order) by re-sequencing
// every image on the item so the chosen one becomes sort_order 0 and the
// rest keep their relative order after it.
module.exports.setCoverImage = async function setCoverImage(itemId, imageId) {
  const { rows } = await pool.query(
    'SELECT "id" FROM "ListingImages" WHERE "item_id" = $1 ORDER BY "sort_order"',
    [itemId],
  );
  const ids = rows.map((r) => r.id);
  const targetIndex = ids.findIndex((id) => id === Number(imageId));
  if (targetIndex === -1) return null;

  // Move the target id to the front, keep everything else in order
  const reordered = [ids[targetIndex], ...ids.filter((_, i) => i !== targetIndex)];

  for (let i = 0; i < reordered.length; i++) {
    await pool.query('UPDATE "ListingImages" SET "sort_order" = $1 WHERE "id" = $2', [
      i,
      reordered[i],
    ]);
  }

  return { itemId: Number(itemId), coverImageId: Number(imageId) };
};

// Remove a single image from a listing
module.exports.deleteItemImage = async function deleteItemImage(imageId, itemId) {
  const { rows } = await pool.query(
    'DELETE FROM "ListingImages" WHERE "id" = $1 AND "item_id" = $2 RETURNING *',
    [imageId, itemId],
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

// Change only the status of a listing (active / sold). Kept separate from
// updateItem so a status change never accidentally touches name/price/etc,
// and so the edit form's submit can't accidentally reset status back to
// active just because it doesn't send a status field.
module.exports.setItemStatus = async function setItemStatus(id, status) {
  const allowed = ['active', 'sold'];
  if (!allowed.includes(status)) {
    const err = new Error(`Invalid status "${status}". Must be one of: ${allowed.join(', ')}`);
    err.status = 400;
    throw err;
  }
  const { rows } = await pool.query(
    'UPDATE "MarketplaceItems" SET "status" = $1 WHERE "id" = $2 RETURNING *',
    [status, id],
  );
  return rows[0];
};

module.exports.deleteItem = async function deleteItem(id) {
  const { rows } = await pool.query('DELETE FROM "MarketplaceItems" WHERE "id" = $1 RETURNING *', [
    id,
  ]);
  return rows[0];
};

// Replace all tags on an item with the given list of tag names (used by create/edit listing)
module.exports.setItemTags = async function setItemTags(itemId, tagNames) {
  await pool.query('DELETE FROM "ItemTags" WHERE "item_id" = $1', [itemId]);

  const attached = [];
  const seenIds = new Set();
  for (const rawName of tagNames) {
    const tag = await findOrCreateTag(rawName);
    await pool.query(
      'INSERT INTO "ItemTags" ("item_id", "tag_id") VALUES ($1, $2) ON CONFLICT DO NOTHING',
      [itemId, tag.id],
    );
    if (!seenIds.has(tag.id)) {
      seenIds.add(tag.id);
      attached.push(tag);
    }
  }
  return attached;
};

// Get all tags attached to a single item
module.exports.getTagsForItem = async function getTagsForItem(itemId) {
  const { rows } = await pool.query(
    `SELECT t."id", t."name"
     FROM "Tags" t
     JOIN "ItemTags" it ON it."tag_id" = t."id"
     WHERE it."item_id" = $1
     ORDER BY t."name"`,
    [itemId],
  );
  return rows;
};

// Get all items that have a given tag name (case-insensitive), with images/tags included
module.exports.getItemsByTag = async function getItemsByTag(tagName) {
  const { rows } = await pool.query(
    `
    SELECT m.*,
      COALESCE(img.images, '[]') AS images,
      COALESCE(tg.tags, '[]') AS tags
    FROM "MarketplaceItems" m
    JOIN "ItemTags" it ON it."item_id" = m.id
    JOIN "Tags" t ON t."id" = it."tag_id" AND t."name" = $1
    LEFT JOIN (
      SELECT "item_id",
        json_agg(json_build_object('id', "id", 'image_url', "image_url") ORDER BY "sort_order") AS images
      FROM "ListingImages"
      GROUP BY "item_id"
    ) img ON img."item_id" = m.id
    LEFT JOIN (
      SELECT it2."item_id",
        json_agg(json_build_object('id', t2."id", 'name', t2."name") ORDER BY t2."name") AS tags
      FROM "ItemTags" it2
      JOIN "Tags" t2 ON t2."id" = it2."tag_id"
      GROUP BY it2."item_id"
    ) tg ON tg."item_id" = m.id
  `,
    [tagName.trim().toLowerCase()],
  );
  return rows;
};

// Recommend up to `limit` other items: prioritizes items sharing tags with
// the given item (ranked by number of shared tags), then fills any remaining
// slots with random items so there are always up to `limit` results.
module.exports.getRecommendedItems = async function getRecommendedItems(itemId, limit = 4) {
  const tags = await module.exports.getTagsForItem(itemId);
  const tagIds = tags.map((t) => t.id);

  const results = [];
  const excludeIds = [Number(itemId)];

  if (tagIds.length > 0) {
    const { rows } = await pool.query(
      `
    SELECT m.*,
      COALESCE(img.images, '[]') AS images,
      COALESCE(tg.tags, '[]') AS tags,
      mc.match_count AS match_count
    FROM "MarketplaceItems" m
    JOIN (
      SELECT "item_id", COUNT(DISTINCT "tag_id") AS match_count
      FROM "ItemTags"
      WHERE "tag_id" = ANY($1::int[])
      GROUP BY "item_id"
    ) mc ON mc."item_id" = m.id
    LEFT JOIN (
      SELECT "item_id",
        json_agg(json_build_object('id', "id", 'image_url', "image_url") ORDER BY "sort_order") AS images
      FROM "ListingImages"
      GROUP BY "item_id"
    ) img ON img."item_id" = m.id
    LEFT JOIN (
      SELECT it2."item_id",
        json_agg(json_build_object('id', t2."id", 'name', t2."name") ORDER BY t2."name") AS tags
      FROM "ItemTags" it2
      JOIN "Tags" t2 ON t2."id" = it2."tag_id"
      GROUP BY it2."item_id"
    ) tg ON tg."item_id" = m.id
    WHERE m.id != $2
    ORDER BY match_count DESC, random()
    LIMIT $3
  `,
      [tagIds, itemId, limit],
    );

    results.push(...rows);
    excludeIds.push(...rows.map((r) => r.id));
  }

  if (results.length < limit) {
    const remaining = limit - results.length;
    const { rows } = await pool.query(
      `
      SELECT m.*,
        COALESCE(img.images, '[]') AS images,
        COALESCE(tg.tags, '[]') AS tags
      FROM "MarketplaceItems" m
      LEFT JOIN (
        SELECT "item_id",
          json_agg(json_build_object('id', "id", 'image_url', "image_url") ORDER BY "sort_order") AS images
        FROM "ListingImages"
        GROUP BY "item_id"
      ) img ON img."item_id" = m.id
      LEFT JOIN (
        SELECT it2."item_id",
          json_agg(json_build_object('id', t2."id", 'name', t2."name") ORDER BY t2."name") AS tags
        FROM "ItemTags" it2
        JOIN "Tags" t2 ON t2."id" = it2."tag_id"
        GROUP BY it2."item_id"
      ) tg ON tg."item_id" = m.id
      WHERE m.id != ALL($1::int[])
      ORDER BY random()
      LIMIT $2
    `,
      [excludeIds, remaining],
    );

    results.push(...rows);
  }

  return results;
};
