const { awardBadge } = require('../models/Badge.model');
const Notification = require('../models/Notification.model');
const pool = require('../models/db');

/**
 * Check conditions and award badges to a user.
 *
 * @param {number} userId
 * @param {string[]} triggers
 */
async function checkAndAwardBadges(userId, triggers, context = {}) {
  for (const trigger of triggers) {
    try {
      await checkTrigger(userId, trigger, context);
    } catch (e) {
      console.warn(`Badge check failed (trigger: ${trigger}, user: ${userId}):`, e.message);
    }
  }
}

async function checkTrigger(userId, trigger, context = {}) {
  switch (trigger) {
    case 'post_created': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM "Posts" WHERE user_id = $1`,
        [userId],
      );
      if (rows[0].count >= 1) await tryAward(userId, 'first_post');
      if (rows[0].count >= 10) await tryAward(userId, 'prolific_poster');

      // Night owl badge
      const { rows: nightRows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM "Posts"
         WHERE user_id = $1 AND EXTRACT(HOUR FROM created_at) < 5`,
        [userId],
      );
      if (nightRows[0].count >= 20) await tryAward(userId, 'night_owl');
      break;
    }

    case 'comment_created': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM "PostComments" WHERE user_id = $1`,
        [userId],
      );
      if (rows[0].count >= 1) await tryAward(userId, 'first_comment');
      if (rows[0].count >= 10) await tryAward(userId, 'chatterbox');
      break;
    }

    case 'friend_added': {
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM "Friends"
         WHERE (user_id = $1 OR friend_id = $1) AND status = 'accepted'`,
        [userId],
      );
      if (rows[0].count >= 25) await tryAward(userId, 'social_butterfly');
      break;
    }

    case 'group_joined': {
      await tryAward(userId, 'group_joiner');
      break;
    }

    case 'post_liked': {
      await tryAward(userId, 'liked_post'); // Sprout badge

      // Fan favourite badge
      const { rows: totalLikes } = await pool.query(
        `SELECT COUNT(*)::int AS count
         FROM "PostReactions" pr
         JOIN "Posts" p ON p.id = pr.post_id
         WHERE p.user_id = $1 AND pr.reaction_type = 'like'`,
        [userId],
      );
      if (totalLikes[0].count >= 100) await tryAward(userId, 'fan_favorite');

      // Rising star badge
      if (context.postId) {
        const { rows: postLikes } = await pool.query(
          `SELECT COUNT(*)::int AS count FROM "PostReactions"
           WHERE post_id = $1 AND reaction_type = 'like'`,
          [context.postId],
        );
        if (postLikes[0].count >= 20) await tryAward(userId, 'rising_star');
      }
      break;
    }

    case 'pandabot_used': {
      await tryAward(userId, 'pandabot_user'); //panda pal badge

      // Panda whisperer badge
      const { rows } = await pool.query(
        `SELECT COUNT(*)::int AS count FROM "PostComments"
         WHERE user_id = $1 AND content ~* '@pandabot'`,
        [userId],
      );
      if (rows[0].count >= 50) await tryAward(userId, 'pandabot_whisperer');
      break;
    }
  }
}

async function tryAward(userId, badgeKey) {
  const newBadge = await awardBadge(userId, badgeKey);
  if (!newBadge) return; // already own

  // Fetch badge details
  const { rows } = await pool.query(`SELECT name, description FROM "Badges" WHERE key = $1`, [
    badgeKey,
  ]);
  const badge = rows[0];
  if (!badge) return;

  // notification
  await Notification.create(userId, {
    type: 'badge_unlocked',
    title: `Badge unlocked: ${badge.name}`,
    body: badge.description,
    ref_id: null,
  });
}

module.exports = { checkAndAwardBadges };
