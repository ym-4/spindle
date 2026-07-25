const pool = require('./db');

// Run once on module load — add any missing columns
(async function migratePosts() {
  try {
    await pool.query(
      `ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS visibility TEXT DEFAULT 'everyone'`,
    );
    await pool.query(`ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS pinned BOOLEAN DEFAULT FALSE`);
    await pool.query(`ALTER TABLE "Posts" ADD COLUMN IF NOT EXISTS gif_url TEXT`);
  } catch (e) {
    console.warn('[Posts.model] Migration skipped:', e.message);
  }
})();

// Get all Posts
module.exports.getAllPost = async function getAllPost() {
  const { rows } = await pool.query(`
  SELECT 
    p.id,
    p.user_id,
    p.title,
    p.category,
    p.content,
    p.attachment_url,
    p.gif_url,
    pp.id AS poll_id,
    p.created_at,
    p.updated_at,
    p.is_anonymous,
    p.visibility,
    p.pinned,
    per.name AS author_name,
    per.profile_image AS author_avatar,

    COUNT(DISTINCT pc.id)::int AS comment_count,

    COUNT(DISTINCT pr.id)
      FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,

    COUNT(DISTINCT pr.id)
      FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count

  FROM "Posts" p

  LEFT JOIN "PostPolls" pp
  ON pp.post_id = p.id

  JOIN "Person" per
    ON p.user_id = per.id

  LEFT JOIN "PostComments" pc
    ON pc.post_id = p.id

  LEFT JOIN "PostReactions" pr
    ON pr.post_id = p.id

  GROUP BY
    p.id,
    p.user_id,
    p.title,
    p.category,
    p.content,
    p.attachment_url,
    p.gif_url,
    pp.id,
    p.is_anonymous,
    p.created_at,
    p.updated_at,
    p.visibility,
    p.pinned,
    per.name,
    per.profile_image

  ORDER BY p.pinned DESC, p.created_at DESC
  `);

  return rows;
};

// GET post by id
module.exports.getPostByID = async function getPostByID(data) {
  const VALUES = [data.id];

  const { rows } = await pool.query(
    `
    SELECT 
      p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.gif_url,
      pp.id AS poll_id,
      p.created_at,
      p.updated_at,
      p.is_anonymous,
      p.visibility,
      p.pinned,

      per.name AS author_name,
      per.profile_image AS author_avatar,

      COUNT(DISTINCT pc.id)::int AS comment_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count

    FROM "Posts" p

    LEFT JOIN "PostPolls" pp
    ON pp.post_id = p.id

    JOIN "Person" per
      ON p.user_id = per.id

    LEFT JOIN "PostComments" pc
      ON pc.post_id = p.id

    LEFT JOIN "PostReactions" pr
      ON pr.post_id = p.id

    WHERE p.id = $1

    GROUP BY
      p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.gif_url,
      pp.id,
      p.is_anonymous,
      p.created_at,
      p.updated_at,
      p.visibility,
      p.pinned,
      per.name,
      per.profile_image
  `,
    VALUES,
  );

  return rows[0];
};

// GET Post by Category
module.exports.getPostByCategory = async function getPostByCategory(data) {
  const categoryMap = { confession: 'confession', 'q&a': 'qna', qna: 'qna', general: 'general' };
  const cat = categoryMap[(data.category || '').toLowerCase()] || data.category;
  const VALUES = [cat];

  const { rows } = await pool.query(
    `
    SELECT p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.gif_url,
      pp.id AS poll_id,
      p.created_at,
      p.updated_at,
      p.is_anonymous,
      p.visibility,
      p.pinned,

      per.name AS author_name,
      per.profile_image AS author_avatar,

      COUNT(DISTINCT pc.id)::int AS comment_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count

    FROM "Posts" p

    LEFT JOIN "PostPolls" pp
    ON pp.post_id = p.id

    JOIN "Person" per
      ON p.user_id = per.id

    LEFT JOIN "PostComments" pc
      ON pc.post_id = p.id

    LEFT JOIN "PostReactions" pr
      ON pr.post_id = p.id

    WHERE p.category = $1

    GROUP BY
      p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.gif_url,
      pp.id,
      p.is_anonymous,
      p.created_at,
      p.updated_at,
      p.visibility,
      p.pinned,
      per.name,
      per.profile_image

    ORDER BY p.pinned DESC, p.created_at DESC
  `,
    VALUES,
  );

  return rows;
};

// GET related posts
module.exports.getRelatedPosts = async function getRelatedPosts(data) {
  const VALUES = [data.category, data.id];

  const { rows } = await pool.query(
    `WITH current_tags AS (
       SELECT tag_id FROM "PostTags" WHERE post_id = $2
     )
     SELECT
       p.id, p.title, p.category, p.is_anonymous, p.view_count,
       u.name AS author_name,
       u.profile_image AS author_avatar,
       COUNT(DISTINCT pc.id)::int AS comment_count,
       COUNT(DISTINCT pt.tag_id) FILTER (
         WHERE pt.tag_id IN (SELECT tag_id FROM current_tags)
       )::int AS shared_tag_count
     FROM "Posts" p
     LEFT JOIN "Person" u ON p.user_id = u.id
     LEFT JOIN "PostComments" pc ON pc.post_id = p.id
     LEFT JOIN "PostTags" pt ON pt.post_id = p.id
     WHERE p.id != $2
       AND p.is_anonymous = FALSE
       AND (
         p.category = $1
         OR pt.tag_id IN (SELECT tag_id FROM current_tags)
       )
     GROUP BY p.id, u.name, u.profile_image
     ORDER BY shared_tag_count DESC, (p.category = $1) DESC, p.view_count DESC, RANDOM()
     LIMIT 3`,
    VALUES,
  );
  return rows;
};

// Get top 3 hot posts (right sidebar)
module.exports.getHotPosts = async function getHotPosts() {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.title,
       p.category,
       p.created_at,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count,
       COUNT(DISTINCT pc.id)::int AS comment_count,
       p.view_count,
      
       (
         (COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like') * 2)
         + COUNT(DISTINCT pc.id)
         + (p.view_count * 0.1)
       ) / GREATEST(1, EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 3600) AS hot_score
     FROM "Posts" p
     LEFT JOIN "PostReactions" pr ON pr.post_id = p.id
     LEFT JOIN "PostComments"  pc ON pc.post_id = p.id
     WHERE p.created_at >= NOW() - INTERVAL '7 days'
       AND p.is_anonymous = FALSE
     GROUP BY p.id
     ORDER BY hot_score DESC
     LIMIT 3`,
  );
  return rows;
};

// GET posts by user ID (for profile page)
module.exports.getPostsByUserID = async function getPostsByUserID(data) {
  const { rows } = await pool.query(
    `SELECT
      p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.gif_url,
      p.created_at,
      p.updated_at,
      p.is_anonymous,
      p.visibility,
      p.pinned,
      pp.id AS poll_id,
      per.name AS author_name,
      per.profile_image AS author_avatar,
      COUNT(DISTINCT pc.id)::int AS comment_count,
      COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like')::int    AS like_count,
      COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count
    FROM "Posts" p
    LEFT JOIN "PostPolls" pp ON pp.post_id  = p.id
    JOIN "Person" per ON per.id       = p.user_id
    LEFT JOIN "PostComments" pc ON pc.post_id  = p.id
    LEFT JOIN "PostReactions" pr ON pr.post_id = p.id
    WHERE p.user_id = $1
    AND p.is_anonymous = FALSE 
    GROUP BY
      p.id, p.user_id, p.title, p.category, p.content,
      p.attachment_url, p.gif_url, pp.id, p.is_anonymous,
      p.created_at, p.updated_at, p.visibility, p.pinned,
      per.name, per.profile_image
    ORDER BY p.pinned DESC, p.created_at DESC`,
    [data.user_id],
  );
  return rows;
};

// Create new post
module.exports.insertPost = async function insertPost(data) {
  const visibility = data.visibility || 'everyone';
  const pinned = data.pinned || false;

  const VALUES = [
    data.user_id,
    data.title,
    data.category,
    data.content,
    data.attachment_url,
    data.gif_url,
    data.is_anonymous,
    visibility,
    pinned,
  ];

  const { rows } = await pool.query(
    `INSERT INTO "Posts" (user_id, title, category, content, attachment_url, gif_url, is_anonymous, visibility, pinned) 
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
    VALUES,
  );

  return rows[0];
};

// update post by ID (owner only)
module.exports.updatePostByID = async function updatePostByID(data) {
  const VALUES = [
    data.title,
    data.content,
    data.category,
    data.attachment_url,
    data.gif_url,
    data.visibility || 'everyone',
    data.id,
  ];

  const { rows } = await pool.query(
    `UPDATE "Posts" SET "title" = $1, "content" = $2, "category" = $3, "attachment_url" = $4, "gif_url" = $5, "visibility" = $6, "updated_at" = CURRENT_TIMESTAMP 
     WHERE "id" = $7 RETURNING *`,
    VALUES,
  );

  return rows[0];
};

module.exports.togglePin = async function togglePin(postId, userId) {
  const { rows } = await pool.query(
    `UPDATE "Posts" SET pinned = NOT COALESCE(pinned, FALSE) WHERE id = $1 AND user_id = $2 RETURNING pinned`,
    [postId, userId],
  );
  return rows[0] || null;
};

// delete a post (owner only)
module.exports.deletePostByID = async function deletePostByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('DELETE FROM "Posts" WHERE "id" = $1 RETURNING *', VALUES);
  return rows[0];
};

// ========== poll ==============
// Create a poll for a post
module.exports.insertPoll = async function insertPoll(data) {
  const VALUES = [data.post_id, data.question];
  const { rows } = await pool.query(
    'INSERT INTO "PostPolls" (post_id, question) VALUES ($1, $2) RETURNING id, post_id, question',
    VALUES,
  );
  return rows[0];
};

// Insert a poll option
module.exports.insertPollOption = async function insertPollOption(data) {
  const VALUES = [data.poll_id, data.option_text];
  const { rows } = await pool.query(
    'INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, $2) RETURNING id',
    VALUES,
  );
  return rows[0];
};

module.exports.updatePollQuestion = async function updatePollQuestion(data) {
  const VALUES = [data.question, data.post_id];
  const { rows } = await pool.query(
    `UPDATE "PostPolls" SET question = $1 WHERE post_id = $2 RETURNING *`,
    VALUES,
  );
  return rows[0] || null;
};

module.exports.deletePollByPostID = async function deletePollByPostID(data) {
  const VALUES = [data.post_id];
  const { rows } = await pool.query(
    `DELETE FROM "PostPolls" WHERE post_id = $1 RETURNING *`,
    VALUES,
  );
  return rows[0] || null;
};

// GET poll by post ID (with options + vote counts)
module.exports.getPollByPostID = async function getPollByPostID(data) {
  const pollSQL = `SELECT * FROM "PostPolls" WHERE post_id = $1`;
  const { rows: pollRows } = await pool.query(pollSQL, [data.post_id]);
  if (!pollRows[0]) return null;

  const poll = pollRows[0];

  const optionsSQL = `
    SELECT
      po.id,
      po.option_text,
      COUNT(pv.id)::int AS vote_count
    FROM "PollOptions" po
    LEFT JOIN "PollVotes" pv ON pv.option_id = po.id
    WHERE po.poll_id = $1
    GROUP BY po.id
    ORDER BY po.id
  `;
  const { rows: optionRows } = await pool.query(optionsSQL, [poll.id]);
  poll.options = optionRows;
  return poll;
};

// Vote on a poll option
module.exports.insertPollVote = async function insertPollVote(data) {
  const VALUES = [data.poll_id, data.option_id, data.user_id];
  const { rows } = await pool.query(
    'INSERT INTO "PollVotes" (poll_id, option_id, user_id) VALUES ($1, $2, $3) RETURNING *',
    VALUES,
  );
  return rows[0];
};

// GET user's vote on a poll
module.exports.getUserPollVote = async function getUserPollVote(data) {
  const VALUES = [data.poll_id, data.user_id];
  const { rows } = await pool.query(
    `SELECT * FROM "PollVotes" WHERE poll_id = $1 AND user_id = $2`,
    VALUES,
  );
  return rows[0] || null;
};

module.exports.deleteUserPollVote = async function deleteUserPollVote(data) {
  const VALUES = [data.poll_id, data.user_id];
  const { rows } = await pool.query(
    `DELETE FROM "PollVotes" WHERE poll_id = $1 AND user_id = $2 RETURNING *`,
    VALUES,
  );
  return rows[0] || null;
};

//========== TAGGING ==============
// Find or create a tag by name, return the full row (id, name)
module.exports.upsertTag = async function upsertTag(data) {
  const VALUES = [data.name.toLowerCase().trim()];
  const { rows } = await pool.query(
    `INSERT INTO "Tags" (name)
     VALUES ($1)
     ON CONFLICT (name) DO UPDATE SET name = EXCLUDED.name
     RETURNING *`,
    VALUES,
  );

  return rows[0];
};

// Attach an array of tag ids to a post
module.exports.insertPostTags = async function insertPostTags(data) {
  if (!data.tag_ids.length) return;

  const placeholders = data.tag_ids.map((_, i) => `($1, $${i + 2})`).join(', ');
  const VALUES = [data.post_id, ...data.tag_ids];

  await pool.query(
    `INSERT INTO "PostTags" (post_id, tag_id) VALUES ${placeholders} ON CONFLICT DO NOTHING`,
    VALUES,
  );
};

// GET all tags attached to a post
module.exports.getTagsByPostID = async function getTagsByPostID(data) {
  const VALUES = [data.post_id];

  const { rows } = await pool.query(
    `SELECT t.id, t.name
     FROM "Tags" t
     JOIN "PostTags" pt ON pt.tag_id = t.id
     WHERE pt.post_id = $1
     ORDER BY t.name`,
    VALUES,
  );

  return rows;
};

// Remove all tags currently attached to a post
module.exports.deletePostTags = async function deletePostTags(data) {
  const VALUES = [data.post_id];

  const { rows } = await pool.query(
    'DELETE FROM "PostTags" WHERE "post_id" = $1 RETURNING *',
    VALUES,
  );

  return rows;
};

// Search existing tags by prefix
module.exports.searchTags = async function searchTags(data) {
  const VALUES = [`${data.query.toLowerCase()}%`];

  const { rows } = await pool.query(
    `SELECT t.id, t.name, COUNT(pt.post_id)::int AS usage_count
     FROM "Tags" t
     LEFT JOIN "PostTags" pt ON pt.tag_id = t.id
     WHERE t.name ILIKE $1
     GROUP BY t.id
     ORDER BY usage_count DESC, t.name
     LIMIT 10`,
    VALUES,
  );

  return rows;
};

//==================== post interactions (saves, likes, etc) ================================
// saves
// GET saved posts by user ID
module.exports.getSavedByUserID = async function getSavedByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "SavedPosts" WHERE user_id = $1', VALUES);
  return rows;
};

// Create new save
module.exports.insertSaved = async function insertSaved(data) {
  const VALUES = [data.user_id, data.post_id];
  const { rows } = await pool.query(
    'INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2) RETURNING id',
    VALUES,
  );
  return rows[0];
};

// delete a save
module.exports.deleteSavedByID = async function deleteSavedByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('DELETE FROM "SavedPosts" WHERE "id" = $1 RETURNING *', VALUES);
  return rows[0];
};

// likes and dislikes
// GET reaction state by user ID
module.exports.getReactionByUserID = async function getReactionByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "PostReactions" where user_id = $1', VALUES);
  return rows;
};

// GET posts liked by a user (for profile page)
module.exports.getLikedPostsByUserID = async function getLikedPostsByUserID(data) {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.title,
       p.category,
       p.created_at,
       p.is_anonymous,
       p.view_count,
       per.name AS author_name,
       COUNT(DISTINCT pc.id)::int AS comment_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count,
       pr_me.reaction_type AS my_reaction
     FROM "PostReactions" pr_me
     JOIN "Posts" p ON p.id = pr_me.post_id
     JOIN "Person" per ON per.id = p.user_id
     LEFT JOIN "PostComments" pc ON pc.post_id = p.id
     LEFT JOIN "PostReactions" pr ON pr.post_id = p.id
     WHERE pr_me.user_id = $1
       AND pr_me.reaction_type = 'like'
       AND p.is_anonymous = FALSE
     GROUP BY p.id, p.title, p.category, p.created_at, p.is_anonymous,
              p.view_count, per.name, pr_me.reaction_type
     ORDER BY p.created_at DESC`,
    [data.user_id],
  );
  return rows;
};

// like a post
module.exports.insertLike = async function insertLike(data) {
  const VALUES = [data.post_id, data.user_id, data.reaction_type];
  const { rows } = await pool.query(
    'INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id',
    VALUES,
  );
  return rows[0];
};

// update reaction type
module.exports.updateReaction = async function updateReaction(data) {
  const VALUES = [data.reaction_type, data.user_id, data.id];
  const { rows } = await pool.query(
    'UPDATE "PostReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 and "id" = $3 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// delete a reaction
module.exports.deleteReaction = async function deleteReaction(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query(
    'DELETE FROM "PostReactions" WHERE "id" = $1 and "user_id" = $2 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// reporting a post
module.exports.insertReport = async function insertReport(data) {
  const VALUES = [data.post_id, data.user_id, data.reason, data.description || ''];
  const { rows } = await pool.query(
    'INSERT INTO "Reports" (post_id, user_id, reason, description) VALUES ($1, $2, $3, $4) RETURNING *',
    VALUES,
  );
  return rows[0];
};

module.exports.getAllReports = async function getAllReports(includeDismissed) {
  const { rows } = await pool.query(
    `SELECT r.id, r.post_id, r.reason, r.description, r.created_at, r.dismissed,
            u.id AS reporter_id, u.name AS reporter_name, u.email AS reporter_email,
            p.title AS post_title, p.user_id AS post_author_id,
            pa.name AS post_author_name
     FROM "Reports" r
     JOIN "Person" u ON r.user_id = u.id
     JOIN "Posts" p ON r.post_id = p.id
     LEFT JOIN "Person" pa ON p.user_id = pa.id
     ${includeDismissed ? '' : 'WHERE (r.dismissed IS NULL OR r.dismissed = FALSE)'}
      ORDER BY r.created_at DESC`,
  );
  return rows;
};

module.exports.searchAllPosts = async function searchAllPosts({ search, category, date } = {}) {
  // Map frontend category values to actual enum values
  const categoryMap = {
    confession: 'confession',
    'q&a': 'qna',
    qna: 'qna',
    general: 'general',
  };
  const mappedCategory = category ? categoryMap[category.toLowerCase()] || null : null;
  let sql = `SELECT p.id, p.title, p.category, p.content, p.created_at,
             per.name AS author_name, per.id AS author_id, per.profile_image AS author_avatar
             FROM "Posts" p
             LEFT JOIN "Person" per ON p.user_id = per.id
             WHERE 1=1`;
  const params = [];
  let idx = 1;
  if (search) {
    sql += ` AND (p.title ILIKE $${idx} OR p.content ILIKE $${idx} OR per.name ILIKE $${idx})`;
    params.push(`%${search}%`);
    idx++;
  }
  if (mappedCategory) {
    sql += ` AND p.category = $${idx}`;
    params.push(mappedCategory);
    idx++;
  }
  if (date) {
    const hours = parseInt(date, 10);
    if (hours > 0) {
      sql += ` AND p.created_at > NOW() - INTERVAL '${hours} hours'`;
    }
  }
  sql += ` ORDER BY p.created_at DESC LIMIT 200`;
  const { rows } = await pool.query(sql, params);
  return rows;
};

// sort posts
module.exports.getSortedPosts = async function getSortedPosts(data) {
  const sort = data.sort || 'newest';
  const timeframe = data.timeframe || 'all';
  const category = data.category || null;

  let timeFilter = '';
  if (timeframe !== 'all' && (sort === 'top' || sort === 'hot')) {
    const intervals = {
      today: `INTERVAL '1 day'`,
      week: `INTERVAL '7 days'`,
      month: `INTERVAL '30 days'`,
      year: `INTERVAL '365 days'`,
    };
    const interval = intervals[timeframe];
    if (interval) timeFilter = `AND p.created_at >= NOW() - ${interval}`;
  }

  // Category filter
  const categoryFilter = category ? `AND p.category = '${category}'` : '';

  // Sort order
  const orderMap = {
    newest: 'p.created_at DESC',
    oldest: 'p.created_at ASC',
    // Hot: high engagement in recent time — weighted score
    hot: `((COUNT(DISTINCT pr.id) * 2) + COUNT(DISTINCT pc.id) + (p.view_count * 0.1)) DESC, p.created_at DESC`,
    // Top: highest likes (likes - dislikes)
    top: `(COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like') - COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')) DESC, p.created_at DESC`,
  };
  const orderBy = orderMap[sort] || orderMap.newest;

  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.user_id,
       p.title,
       p.category,
       p.content,
       p.created_at,
       p.updated_at,
       p.is_anonymous,
       p.attachment_url,
       p.gif_url,
       p.view_count,
       p.pinned,
       pp.id AS poll_id,
       per.name AS author_name,
       per.profile_image AS author_avatar,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count,
       COUNT(DISTINCT pc.id)::int AS comment_count
     FROM "Posts" p
     JOIN "Person" per ON per.id    = p.user_id
     LEFT JOIN "PostPolls" pp ON pp.post_id = p.id
     LEFT JOIN "PostReactions" pr ON pr.post_id = p.id
     LEFT JOIN "PostComments" pc ON pc.post_id = p.id
     WHERE 1=1
     ${categoryFilter}
     ${timeFilter}
     GROUP BY p.id, p.user_id, p.title, p.category, p.content,
              p.created_at, p.updated_at, p.is_anonymous,
              p.attachment_url, p.gif_url, p.view_count,
              p.pinned, pp.id, per.name, per.profile_image
     ORDER BY p.pinned DESC, ${orderBy}`,
  );
  return rows;
};

// =============== post analytics ================

// Calc view count for a post
module.exports.incrementPostView = async function incrementPostView(postId) {
  const { rows } = await pool.query(
    `UPDATE "Posts" SET view_count = view_count + 1 WHERE id = $1 RETURNING view_count`,
    [postId],
  );
  return rows[0]?.view_count ?? 0;
};

// Get post analytics for post owner
module.exports.getPostAnalytics = async function getPostAnalytics(data) {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.title,
       p.category,
       p.created_at,
       p.view_count,

       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count,
       COUNT(DISTINCT pc.id)::int AS comment_count,
       COUNT(DISTINCT sp.id)::int AS save_count

     FROM "Posts" p
     LEFT JOIN "PostReactions" pr ON pr.post_id  = p.id
     LEFT JOIN "PostComments" pc ON pc.post_id  = p.id
     LEFT JOIN "SavedPosts" sp ON sp.post_id  = p.id
     WHERE p.id = $1 AND p.user_id = $2
     GROUP BY p.id`,
    [data.post_id, data.user_id],
  );
  return rows[0] || null;
};

// Get stats over time for a single post
module.exports.getPostEngagementOverTime = async function getPostEngagementOverTime(data) {
  const { rows } = await pool.query(
    `SELECT
       day,
       SUM(likes)::int AS likes,
       SUM(dislikes)::int AS dislikes,
       SUM(saves)::int AS saves
     FROM (
       SELECT
         DATE(pr.created_at) AS day,
         COUNT(*) FILTER (WHERE pr.reaction_type = 'like') AS likes,
         COUNT(*) FILTER (WHERE pr.reaction_type = 'dislike') AS dislikes,
         0 AS saves
       FROM "PostReactions" pr
       JOIN "Posts" p ON p.id = pr.post_id
       WHERE pr.post_id = $1 AND p.user_id = $2
       GROUP BY DATE(pr.created_at)

       UNION ALL

       SELECT
         DATE(sp.created_at) AS day,
         0 AS likes,
         0 AS dislikes,
         COUNT(*) AS saves
       FROM "SavedPosts" sp
       JOIN "Posts" p ON p.id = sp.post_id
       WHERE sp.post_id = $1 AND p.user_id = $2
       GROUP BY DATE(sp.created_at)
     ) combined
     GROUP BY day
     ORDER BY day ASC`,
    [data.post_id, data.user_id],
  );
  return rows;
};

// Get all posts analytics summary for user
module.exports.getUserPostsAnalytics = async function getUserPostsAnalytics(data) {
  const { rows } = await pool.query(
    `SELECT
       p.id,
       p.title,
       p.category,
       p.created_at,
       p.view_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,
       COUNT(DISTINCT pr.id) FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count,
       COUNT(DISTINCT pc.id)::int AS comment_count,
       COUNT(DISTINCT sp.id)::int AS save_count
     FROM "Posts" p
     LEFT JOIN "PostReactions" pr ON pr.post_id  = p.id
     LEFT JOIN "PostComments" pc ON pc.post_id  = p.id
     LEFT JOIN "SavedPosts" sp ON sp.post_id  = p.id
     WHERE p.user_id = $1
       AND p.is_anonymous = FALSE
     GROUP BY p.id
     ORDER BY p.created_at DESC`,
    [data.user_id],
  );
  return rows;
};
