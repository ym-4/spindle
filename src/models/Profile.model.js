const pool = require('./db');

async function ensureSettingsRow(userId) {
  await pool.query(
    `INSERT INTO "UserSettings" (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

async function ensurePaymentRow(userId) {
  await pool.query(
    `INSERT INTO "UserPaymentDetails" (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

module.exports.getSettings = async function getSettings(userId) {
  await ensureSettingsRow(userId);
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.email, p.avatar,
            COALESCE(s.bio, '') AS bio,
            COALESCE(s.phone, '') AS phone,
            COALESCE(s.campus, '') AS campus
     FROM "Person" p
     LEFT JOIN "UserSettings" s ON s.user_id = p.id
     WHERE p.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
};

module.exports.updateSettings = async function updateSettings(userId, { name, avatar, bio, phone, campus }) {
  if (name?.trim()) {
    await pool.query(`UPDATE "Person" SET name = $1 WHERE id = $2`, [name.trim(), userId]);
  }
  if (avatar !== undefined) {
    await pool.query(`UPDATE "Person" SET avatar = $1 WHERE id = $2`, [avatar?.trim() || null, userId]);
  }
  await ensureSettingsRow(userId);
  await pool.query(
    `UPDATE "UserSettings"
     SET bio = COALESCE($1, bio),
         phone = COALESCE($2, phone),
         campus = COALESCE($3, campus)
     WHERE user_id = $4`,
    [bio ?? null, phone ?? null, campus ?? null, userId],
  );
  return module.exports.getSettings(userId);
};

module.exports.getPaymentDetails = async function getPaymentDetails(userId) {
  await ensurePaymentRow(userId);
  const { rows } = await pool.query(
    `SELECT billing_name, payment_method, card_last4
     FROM "UserPaymentDetails" WHERE user_id = $1`,
    [userId],
  );
  return rows[0];
};

module.exports.updatePaymentDetails = async function updatePaymentDetails(
  userId,
  { billing_name, payment_method, card_last4 },
) {
  await ensurePaymentRow(userId);
  const { rows } = await pool.query(
    `UPDATE "UserPaymentDetails"
     SET billing_name = COALESCE($1, billing_name),
         payment_method = COALESCE($2, payment_method),
         card_last4 = COALESCE($3, card_last4)
     WHERE user_id = $4
     RETURNING billing_name, payment_method, card_last4`,
    [billing_name ?? null, payment_method ?? null, card_last4 ?? null, userId],
  );
  return rows[0];
};

module.exports.listFriends = async function listFriends(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.avatar
     FROM "UserFriends" uf
     JOIN "Person" p ON p.id = uf.friend_id
     WHERE uf.user_id = $1
     ORDER BY p.name`,
    [userId],
  );
  return rows;
};

module.exports.listFriendCandidates = async function listFriendCandidates(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.avatar
     FROM "Person" p
     WHERE p.id != $1
       AND p.role = 'user'
       AND NOT EXISTS (
         SELECT 1 FROM "UserFriends" uf
         WHERE uf.user_id = $1 AND uf.friend_id = p.id
       )
     ORDER BY p.name`,
    [userId],
  );
  return rows;
};

module.exports.addFriend = async function addFriend(userId, friendId) {
  await pool.query(
    `INSERT INTO "UserFriends" (user_id, friend_id) VALUES ($1, $2)`,
    [userId, friendId],
  );
};

module.exports.removeFriend = async function removeFriend(userId, friendId) {
  const { rowCount } = await pool.query(
    `DELETE FROM "UserFriends" WHERE user_id = $1 AND friend_id = $2`,
    [userId, friendId],
  );
  return rowCount > 0;
};

module.exports.listSavedPosts = async function listSavedPosts(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.category, p.content, p.created_at, sp.created_at AS saved_at
     FROM "SavedPosts" sp
     JOIN "Posts" p ON p.id = sp.post_id
     WHERE sp.user_id = $1
     ORDER BY sp.created_at DESC`,
    [userId],
  );
  return rows;
};

module.exports.savePost = async function savePost(userId, postId) {
  const { rows } = await pool.query(
    `INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2)
     ON CONFLICT (user_id, post_id) DO NOTHING
     RETURNING id, post_id, created_at`,
    [userId, postId],
  );
  return rows[0] ?? null;
};

module.exports.unsavePost = async function unsavePost(userId, postId) {
  const { rowCount } = await pool.query(
    `DELETE FROM "SavedPosts" WHERE user_id = $1 AND post_id = $2`,
    [userId, postId],
  );
  return rowCount > 0;
};

module.exports.listPostHistory = async function listPostHistory(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, category, content, created_at, updated_at
     FROM "Posts"
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
};

module.exports.listJoinedGroups = async function listJoinedGroups(userId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.description, g.school, g.module, gm.role AS member_role
     FROM "GroupMembers" gm
     JOIN "Groups" g ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.name`,
    [userId],
  );
  return rows;
};

module.exports.listChatroomMessages = async function listChatroomMessages(limit = 50) {
  const { rows } = await pool.query(
    `SELECT cm.id, cm.message, cm.created_at, p.id AS user_id, p.name AS user_name
     FROM "ChatroomMessages" cm
     JOIN "Person" p ON p.id = cm.user_id
     ORDER BY cm.created_at DESC
     LIMIT $1`,
    [limit],
  );
  return rows.reverse();
};

module.exports.postChatroomMessage = async function postChatroomMessage(userId, message) {
  const { rows } = await pool.query(
    `INSERT INTO "ChatroomMessages" (user_id, message)
     VALUES ($1, $2)
     RETURNING id, user_id, message, created_at`,
    [userId, message],
  );
  const row = rows[0];
  const userResult = await pool.query(`SELECT name FROM "Person" WHERE id = $1`, [userId]);
  return {
    ...row,
    user_name: userResult.rows[0]?.name ?? 'Unknown',
  };
};

module.exports.findPersonById = async function findPersonById(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, role FROM "Person" WHERE id = $1`,
    [userId],
  );
  return rows[0] ?? null;
};

module.exports.findPostById = async function findPostById(postId) {
  const { rows } = await pool.query(`SELECT id FROM "Posts" WHERE id = $1`, [postId]);
  return rows[0] ?? null;
};
