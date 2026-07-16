const pool = require('./db');

// Get all whiteboard
module.exports.getAllWhiteboards = async function getAllWhiteboards(data) {
  const { rows } = await pool.query('SELECT * FROM "WhiteboardDrawings"');
  return rows;
};

// Get whiteboard by group
module.exports.getWhiteboardsByGroupId = async function getWhiteboardsByGroupId(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query(
    'SELECT * FROM "WhiteboardDrawings" WHERE group_id = $1',
    VALUES,
  );
  return rows;
};

// Get whiteboard by user
module.exports.getWhiteboardsByUserId = async function getWhiteboardsByUserId(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query(
    'SELECT * FROM "WhiteboardDrawings" WHERE user_id = $1',
    VALUES,
  );
  return rows;
};

// Get whiteboard by user and group
module.exports.getWhiteboardsByUserIdAndGroup = async function getWhiteboardsByUserIdAndGroup(
  data,
) {
  const VALUES = [data.user_id, data.group_id];
  const { rows } = await pool.query(
    'SELECT * FROM "WhiteboardDrawings" WHERE user_id = $1 AND group_id = $2',
    VALUES,
  );
  return rows;
};

// Get whiteboard by id
module.exports.getWhiteboardsById = async function getWhiteboardsById(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "WhiteboardDrawings" WHERE id = $1', VALUES);
  return rows;
};

// Create whiteboard
// user_id, group_id, title, mode
module.exports.insertWhiteboards = async function insertWhiteboards(data) {
  const VALUES = [data.user_id, data.group_id, data.title, data.mode, []];
  const { rows } = await pool.query(
    'INSERT INTO "WhiteboardDrawings" (user_id, group_id, title, mode, drawing_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    VALUES,
  );
  return rows;
};

// Update whiteboard data
// drawing_data, id
module.exports.updateWhiteboardsData = async function updateWhiteboardData(data) {
  const VALUES = [data.drawing_data, data.id];
  const { rows } = await pool.query(
    'UPDATE "WhiteboardDrawings" SET drawing_data = $1 WHERE id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// Update whiteboard title
// title, id
module.exports.updateWhiteboardsName = async function updateWhiteboardsName(data) {
  const VALUES = [data.title, data.id];
  const { rows } = await pool.query(
    'UPDATE "WhiteboardDrawings" SET title = $1 WHERE id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// Delete whiteboard
module.exports.deleteWhiteboards = async function deleteWhiteboards(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(
    'DELETE FROM "WhiteboardDrawings" WHERE id = $1 AND user_id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};
