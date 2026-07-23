const pool = require('./db');

// Get group files by group id
module.exports.getGroupFilesByGroupID = async function getGroupFilesByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "GroupFiles" WHERE group_id = $1', VALUES);
  return rows;
};

// Get group files by file id
module.exports.getGroupFilesByID = async function getGroupFilesByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "GroupFiles" WHERE id = $1', VALUES);
  return rows;
};

// Create group files
module.exports.insertGroupFiles = async function insertGroupFiles(data) {
  const VALUES = [data.name, data.user_id, data.group_id, data.file_path, data.folder_name];
  const { rows } = await pool.query(
    'INSERT INTO "GroupFiles" (name, user_id, group_id, file_path, folder_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
    VALUES,
  );
  return rows;
};

// Update group file folder_name
module.exports.updateGroupFileFolderByID = async function updateGroupFileFolderByID(data) {
  const VALUES = [data.id, data.folder_name];
  const { rows } = await pool.query(
    'UPDATE "GroupFiles" SET folder_name = $2 WHERE id = $1 RETURNING *',
    VALUES,
  );
  return rows;
};

// Delete group files by file id and user id
module.exports.deleteGroupFilesByID = async function deleteGroupFilesByID(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query(
    `DELETE FROM "GroupFiles" WHERE id = $1 AND user_id = $2 RETURNING *`,
    VALUES,
  );
  return rows;
};

// Get group folder by group id
module.exports.getGroupFoldersByGroupID = async function getGroupFoldersByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "GroupFolders" WHERE group_id = $1', VALUES);
  return rows;
};

// Create group folder
module.exports.insertGroupFolder = async function insertGroupFolder(data) {
  const VALUES = [data.name, data.group_id, data.user_id];
  const { rows } = await pool.query(
    'INSERT INTO "GroupFolders" (name, group_id, created_by) VALUES ($1, $2, $3) RETURNING *',
    VALUES,
  );
  return rows;
};

// Update group folder name
module.exports.updateGroupFolderNameByID = async function updateGroupFolderNameByID(data) {
  const VALUES = [data.id, data.folder_name];
  const { rows } = await pool.query(
    'UPDATE "GroupFolders" SET folder_name = $2 WHERE id = $1 RETURNING *',
    VALUES,
  );
  return rows;
};

module.exports.deleteGroupFolderByID = async function deleteGroupFolderByID(data) {
  const VALUES = [data.id, data.folder_name];
  const { rows } = await pool.query('DELETE FROM "GroupFolders" WHERE id = $1', VALUES);
  return rows;
};

module.exports.moveFilesToUnorganised = async function moveFilesToUnorganised(data) {
  const VALUES = [data.group_id, data.folder_name];
  const { rows } = await pool.query(
    'UPDATE "GroupFiles" SET folder_name = "Unorganised" WHERE group_id = $1 AND folder_name = $2 RETURNING *',
    VALUES,
  );
  return rows;
};
