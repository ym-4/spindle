const pool = require('./db');

// -----------------------------------------------------------------------------------------------------
//                           Groups Table
// -----------------------------------------------------------------------------------------------------

// Get all Groups
module.exports.getAllGroups = async function getAllGroups() {
  const { rows } = await pool.query('SELECT * FROM "Groups"');
  return rows;
};

// GET Group by group id
module.exports.getGroupsByGroupID = async function getGroupsByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "Groups" WHERE id = $1', VALUES);
  return rows;
};

// GET Group by group name
module.exports.getGroupsByGroupName = async function getGroupsByGroupName(data) {
  const VALUES = [data.name, data.group_id];
  const { rows } = await pool.query('SELECT * FROM "Groups" WHERE name = $1 AND id != $2', VALUES);
  return rows;
};

// GET Group by creator id
module.exports.getGroupByCreatorID = async function getGroupByCreatorID(data) {
  const VALUES = [data.creator_id];
  const { rows } = await pool.query('SELECT * FROM "Groups" WHERE creator_id = $1', VALUES);
  return rows;
};

// GET Groups by school
module.exports.getGroupsBySchool = async function getGroupsBySchool(data) {
  const VALUES = [data.school];
  const { rows } = await pool.query('SELECT * FROM "Groups" WHERE school = $1', VALUES);
  return rows;
};

// Create new Group (name, description, school, module)
module.exports.insertGroup = async function insertGroup(data) {
  const VALUES = [data.name, data.creator_id, data.description, data.school, data.module];
  const { rows } = await pool.query(
    'INSERT INTO "Groups" (name, creator_id, description, school, module) VALUES ($1, $2, $3, $4, $5) RETURNING *', VALUES);
  return rows; 
}

// Update Group name (group name, description) - only creator/admins
module.exports.updateGroupName = async function updateGroupName(data) {
  const VALUES = [data.group_id, data.name];
  const { rows } = await pool.query('UPDATE "Groups" SET name = $2 WHERE id = $1 RETURNING *', VALUES);
  return rows;
}

// Update Group description (group id, description) - only creator/admins
module.exports.updateGroupDescription = async function updateGroupDescription(data) {
  const VALUES = [data.group_id, data.description];
  const { rows } = await pool.query('UPDATE "Groups" SET description = $2 WHERE id = $1 RETURNING *', VALUES);
  return rows;
}

// Delete Group (Can only be done by the group's creator)
module.exports.deleteGroup = async function deleteGroup(data) {
  const VALUES = [data.group_id, data.creator_id];
  const { rows } = await pool.query('DELETE FROM "Groups" WHERE id = $1 AND creator_id = $2 RETURNING *', VALUES);
  return rows;
}

// Update Group publicity (Can only be done by group's creator)
module.exports.updateGroupPublicity = async function updateGroupPublicity(data) {
  const VALUES = [data.group_id, data.creator_id, data.public];
  const { rows } = await pool.query('UPDATE "Groups" SET public = $3 WHERE id = $1 AND creator_id = $2 RETURNING *', VALUES);
  return rows;
}

// for home page: suggested groups
module.exports.getSuggestedGroups = async function getSuggestedGroups(data) {
  const VALUES = [data.user_id || 0];
  const { rows } = await pool.query(`
    SELECT
      g.id,
      g.name,
      g.school,
      g.module,
      g.description,
      COUNT(gm.user_id) AS member_count
    FROM "Groups" g
    LEFT JOIN "GroupMembers" gm ON gm.group_id = g.id
    WHERE g.public = TRUE
      AND g.id NOT IN (
        SELECT group_id FROM "GroupMembers" WHERE user_id = $1
      )
    GROUP BY g.id
    ORDER BY member_count DESC
    LIMIT 3
  `, VALUES);
  return rows;
};

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
  const { rows } = await pool.query(`SELECT * FROM "GroupMembers" INNER JOIN "Groups" ON "GroupMembers".group_id = "Groups".id 
    WHERE "GroupMembers".user_id = $1`, VALUES);
  return rows;
};

// Create new Group member (group_id, user_id)
module.exports.insertGroupMember = async function insertGroupMember(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`INSERT INTO "GroupMembers" (group_id, user_id, role) VALUES ($1, $2, 'user') RETURNING *`, VALUES);
  return rows; 
}

// Update member role (user to admin)
module.exports.updateMemberRoleToAdmin = async function updateMemberRoleToAdmin(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`UPDATE "GroupMembers" SET role = 'admin' WHERE group_id = $1 AND user_id = $2 RETURNING *`, VALUES);
  return rows; 
}

// Update member role (admin to user) - not applicable to group's creator
module.exports.updateMemberRoleToUser = async function updateMemberRoleToUser(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`UPDATE "GroupMembers" SET role = 'user' WHERE group_id = $1 AND user_id = $2 RETURNING *`, VALUES);
  return rows; 
}

// Check for admin role (group_id)
module.exports.getAllGroupAdmin = async function getAllGroupAdmin(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query(`SELECT * FROM "GroupMembers" WHERE group_id = $1 AND role = 'admin'`, VALUES);
  return rows; 
}

// Delete/kick member out of group
module.exports.deleteGroupMemberByUserId = async function deleteGroupMemberByUserId(data) {
  const VALUES = [data.group_id, data.user_id];
  const { rows } = await pool.query(`DELETE FROM "GroupMembers" WHERE group_id = $1 AND user_id = $2 RETURNING *`, VALUES);
  return rows; 
}

// -----------------------------------------------------------------------------------------------------
//                          GroupDiscussions Table
// -----------------------------------------------------------------------------------------------------

// Create new group message (group_id, user_id, message, channel_name)
module.exports.insertGroupDiscussion = async function insertGroupDiscussion(data) {
  const VALUES = [data.group_id, data.user_id, data.message, data.channel_name];
  const { rows } = await pool.query('INSERT INTO "GroupDiscussions" (group_id, user_id, message, channel_name) VALUES ($1, $2, $3, $4) RETURNING *', VALUES);
  return rows; 
}

// Update group messages (id, message)
module.exports.updateGroupDiscussion = async function updateGroupDiscussion(data) {
  const VALUES = [data.id, data.message];
  const { rows } = await pool.query('UPDATE "GroupDiscussions" SET message = $2 WHERE id = $1 RETURNING *', VALUES);
  return rows; 
}

// GET all group messages by group_id (maybe just display a few unless user scrolls up or presses up button)
module.exports.getAllGroupDiscussionByGroupID = async function getAllGroupDiscussionByGroupID(data) {
  const VALUES = [data.group_id];
  const { rows } = await pool.query('SELECT * FROM "GroupDiscussions" WHERE group_id = $1', VALUES);
  return rows;
}

// GET all group messages that match search (case insensitive)
module.exports.getGroupDiscussionMatch = async function getGroupDiscussionMatch(data) {
  const VALUES = [data.group_id, `%${data.match}%`, data.channel_name];  
  const { rows } = await pool.query('SELECT * FROM "GroupDiscussions" WHERE group_id = $1 AND message ILIKE $2 AND channel_name = $3', VALUES);
  return rows;
}

// GET all group messages by user_id
module.exports.getGroupDiscussionByUserID = async function getGroupDiscussionByUserID(data) {
  const VALUES = [data.user_id];
  const { rows } = await pool.query('SELECT * FROM "GroupDiscussions" WHERE user_id = $1', VALUES);
  return rows;
}

// GET all group messages by group_id and channel_name
module.exports.getGroupDiscussionByGroupIDAndChannelName = async function getGroupDiscussionByGroupIDAndChannelName(data) {
  const VALUES = [data.group_id, data.channel_name];
  const { rows } = await pool.query('SELECT * FROM "GroupDiscussions" WHERE group_id = $1 AND channel_name = $2', VALUES);
  return rows;
}

// DELETE message by ID
module.exports.deleteGroupDiscussionByID = async function deleteGroupDiscussionByID(data) {
  const VALUES = [data.id, data.user_id];
  const { rows } = await pool.query(`DELETE FROM "GroupDiscussions" WHERE id = $1 AND user_id = $2 RETURNING *`, VALUES);
  return rows; 
}
