const pool = require('./db');

module.exports.listContacts = async function listContacts(excludeUserId) {
  const { rows } = await pool.query(
    `SELECT id, name, avatar
     FROM "Person"
     WHERE id != $1 AND role = 'user'
     ORDER BY name`,
    [excludeUserId],
  );
  return rows;
};

module.exports.findPersonById = async function findPersonById(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, avatar, role FROM "Person" WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
};

module.exports.getConversation = async function getConversation(userId, otherUserId) {
  const { rows } = await pool.query(
    `SELECT id, sender_id, recipient_id, body, created_at
     FROM "PersonalMessages"
     WHERE (sender_id = $1 AND recipient_id = $2)
        OR (sender_id = $2 AND recipient_id = $1)
     ORDER BY created_at ASC`,
    [userId, otherUserId],
  );
  return rows;
};

module.exports.sendMessage = async function sendMessage(senderId, recipientId, body) {
  const { rows } = await pool.query(
    `INSERT INTO "PersonalMessages" (sender_id, recipient_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, sender_id, recipient_id, body, created_at`,
    [senderId, recipientId, body],
  );
  return rows[0];
};
