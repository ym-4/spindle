const pool = require('./db');

// Get all Comments NO
module.exports.getAllComments = async function getAllComments() {
  const { rows } = await pool.query('SELECT * FROM "PostComments"');
  return rows;
};

// GET Comments by post_id
module.exports.getCommentsByPostID = async function getCommentsByPostID(data) {
  const VALUES = [data.post_id];
  const { rows } = await pool.query('SELECT * FROM "PostComments" WHERE post_id = $1', VALUES);
  return rows[0];
};

// GET Comments by userID?? WIP
module.exports.getCommentsByUserID = async function getCommentsByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE email = ?', VALUES);
  return rows;
}

// Create new Comments
module.exports.insertComments = async function insertComments(data) {
  const VALUES = [];
  const { rows } = await pool.query('INSERT INTO "PostComments" (user_id, title, category, content) VALUES ($1, $2, $3, $4) RETURNING id', VALUES);
  return rows[0]; 
}

// update Comments by ID (owner only)
module.exports.updateCommentsByID = async function updateCommentsByID(data) {
  const VALUES = [data.title, data.content, data.id];
  const { rows } = await pool.query(
    'UPDATE "Commentss" SET "title" = $1, "content" = $2 WHERE "id" = $3 RETURNING *',
    VALUES
  );
  return rows[0];
};

// delete a Comments (owner only)
module.exports.deleteCommentsByID = async function deleteCommentsByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('DELETE FROM "Comments" WHERE "id" = $1 RETURNING *', VALUES);
  return rows[0];
};