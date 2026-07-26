const { group } = require('node:console');
const pool = require('./db');

// -----------------------------------------------------------------------------------------------------
//                           GroupTasks Table
// -----------------------------------------------------------------------------------------------------

// GET all tasks
module.exports.getAllTasks = async function getAllTasks() {
  const { rows } = await pool.query('SELECT * FROM "GroupTasks"');
  return rows;
};

// GET tasks by group id
module.exports.getTasksByGroupID = async function getTasksByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "GroupTasks" WHERE group_id = $1', VALUES);
  return rows;
};

// GET tasks by task id
module.exports.getTasksByTaskID = async function getTasksByTaskID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "GroupTasks" WHERE id = $1', VALUES);
  return rows;
};

// GET tasks by group and user id
module.exports.getTasksByUserAndGroupID = async function getTasksByUserAndGroupID(data) {
  const VALUES = [data.user_id, data.group_id];
  const { rows } = await pool.query(
    'SELECT * FROM "GroupTasks" WHERE assignee_id = $1 AND group_id = $2',
    VALUES,
  );
  return rows;
};

// GET tasks by user id
module.exports.getTasksByUserID = async function getTasksByUserID(data) {
  const VALUES = [data.creator_id, data.id];
  const { rows } = await pool.query(
    'SELECT * FROM "GroupTasks" WHERE creator_id = $1 AND id = $2',
    VALUES,
  );
  return rows;
};

// POST new tasks
module.exports.insertTasks = async function insertTasks(data) {
  const VALUES = [
    data.group_id,
    data.creator_id,
    data.assignee_id,
    data.title,
    data.description,
    data.due_date,
  ];
  const { rows } = await pool.query(
    'INSERT INTO "GroupTasks" (group_id, creator_id, assignee_id, title, description, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
    VALUES,
  );
  return rows;
};

// PUT tasks
module.exports.updateTasks = async function updateTasks(data) {
  const VALUES = [
    data.assignee_id,
    data.title,
    data.description,
    data.due_date,
    data.status,
    data.id,
  ];
  const { rows } = await pool.query(
    'UPDATE "GroupTasks" SET assignee_id = $1, title = $2, description = $3, due_date = $4, status = $5 WHERE id = $6 RETURNING *',
    VALUES,
  );
  return rows;
};

// DELETE tasks
module.exports.deleteTasks = async function deleteTasks(data) {
  const VALUES = [data.id, data.creator_id];
  const { rows } = await pool.query(
    'DELETE FROM "GroupTasks" WHERE id = $1 AND creator_id = $2 RETURNING *',
    VALUES,
  );
  return rows;
};

// -----------------------------------------------------------------------------------------------------
//                           GroupTaskItems Table
// -----------------------------------------------------------------------------------------------------

// GET all task items
module.exports.getAllTaskItems = async function getAllTaskItems() {
  const { rows } = await pool.query('SELECT * FROM "GroupTaskItems"');
  return rows;
};

// GET task items by task id
module.exports.getTaskItemsByTaskID = async function getTaskItemsByTaskID(data) {
  const VALUES = [data.task_id];
  const { rows } = await pool.query('SELECT * FROM "GroupTaskItems" WHERE task_id = $1', VALUES);
  return rows;
};

// GET task items by group and user id
module.exports.getTaskItemsByUserAndGroupID = async function getTaskItemsByUserAndGroupID(data) {
  const VALUES = [data.user_id, data.group_id];
  const { rows } = await pool.query(
    `
    SELECT i.*
    FROM "GroupTaskItems" i
    JOIN "GroupTasks" t
    ON i.task_id = t.id
    WHERE t.assignee_id = $1
    AND t.group_id = $2
    `,
    VALUES,
  );
  return rows;
};

// POST new task items
module.exports.insertTaskItems = async function insertTaskItems(data) {
  const VALUES = [data.task_id, data.text, data.completed_by];
  const { rows } = await pool.query(
    'INSERT INTO "GroupTaskItems" (task_id, text, completed_by) VALUES ($1, $2, $3) RETURNING *',
    VALUES,
  );
  return rows;
};

// PUT task items
module.exports.updateTaskItems = async function updateTaskItems(data) {
  const VALUES = [data.text, data.completed, data.completed_by, data.completed_at, data.id];
  const { rows } = await pool.query(
    'UPDATE "GroupTaskItems" SET text = $1, completed = $2, completed_by = $3, completed_at = $4 WHERE id = $5 RETURNING *',
    VALUES,
  );
  return rows;
};

// DELETE task items
module.exports.deleteTaskItems = async function deleteTaskItems(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query(
    'DELETE FROM "GroupTaskItems" WHERE id = $1 RETURNING *',
    VALUES,
  );
  return rows;
};
