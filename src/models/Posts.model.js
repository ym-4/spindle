const pool = require('./db');

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
    p.created_at,
    p.updated_at,
    per.name AS author_name,

    COUNT(DISTINCT pc.id)::int AS comment_count,

    COUNT(DISTINCT pr.id)
      FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,

    COUNT(DISTINCT pr.id)
      FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count

  FROM "Posts" p

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
    p.created_at,
    p.updated_at,
    per.name

  ORDER BY p.created_at DESC
  `);

  return rows;
};

// GET post by id
module.exports.getPostByID = async function getPostByID(data) {
  const VALUES = [data.id];

  const { rows } = await pool.query(`
    SELECT 
      p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.created_at,
      p.updated_at,

      per.name AS author_name,

      COUNT(DISTINCT pc.id)::int AS comment_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count

    FROM "Posts" p

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
      p.created_at,
      p.updated_at,
      per.name
  `, VALUES);

  return rows[0];
};

// GET Post by Category (confession/qna/general)
module.exports.getPostByCategory = async function getPostByCategory(data) {
  const VALUES = [data.category];

  const { rows } = await pool.query(`
    SELECT 
      p.id,
      p.user_id,
      p.title,
      p.category,
      p.content,
      p.attachment_url,
      p.created_at,
      p.updated_at,

      per.name AS author_name,

      COUNT(DISTINCT pc.id)::int AS comment_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'like')::int AS like_count,

      COUNT(DISTINCT pr.id)
        FILTER (WHERE pr.reaction_type = 'dislike')::int AS dislike_count

    FROM "Posts" p

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
      p.created_at,
      p.updated_at,
      per.name

    ORDER BY p.created_at DESC
  `, VALUES);

  return rows;
};

// GET Post by userID?? WIP
module.exports.getPostByUserID = async function getPostByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE email = ?', VALUES);
  return rows;
}

// Create new post
module.exports.insertPost = async function insertPost(data) {
  const VALUES = [data.user_id, data.title, data.category, data.content, data.attachment_url];
  const { rows } = await pool.query('INSERT INTO "Posts" (user_id, title, category, content, attachment_url) VALUES ($1, $2, $3, $4, $5) RETURNING id', VALUES);
  return rows[0]; 
}

// update post by ID (owner only)
module.exports.updatePostByID = async function updatePostByID(data) {
  const VALUES = [data.title, data.content, data.category, data.id];
  const { rows } = await pool.query(
    'UPDATE "Posts" SET "title" = $1, "content" = $2, "category" = $3 WHERE "id" = $4 RETURNING *',
    VALUES
  );
  return rows[0];
};

// delete a post (owner only)
module.exports.deletePostByID = async function deletePostByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('DELETE FROM "Posts" WHERE "id" = $1 RETURNING *', VALUES);
  return rows[0];
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
  const { rows } = await pool.query('INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2) RETURNING id', VALUES);
  return rows[0]; 
}

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
  const { rows } = await pool.query('INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id', VALUES);
  return rows[0]; 
}

// update reaction type 
module.exports.updateReaction = async function updateReaction(data) {
  const VALUES = [data.reaction_type, data.user_id, data.id];
  const { rows } = await pool.query(
    'UPDATE "PostReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 and "id" = $3 RETURNING *',
    VALUES
  );
  return rows[0];
};

// delete a reaction 
module.exports.deleteReaction = async function deleteReaction(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query('DELETE FROM "PostReactions" WHERE "id" = $1 and "user_id" = $2 RETURNING *', VALUES);
  return rows[0];
};