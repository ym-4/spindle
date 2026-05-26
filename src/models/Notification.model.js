const pool = require('./db');

async function safePush(userId, notification) {
  try {
    const { pushNotification } = require('../realtime/wsHub');
    pushNotification(userId, notification);
  } catch {
    /* WS not ready during tests */
  }
}

module.exports.create = async function create(userId, { type, title, body, ref_id }) {
  const { rows } = await pool.query(
    `INSERT INTO "Notifications" (user_id, type, title, body, ref_id)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, user_id, type, title, body, ref_id, read, created_at`,
    [userId, type, title, body || '', ref_id ?? null],
  );
  const notification = rows[0];
  safePush(userId, notification);
  return notification;
};

module.exports.listForUser = async function listForUser(userId, limit = 50) {
  const { rows } = await pool.query(
    `SELECT id, type, title, body, ref_id, read, created_at
     FROM "Notifications"
     WHERE user_id = $1
     ORDER BY created_at DESC
     LIMIT $2`,
    [userId, limit],
  );
  return rows;
};

module.exports.unreadCount = async function unreadCount(userId) {
  const { rows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM "Notifications" WHERE user_id = $1 AND read = FALSE`,
    [userId],
  );
  return rows[0]?.count ?? 0;
};

module.exports.markRead = async function markRead(userId, notificationId) {
  await pool.query(
    `UPDATE "Notifications" SET read = TRUE WHERE id = $1 AND user_id = $2`,
    [notificationId, userId],
  );
};

module.exports.markAllRead = async function markAllRead(userId) {
  await pool.query(`UPDATE "Notifications" SET read = TRUE WHERE user_id = $1`, [userId]);
};
