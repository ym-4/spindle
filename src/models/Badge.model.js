const pool = require('./db');

// Get all badges with unlock status for a user
module.exports.getBadgesForUser = async function getBadgesForUser(userId) {
  const { rows } = await pool.query(
    `SELECT
       b.id,
       b.key,
       b.name,
       b.description,
       b.image_url,
       ub.awarded_at,
       CASE WHEN ub.id IS NOT NULL THEN TRUE ELSE FALSE END AS unlocked
     FROM "Badges" b
     LEFT JOIN "UserBadges" ub ON ub.badge_id = b.id AND ub.user_id = $1
     ORDER BY b.id`,
    [userId],
  );
  return rows;
};

// Award a badge to a user
module.exports.awardBadge = async function awardBadge(userId, badgeKey) {
  const { rows: badgeRows } = await pool.query(`SELECT id FROM "Badges" WHERE key = $1`, [
    badgeKey,
  ]);
  if (!badgeRows[0]) return null;

  const badgeId = badgeRows[0].id;

  const { rows } = await pool.query(
    `INSERT INTO "UserBadges" (user_id, badge_id)
     VALUES ($1, $2)
     ON CONFLICT DO NOTHING
     RETURNING *`,
    [userId, badgeId],
  );
  return rows[0] || null; // null == already owned
};
