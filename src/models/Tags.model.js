const pool = require('../db'); // however you're connecting

// find-or-create so duplicate tag names never pile up
async function findOrCreateTag(name) {
  const normalized = name.trim().toLowerCase();
  const result = await pool.query(
    `INSERT INTO tags (name) VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING tag_id, name`,
    [normalized]
  );
  return result.rows[0];
}

async function setListingTags(listingId, tagNames) {
  // wipe existing tags then re-insert — simplest for edit forms
  await pool.query('DELETE FROM listing_tags WHERE listing_id = $1', [listingId]);

  for (const name of tagNames) {
    const tag = await findOrCreateTag(name);
    await pool.query(
      `INSERT INTO listing_tags (listing_id, tag_id) VALUES ($1, $2)
       ON CONFLICT DO NOTHING`,
      [listingId, tag.tag_id]
    );
  }
}

async function getTagsForListing(listingId) {
  const result = await pool.query(
    `SELECT t.tag_id, t.name FROM tags t
     JOIN listing_tags lt ON lt.tag_id = t.tag_id
     WHERE lt.listing_id = $1`,
    [listingId]
  );
  return result.rows;
}

async function getListingsByTag(tagName) {
  const result = await pool.query(
    `SELECT l.* FROM listings l
     JOIN listing_tags lt ON lt.listing_id = l.listing_id
     JOIN tags t ON t.tag_id = lt.tag_id
     WHERE t.name = $1`,
    [tagName.trim().toLowerCase()]
  );
  return result.rows;
}

async function getAllTags() {
  const result = await pool.query('SELECT tag_id, name FROM tags ORDER BY name');
  return result.rows;
}

module.exports = { findOrCreateTag, setListingTags, getTagsForListing, getListingsByTag, getAllTags };