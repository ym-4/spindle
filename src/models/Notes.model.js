const pool = require('./db');

// -------------------------------------------------------------
// Notes
// -------------------------------------------------------------

// Get notes by group id
module.exports.getNotesByGroupID = async function getNotesByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "Notes" WHERE group_id = $1', VALUES);
  return rows;
};

// Get note by id
module.exports.getNoteByID = async function getNoteByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "Notes" WHERE id = $1', VALUES);
  return rows;
};

// Get note by title and group
module.exports.getNoteByTitleAndGroupID = async function getNoteByTitleAndGroupID(data) {
  const VALUES = [data.title, data.group_id];
  const { rows } = await pool.query(
    'SELECT * FROM "Notes" WHERE title = $1 AND group_id = $2',
    VALUES,
  );
  return rows;
};

// Get notes by folder id
module.exports.getNotesByFolderID = async function (data) {
  const { rows } = await pool.query(
    'SELECT * FROM "Notes" WHERE folder_id = $1 ORDER BY updated_at DESC',
    [data.folder_id],
  );

  return rows;
};

// Create note
// Need: user_id, title, group_id (optional)
module.exports.insertNote = async function insertNote(data) {
  const VALUES = [data.user_id, data.group_id, data.title];
  const { rows } = await pool.query(
    'INSERT INTO "Notes" (user_id, group_id, title) VALUES ($1, $2, $3) RETURNING *',
    VALUES,
  );
  return rows;
};

// Update note (everything except content)
module.exports.updateNote = async function updateNote(data) {
  const VALUES = [
    data.folder_id,
    data.title,
    data.template,
    data.is_pinned,
    data.is_archived,
    data.id,
  ];
  const { rows } = await pool.query(
    'UPDATE "Notes" SET folder_id = $1, title = $2, template = $3, is_pinned = $4, is_archived = $5 WHERE id = $6 RETURNING *',
    VALUES,
  );
  return rows;
};

// Update note content
module.exports.updateNoteContent = async function updateNoteContent(data) {
  const VALUES = [data.content, data.id];
  const { rows } = await pool.query(
    'UPDATE "Notes" SET content = $1 WHERE id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// Delete note by id
module.exports.deleteNote = async function deleteNote(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query(
    `DELETE FROM "Notes" WHERE id = $1 AND user_id = $2 RETURNING *`,
    VALUES,
  );
  return rows;
};

// -------------------------------------------------------------
// Note folders
// -------------------------------------------------------------

// Get folder by group
module.exports.getNoteFoldersByGroupID = async function getNoteFoldersByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "NoteFolders" WHERE group_id = $1', VALUES);
  return rows;
};

// Get folder by id
module.exports.getNoteFoldersByID = async function getNoteFoldersByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "NoteFolders" WHERE id = $1', VALUES);
  return rows;
};

// Get folder by group name and group_id
module.exports.getNoteFoldersByGroupIDAndName = async function getNoteFoldersByGroupIDAndName(
  data,
) {
  const VALUES = [data.group_id, data.name];
  const { rows } = await pool.query(
    'SELECT * FROM "NoteFolders" WHERE group_id = $1 AND name = $2',
    VALUES,
  );
  return rows;
};

// Create folder
module.exports.insertNoteFolder = async function insertNoteFolder(data) {
  const VALUES = [data.group_id, data.name];
  const { rows } = await pool.query(
    'INSERT INTO "NoteFolders" (group_id, name) VALUES ($1, $2) RETURNING *',
    VALUES,
  );
  return rows;
};

// Update folder color (hex code)
module.exports.updateFolderColor = async function updateFolderColor(data) {
  const VALUES = [data.color, data.id];
  const { rows } = await pool.query(
    'UPDATE "NoteFolders" SET color = $1 WHERE id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// Update folder icon
module.exports.updateFolderIcon = async function updateFolderIcon(data) {
  const VALUES = [data.icon, data.id];
  const { rows } = await pool.query(
    'UPDATE "NoteFolders" SET icon = $1 WHERE id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// Update folder name
module.exports.updateFolderName = async function updateFolderName(data) {
  const VALUES = [data.name, data.id];
  const { rows } = await pool.query(
    'UPDATE "NoteFolders" SET name = $1 WHERE id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// Delete note folder by id
module.exports.deleteNoteFolder = async function deleteNoteFolder(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query(`DELETE FROM "NoteFolders" WHERE id = $1 RETURNING *`, VALUES);
  return rows;
};

// -------------------------------------------------------------
// Note links
// -------------------------------------------------------------

// Get all note links
module.exports.getAllNoteLinks = async function getAllNoteLinks() {
  const { rows } = await pool.query('SELECT * FROM "NoteLinks"');
  return rows;
};

/* 
  source_note_id -----------> target_note_id
*/

// Get note links referenced by a note (Get notes that are referenced by this note)
module.exports.getNoteLinksBySourceNoteId = async function getNoteLinksBySourceNoteId(data) {
  const VALUES = [data.source_note_id];
  const { rows } = await pool.query('SELECT * FROM "NoteLinks" WHERE source_note_id = $1', VALUES);
  return rows;
};

// Get note links that references a note (Get notes that are reference this note)
module.exports.getNoteLinksByTargetNoteId = async function getNoteLinksByTargetNoteId(data) {
  const VALUES = [data.target_note_id];
  const { rows } = await pool.query('SELECT * FROM "NoteLinks" WHERE target_note_id = $1', VALUES);
  return rows;
};

module.exports.getNoteLinksBySourceAndTargetNoteId =
  async function getNoteLinksBySourceAndTargetNoteId(data) {
    const VALUES = [data.source_note_id, data.target_note_id];
    const { rows } = await pool.query(
      'SELECT * FROM "NoteLinks" WHERE source_note_id = $1 AND target_note_id = $2',
      VALUES,
    );
    return rows;
  };

// Create note links
module.exports.insertNoteLinks = async function insertNoteLinks(data) {
  const VALUES = [data.source_note_id, data.target_note_id];
  const { rows } = await pool.query(
    'INSERT INTO "NoteLinks" (source_note_id, target_note_id) VALUES ($1, $2) RETURNING *',
    VALUES,
  );
  return rows;
};

// Delete note links (source_note_id, target_note_id)
module.exports.deleteNoteLinks = async function deleteNoteLinks(data) {
  const VALUES = [data.source_note_id, data.target_note_id];
  const { rows } = await pool.query(
    `DELETE FROM "NoteLinks" WHERE source_note_id = $1 AND target_note_id = $2  RETURNING *`,
    VALUES,
  );
  return rows;
};
