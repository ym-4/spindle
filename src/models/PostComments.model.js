const pool = require('./db');

// Get all Comments
module.exports.getAllComments = async function getAllComments() {
  const { rows } = await pool.query('SELECT * FROM "PostComments"');
  return rows;
};

// GET Comments by userId
module.exports.getCommentsByUserID = async function getCommentsByUserID(data) {
  const { rows } = await pool.query(
    `SELECT
       pc.id,
       pc.content,
       pc.created_at,
       pc.post_id,
       pc.parent_comment_id,
       pc.attachment_url,
       p.title AS post_title,
       p.category AS post_category,
       p.is_anonymous AS post_is_anonymous
     FROM "PostComments" pc
     JOIN "Posts" p ON p.id = pc.post_id
     WHERE pc.user_id = $1
       AND p.is_anonymous = FALSE
     ORDER BY pc.created_at DESC`,
    [data.user_id],
  );
  return rows;
};

// GET Comments by post_id (all comments under a post)
module.exports.getCommentsByPostID = async function getCommentsByPostID(data) {
  const VALUES = [data.post_id];
  const { rows } = await pool.query(
    `
    SELECT 
      pc.*,
      p.name AS author_name,
      p.profile_image AS author_avatar,
      COUNT(DISTINCT cr.id) FILTER (WHERE cr.reaction_type = 'like')::int AS like_count,
      COUNT(DISTINCT cr.id) FILTER (WHERE cr.reaction_type = 'dislike')::int AS dislike_count
    FROM "PostComments" pc
    JOIN "Person" p ON pc.user_id = p.id
    LEFT JOIN "CommentReactions" cr ON cr.comment_id = pc.id
    WHERE pc.post_id = $1
    GROUP BY pc.id, p.name, p.profile_image
    ORDER BY 
      COALESCE(pc.parent_comment_id, pc.id),  
      pc.parent_comment_id NULLS FIRST,    
      pc.created_at ASC
  `,
    VALUES,
  );
  return rows;
};

// Create new Comments
module.exports.insertComments = async function insertComments(data) {
  const VALUES = [
    data.user_id,
    data.post_id,
    data.content,
    data.parent_comment_id || null,
    data.attachment_url || null,
  ];
  const { rows } = await pool.query(
    'INSERT INTO "PostComments" (user_id, post_id, content, parent_comment_id, attachment_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
    VALUES,
  );
  return rows[0];
};

// update Comments by ID (owner only)
module.exports.updateCommentsByID = async function updateCommentsByID(data) {
  const VALUES = [data.content, data.attachment_url, data.id, data.user_id];
  const { rows } = await pool.query(
    'UPDATE "PostComments" SET "content" = $1, "attachment_url" = $2 WHERE "id" = $3 AND "user_id" = $4 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// delete a Comment(owner only)
module.exports.deleteCommentsByID = async function deleteCommentsByID(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query(
    'DELETE FROM "PostComments" WHERE "id" = $1 AND "user_id" = $2 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// post comments actions
// save comments
// GET saved comments by user ID
module.exports.getSavedCommentsByUserID = async function getSavedCommentsByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query(
    `
    SELECT
      sc.id AS save_id,
      sc.user_id AS save_user_id,
      sc.comment_id,
      sc.created_at AS saved_at,
      pc.content,
      pc.created_at AS created_at,
      pc.post_id,
      p.title AS post_title,
      per.name AS author_name
    FROM "SavedComments" sc
    JOIN "PostComments" pc ON sc.comment_id = pc.id
    JOIN "Posts" p ON pc.post_id = p.id
    LEFT JOIN "Person" per ON pc.user_id = per.id
    WHERE sc.user_id = $1
    ORDER BY sc.created_at DESC
  `,
    VALUES,
  );
  return rows;
};

// Save a comment
module.exports.insertSavedComment = async function insertSavedComment(data) {
  const VALUES = [data.user_id, data.comment_id];
  const { rows } = await pool.query(
    'INSERT INTO "SavedComments" (user_id, comment_id) VALUES ($1, $2) RETURNING id',
    VALUES,
  );
  return rows[0];
};

// unsave comment
module.exports.deleteSavedCommentByID = async function deleteSavedCommentByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query(
    'DELETE FROM "SavedComments" WHERE "id" = $1 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// GET comment reactions by user ID
module.exports.getCommentReactionByUserID = async function getCommentReactionByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "CommentReactions" WHERE user_id = $1', VALUES);
  return rows;
};

// Insert comment reaction (like a comment)
module.exports.insertCommentLike = async function insertCommentLike(data) {
  const VALUES = [data.comment_id, data.user_id, data.reaction_type];
  const { rows } = await pool.query(
    'INSERT INTO "CommentReactions" (comment_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id',
    VALUES,
  );
  return rows[0];
};

// Update comment reaction (like > dislike vice versa)
module.exports.updateCommentReaction = async function updateCommentReaction(data) {
  const VALUES = [data.reaction_type, data.user_id, data.id];
  const { rows } = await pool.query(
    'UPDATE "CommentReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 AND "id" = $3 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// Delete comment reaction (removes like/dislike)
module.exports.deleteCommentReaction = async function deleteCommentReaction(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query(
    'DELETE FROM "CommentReactions" WHERE "id" = $1 AND "user_id" = $2 RETURNING *',
    VALUES,
  );
  return rows[0];
};

// Delete comment by post owner
module.exports.deleteCommentByPostOwner = async function deleteCommentByPostOwner(data) {
  const { rows } = await pool.query(
    `DELETE FROM "PostComments" WHERE id = $1 AND post_id IN (SELECT id FROM "Posts" WHERE user_id = $2) RETURNING *`,
    [data.id, data.user_id],
  );
  return rows[0] || null;
};
