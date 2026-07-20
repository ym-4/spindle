const pool = require('./db');

// find-or-create so duplicate tag names never pile up
async function findOrCreateTag(name) {
  const normalized = name.trim().toLowerCase();
  const { rows } = await pool.query(
    `INSERT INTO "Tags" ("name") VALUES ($1)
     ON CONFLICT ("name") DO UPDATE SET "name" = EXCLUDED."name"
     RETURNING "id", "name"`,
    [normalized]
  );
  return rows[0];
}

async function getAllTags() {
  const { rows } = await pool.query('SELECT "id", "name" FROM "Tags" ORDER BY "name"');
  return rows;
}

module.exports = { findOrCreateTag, getAllTags };
