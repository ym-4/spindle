const pool = require('./db');

// -----------------------------------------------------------------------------------------------------
//                           Groups Table
// -----------------------------------------------------------------------------------------------------

// Get all Groups
module.exports.getAllGroups = async function getAllGroups() {
  const { rows } = await pool.query('SELECT * FROM "Groups"');
  return rows;
};

// GET Group by id
module.exports.getGroupsByGroupID = async function getGroupsByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "Groups" WHERE id = $1', VALUES);
  return rows;
};

// GET Group by creator id
module.exports.getGroupByCreatorID = async function getGroupByCreatorID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "Groups" WHERE creator_id = $1', VALUES);
  return rows;
};

// Create new Group (name, description, school, module)
module.exports.insertGroup = async function insertGroup(data) {
  const VALUES = [data.name, data.creator_id, data.description, data.school, data.module];
  const { rows } = await pool.query('INSERT INTO "Groups" (name, creator_id, description, school, module) VALUES ($1, $2, $3, $4, $5)', VALUES);
  return rows; 
}

// Update Group info (group name, description) - only creator/admins
module.exports.updateGroup = async function updateGroup(data) {
  const VALUES = [data.group_id, data.name, data.description];
  const { rows } = await pool.query('UPDATE "Groups" SET name = $2, description = $3 WHERE id = $1', VALUES);
  return rows;
}

// Delete Group (Can only be done by the group's creator)
module.exports.deleteGroup = async function deleteGroup(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query('DELETE FROM "Groups" WHERE id = $1 AND creator_id = $2', VALUES);
  return rows;
}

// Update Group publicity (Can only be done by group's creator)
module.exports.updateGroupPublicity = async function updateGroupPublicity(data) {
  const VALUES = [data.group_id, data.user_id, data.public];
  const { rows } = await pool.query('UPDATE "Groups" SET public = $3 WHERE id = $1 AND creator_id = $2', VALUES);
  return rows;
}

// -----------------------------------------------------------------------------------------------------
//                          GroupMembers Table
// -----------------------------------------------------------------------------------------------------

// GET Group members by group_id
module.exports.getGroupMemberByGroupID = async function getGroupMemberByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "GroupMembers" WHERE group_id = $1', VALUES);
  return rows;
};

// GET Group members by user_id
module.exports.getGroupMemberByUserID = async function getGroupMemberByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "GroupMembers" WHERE user_id = $1', VALUES);
  return rows;
};

// Create new Group member (group_id, user_id)
module.exports.insertGroupMember = async function insertGroupMember(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`INSERT INTO "GroupMembers" (group_id, user_id, role) VALUES ($1, $2, 'user')`, VALUES);
  return rows; 
}

// Update member role (user to admin)
module.exports.updateMemberRoleToAdmin = async function updateMemberRoleToAdmin(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`UPDATE "GroupMembers" SET role = 'admin' WHERE group_id = $1 AND user_id = $2`, VALUES);
  return rows; 
}

// Update member role (admin to user) - not applicable to group's creator
module.exports.updateMemberRoleToUser = async function updateMemberRoleToUser(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`UPDATE "GroupMembers" SET role = 'user' WHERE group_id = $1 AND user_id = $2`, VALUES);
  return rows; 
}


// -----------------------------------------------------------------------------------------------------
//                          GroupDiscussions Table
// -----------------------------------------------------------------------------------------------------

// Create new group message (group_id, user_id, message)
module.exports.insertGroupDiscussion = async function insertGroupDiscussion(data) {
  const VALUES = [data.group_id, data.user_id, data.message];
  const { rows } = await pool.query('INSERT INTO "GroupDiscussions" (group_id, user_id, message) VALUES ($1, $2, $3)', VALUES);
  return rows; 
}

// Update group messages (id, message)
module.exports.updateGroupDiscussion = async function updateGroupDiscussion(data) {
  const VALUES = [data.id, data.message];
  const { rows } = await pool.query('UPDATE "GroupDiscussions" SET message = $2 WHERE id = $1', VALUES);
  return rows; 
}

// GET all group messages by group_id (maybe just display a few unless user scrolls up or presses up button)
module.exports.getAllGroupDiscussionByGroupID = async function getAllGroupDiscussionByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "GroupDiscussions" WHERE group_id = ?');
  return rows;
}

// GET all group messages that match search (case insensitive)
module.exports.getGroupDiscussionMatch = async function getGroupDiscussionMatch(data) {
  const VALUES = [data.group_id, `%${data.message}%`];  
  const { rows } = await pool.query('SELECT * FROM "GroupDiscussions" WHERE group_id = $1 AND message ILIKE $2', VALUES);
  return rows;
}

