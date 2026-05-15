const pool = require('./db');

// Get all Posts
module.exports.getAllPost = async function getAllPost() {
  const { rows } = await pool.query('SELECT * FROM "Posts"');
  return rows;
};

// GET post by id
module.exports.getPostByID = async function getPostByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "Posts" WHERE id = $1', VALUES);
  return rows[0];
};

// GET Post by Category (confession/qna/general)
module.exports.getPostByCategory = async function getPostByCategory(data) {
  const VALUES = [data.category];
  const { rows } = await pool.query('SELECT * FROM "Posts" WHERE category = $1', VALUES);
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
  const VALUES = [data.user_id, data.title, data.category, data.content];
  const { rows } = await pool.query('INSERT INTO "Posts" (user_id, title, category, content) VALUES ($1, $2, $3, $4) RETURNING id', VALUES);
  return rows[0]; 
}

// update post by ID (owner only)
module.exports.updatePostByID = async function updatePostByID(data) {
  const VALUES = [data.title, data.content, data.id];
  const { rows } = await pool.query(
    'UPDATE "Posts" SET "title" = $1, "content" = $2 WHERE "id" = $3 RETURNING *',
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