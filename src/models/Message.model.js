const pool = require('./db');

module.exports.listContacts = async function listContacts(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.avatar, p.profile_image, p.display_name,
            COALESCE((
              SELECT COUNT(*)::int FROM "PersonalMessages" um
              WHERE um.sender_id = p.id AND um.recipient_id = $1
                AND um.deleted_at IS NULL
                AND um.created_at > COALESCE(
                  (SELECT mrs.last_read_at FROM "MessageReadState" mrs
                   WHERE mrs.user_id = $1 AND mrs.peer_id = p.id),
                  '1970-01-01'::timestamp
                )
            ), 0) AS unread_count,
            (
              SELECT lm.body FROM "PersonalMessages" lm
              WHERE lm.deleted_at IS NULL
                AND ((lm.sender_id = $1 AND lm.recipient_id = p.id)
                  OR (lm.sender_id = p.id AND lm.recipient_id = $1))
              ORDER BY lm.created_at DESC LIMIT 1
            ) AS last_message,
            (
              SELECT lm.created_at FROM "PersonalMessages" lm
              WHERE lm.deleted_at IS NULL
                AND ((lm.sender_id = $1 AND lm.recipient_id = p.id)
                  OR (lm.sender_id = p.id AND lm.recipient_id = $1))
              ORDER BY lm.created_at DESC LIMIT 1
            ) AS last_message_at
     FROM "UserFriends" uf
     JOIN "Person" p ON p.id = uf.friend_id
     WHERE uf.user_id = $1
     ORDER BY last_message_at DESC NULLS LAST, p.name`,
    [userId],
  );
  return rows.map((r) => ({
    ...r,
    last_message: r.last_message || '',
    unread_count: Number(r.unread_count) || 0,
  }));
};

module.exports.markConversationRead = async function markConversationRead(userId, peerId) {
  await pool.query(
    `INSERT INTO "MessageReadState" (user_id, peer_id, last_read_at)
     VALUES ($1, $2, NOW())
     ON CONFLICT (user_id, peer_id) DO UPDATE SET last_read_at = NOW()`,
    [userId, peerId],
  );
};

module.exports.totalUnreadCount = async function totalUnreadCount(userId) {
  const { rows } = await pool.query(
    `SELECT COALESCE(SUM(sub.cnt), 0)::int AS total
     FROM (
       SELECT COUNT(*)::int AS cnt
       FROM "PersonalMessages" m
       JOIN "UserFriends" uf ON uf.friend_id = m.sender_id AND uf.user_id = $1
       WHERE m.recipient_id = $1 AND m.deleted_at IS NULL
         AND m.created_at > COALESCE(
           (SELECT last_read_at FROM "MessageReadState"
            WHERE user_id = $1 AND peer_id = m.sender_id),
           '1970-01-01'::timestamp
         )
       GROUP BY m.sender_id
     ) sub`,
    [userId],
  );
  return rows[0]?.total ?? 0;
};

module.exports.findPersonById = async function findPersonById(userId) {
  const { rows } = await pool.query(`SELECT id, name, avatar, role FROM "Person" WHERE id = $1`, [
    userId,
  ]);
  return rows[0] ?? null;
};

module.exports.getConversation = async function getConversation(userId, otherUserId, since) {
  const params = [userId, otherUserId];
  let sinceClause = '';
  if (since) {
    sinceClause = ' AND created_at > $3';
    params.push(since);
  }
  const { rows } = await pool.query(
    `SELECT m.id, m.sender_id, m.recipient_id, m.body, m.created_at, m.edited_at, m.deleted_at,
            COALESCE(
              (SELECT json_agg(json_build_object('emoji', r.emoji, 'user_id', r.user_id))
               FROM "MessageReactions" r WHERE r.message_id = m.id),
              '[]'::json
            ) AS reactions
     FROM "PersonalMessages" m
     WHERE ((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))
     ${sinceClause}
     ORDER BY m.created_at ASC`,
    params,
  );
  return rows.map((r) => ({
    ...r,
    reactions: Array.isArray(r.reactions) ? r.reactions : [],
  }));
};

module.exports.getMessageById = async function getMessageById(messageId) {
  const { rows } = await pool.query(
    `SELECT id, sender_id, recipient_id, body, created_at, edited_at, deleted_at
     FROM "PersonalMessages" WHERE id = $1`,
    [messageId],
  );
  return rows[0] ?? null;
};

module.exports.editMessage = async function editMessage(messageId, userId, body) {
  const msg = await module.exports.getMessageById(messageId);
  if (!msg || msg.sender_id !== userId || msg.deleted_at) return null;
  const { rows } = await pool.query(
    `UPDATE "PersonalMessages" SET body = $1, edited_at = CURRENT_TIMESTAMP
     WHERE id = $2 RETURNING id, sender_id, recipient_id, body, created_at, edited_at, deleted_at`,
    [body, messageId],
  );
  return rows[0] ?? null;
};

module.exports.deleteMessage = async function deleteMessage(messageId, userId) {
  const msg = await module.exports.getMessageById(messageId);
  if (!msg || msg.sender_id !== userId) return null;
  const { rows } = await pool.query(
    `UPDATE "PersonalMessages" SET deleted_at = CURRENT_TIMESTAMP, body = '[deleted]'
     WHERE id = $1
     RETURNING id, sender_id, recipient_id, body, created_at, edited_at, deleted_at`,
    [messageId],
  );
  return rows[0] ?? null;
};

module.exports.setReaction = async function setReaction(messageId, userId, emoji) {
  const msg = await module.exports.getMessageById(messageId);
  if (!msg || msg.deleted_at) return null;
  if (msg.sender_id !== userId && msg.recipient_id !== userId) return null;
  await pool.query(
    `INSERT INTO "MessageReactions" (message_id, user_id, emoji)
     VALUES ($1, $2, $3)
     ON CONFLICT (message_id, user_id) DO UPDATE SET emoji = EXCLUDED.emoji`,
    [messageId, userId, emoji],
  );
  const { rows } = await pool.query(
    `SELECT emoji, user_id FROM "MessageReactions" WHERE message_id = $1`,
    [messageId],
  );
  return rows;
};

module.exports.getMessageReactions = async function getMessageReactions(messageId) {
  const { rows } = await pool.query(
    `SELECT emoji, user_id FROM "MessageReactions" WHERE message_id = $1`,
    [messageId],
  );
  return rows;
};

module.exports.removeReaction = async function removeReaction(messageId, userId) {
  await pool.query(`DELETE FROM "MessageReactions" WHERE message_id = $1 AND user_id = $2`, [
    messageId,
    userId,
  ]);
};

async function areFriends(userA, userB) {
  const { rows } = await pool.query(
    `SELECT 1 FROM "UserFriends" WHERE user_id = $1 AND friend_id = $2`,
    [userA, userB],
  );
  return rows.length > 0;
}

module.exports.areFriends = areFriends;

module.exports.sendMessage = async function sendMessage(senderId, recipientId, body) {
  if (!(await areFriends(senderId, recipientId))) {
    throw Object.assign(new Error('You can only message friends.'), { status: 403 });
  }
  const { rows } = await pool.query(
    `INSERT INTO "PersonalMessages" (sender_id, recipient_id, body)
     VALUES ($1, $2, $3)
     RETURNING id, sender_id, recipient_id, body, created_at`,
    [senderId, recipientId, body],
  );
  return rows[0];
};
