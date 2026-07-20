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
    per.name

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
      per.name
  `,
    VALUES,
  );

  return rows[0];
};

// GET Post by Category (confession/qna/general)
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
      per.name

    ORDER BY p.pinned DESC, p.created_at DESC
  `,
    VALUES,
  );

  return rows;
};

// GET related posts (3 random post form the same category)
module.exports.getRelatedPosts = async function getRelatedPosts(data) {
  const VALUES = [data.category, data.id];

  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.category, p.is_anonymous, u.name AS author_name,
      (SELECT COUNT(*) FROM "PostComments" pc WHERE pc.post_id = p.id) AS comment_count
    FROM "Posts" p
    LEFT JOIN "Person" u ON p.user_id = u.id
    WHERE p.category = $1 AND p.id != $2
    ORDER BY RANDOM()
    LIMIT 3`,
    VALUES,
  );
  return rows;
};

// GET Post by userID?? WIP
module.exports.getPostByUserID = async function getPostByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE email = ?', VALUES);
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
             per.name AS author_name, per.id AS author_id
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
