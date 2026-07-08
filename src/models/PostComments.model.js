const pool = require('./db');

// Get all Comments NO
module.exports.getAllComments = async function getAllComments() {
  const { rows } = await pool.query('SELECT * FROM "PostComments"');
  return rows;
};

// GET Comments by post_id (all comments under a post)
module.exports.getCommentsByPostID = async function getCommentsByPostID(data) {
  const VALUES = [data.post_id];
  const { rows } = await pool.query(
    `
    SELECT 
      pc.*,
      p.name AS author_name
    FROM "PostComments" pc
    JOIN "Person" p ON pc.user_id = p.id
    WHERE pc.post_id = $1
    ORDER BY 
      COALESCE(pc.parent_comment_id, pc.id),  
      pc.parent_comment_id NULLS FIRST,    
      pc.created_at ASC
  `,
    VALUES,
  );
  return rows;
};

// GET Comments by userID?? WIP
module.exports.getCommentsByUserID = async function getCommentsByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "PostComments" WHERE email = ?', VALUES);
  return rows;
};

// Create new Comments
module.exports.insertComments = async function insertComments(data) {
  const VALUES = [data.user_id, data.post_id, data.content, data.parent_comment_id || null];
  const { rows } = await pool.query(
    'INSERT INTO "PostComments" (user_id, post_id, content, parent_comment_id) VALUES ($1, $2, $3, $4) RETURNING id',
    VALUES,
  );
  return rows[0];
};

// update Comments by ID (owner only)
module.exports.updateCommentsByID = async function updateCommentsByID(data) {
  const VALUES = [data.content, data.id, data.user_id];
  const { rows } = await pool.query(
    'UPDATE "PostComments" SET "content" = $1 WHERE "id" = $2 AND "user_id" = $3 RETURNING *',
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
