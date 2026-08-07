const pool = require('./db');

module.exports.insertBlock = async function insertBlock(data) {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "BlockedUsers" (
        blocker_id INTEGER NOT NULL,
        blocked_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (blocker_id, blocked_id)
      )`,
    );
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

module.exports.listBlocked = async function listBlocked(userId) {
  try {
    await pool.query(
      `CREATE TABLE IF NOT EXISTS "BlockedUsers" (
        blocker_id INTEGER NOT NULL,
        blocked_id INTEGER NOT NULL,
        created_at TIMESTAMP DEFAULT NOW(),
        PRIMARY KEY (blocker_id, blocked_id)
      )`,
    );
  } catch {}
  const { rows } = await pool.query(
    `SELECT b.blocked_id, p.name, p.email
     FROM "BlockedUsers" b
     JOIN "Person" p ON p.id = b.blocked_id
     WHERE b.blocker_id = $1
     ORDER BY b.created_at DESC`,
    [userId],
  );
  return rows;
};

module.exports.unblock = async function unblock(blocker_id, blocked_id) {
  const { rowCount } = await pool.query(
    `DELETE FROM "BlockedUsers" WHERE blocker_id = $1 AND blocked_id = $2`,
    [blocker_id, blocked_id],
  );
  return rowCount > 0;
};
