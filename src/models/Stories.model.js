const pool = require('./db');

const STORY_HOURS = 24;

module.exports.create = async function create(userId, mediaUrl, caption = '') {
  const expires = new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000);
  const { rows } = await pool.query(
    `INSERT INTO "Stories" (user_id, media_url, caption, expires_at)
     VALUES ($1, $2, $3, $4)
     RETURNING id, user_id, media_url, caption, created_at, expires_at`,
    [userId, mediaUrl, caption, expires],
  );
  return rows[0];
};

module.exports.listFeed = async function listFeed(viewerId) {
  const { rows } = await pool.query(
    `SELECT s.id, s.media_url, s.caption, s.created_at, s.expires_at,
            p.id AS user_id, p.name, p.display_name, p.profile_image, p.avatar
     FROM "Stories" s
     JOIN "Person" p ON p.id = s.user_id
     WHERE s.expires_at > NOW()
       AND (
         s.user_id = $1
         OR s.user_id IN (SELECT friend_id FROM "UserFriends" WHERE user_id = $1)
       )
     ORDER BY s.created_at DESC`,
    [viewerId],
  );
  return rows;
};

module.exports.deleteExpired = async function deleteExpired() {
  await pool.query(`DELETE FROM "Stories" WHERE expires_at <= NOW()`);
};
