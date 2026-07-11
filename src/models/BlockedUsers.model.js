const pool = require('./db');

module.exports.insertBlock = async function insertBlock(data) {
  try {
    await pool.query(
      `ALTER TABLE "BlockedUsers" ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT NOW()`,
    );
  } catch {}
  const { rows } = await pool.query(
    `INSERT INTO "BlockedUsers" (blocker_id, blocked_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [data.blocker_id, data.blocked_id],
  );
  return rows[0];
};

module.exports.isBlocked = async function isBlocked(blocker_id, blocked_id) {
  const { rows } = await pool.query(
    `SELECT 1 FROM "BlockedUsers" WHERE blocker_id = $1 AND blocked_id = $2`,
    [blocker_id, blocked_id],
  );
  return rows.length > 0;
};
