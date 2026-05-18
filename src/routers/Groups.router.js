const express = require('express');
const { getAllGroups, getGroupsByGroupID, getGroupsByGroupName, getGroupByCreatorID, getGroupsBySchool, insertGroup, 
		updateGroupName, 
		updateGroupDescription, deleteGroup, updateGroupPublicity, getGroupMemberByGroupID, 
		getGroupMemberByUserID, insertGroupMember, updateMemberRoleToAdmin, updateMemberRoleToUser, 
        getAllGroupAdmin, insertGroupDiscussion, updateGroupDiscussion, getAllGroupDiscussionByGroupID, 
        getGroupDiscussionMatch } = require('../models/Groups.model');
const router = express.Router();

// Get all Groups
router.get('/', (req, res, next) => {
  getAllGroups()
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// GET Group by group id
router.get('/group/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id
  }

  getGroupsByGroupID(data)
    .then((group) => res.status(200).json(group))
    .catch(next);
});

// GET Groups by creator id
router.get('/creator/:creator_id', (req, res, next) => {
  const data = {
    creator_id: req.params.creator_id
  }

  getGroupByCreatorID(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// GET Groups by school
router.get('/school/:school_name', (req, res, next) => {
  const data = {
    school: req.params.school_name
  }

  getGroupsBySchool(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// Create new Group (name, description, school, module)
// Error handled: same name
router.post('/:creator_id', (req, res, next) => {
  if (req.body == undefined || req.body.name == undefined || req.body.description == undefined || req.body.school == undefined 
		|| req.body.module == undefined) {
    res.status(400).json({"message": "Error: name, description, school or module is undefined"});
    return;
  }

  const data = {
    creator_id: req.params.creator_id, 
		user_id: req.params.creator_id,
    name: req.body.name, 
    description: req.body.description,
    school: req.body.school, 
    module: req.body.module,
		// so that the getGroupsByGroupName has a group_id to reference (not the actual group_id) 
		group_id: -1
  }

  // Check that group with the same name doesn't already exist
  getGroupsByGroupName(data)
    .then(groups => {
      // A group with the same name already exists
      if (groups.length > 0) {
        res.status(409).json({"message": "Error: Group name already exists"});

      // Create the group
      } else {
          insertGroup(data)
            .then(results => {
							const group = results[0];
							data.group_id = group.id;

							// Add group creator to group's member list 
							insertGroupMember(data)
								.then(results => {
									// Add group creator to admin list
									updateMemberRoleToAdmin({user_id: data.creator_id, group_id: group.id})
										.then(results => res.status(201).json(group))
										.catch(next);
								})
								.catch(next);
						})
            .catch(next);
      }
    })
    .catch(next);
});

// Update Group name (creator_id, new name) - only creator
router.put('/name/:group_id', (req, res, next) => {
  if (req.body == undefined || req.body.name == undefined || req.body.creator_id == undefined) {
    res.status(400).json({"message": "Error: name or creator_id is undefined"});
    return;
	} 

	const data = {
		group_id: req.params.group_id, 
		creator_id: req.body.creator_id,
		name: req.body.name
	}

	// Get all groups where user is the creator
	getGroupByCreatorID(data) 
		.then(results => {
			// user is the group's creator (see if any id matches with this group)
			if (results.filter(group => group.id == data.group_id).length > 0) {
				// Check new name does not already exist
				getGroupsByGroupName(data)
					.then(group => {
						// A group with the same name already exists
						if (group.length > 0) {
							res.status(409).json({"message": "Error: Group name already exists"});

						// Update the group
						} else {
							updateGroupName(data)
								.then(results => {res.status(200).json(results[0])})
								.catch(next);
						}
					})
					.catch(next);

			} else {
				res.status(403).json({"message": "Error: User is not the group's creator"});
				return;
			}
			
		})
		.catch(next);
});

// Update Group description (user_id, description) - only creator/admins
router.put('/description/:group_id', (req, res, next) => {
  if (req.body == undefined || req.body.description == undefined || req.body.user_id == undefined) {
    res.status(400).json({"message": "Error: description or creator_id is undefined"});
    return;
	} 

	const data = {
		group_id: req.params.group_id, 
		user_id: req.body.user_id,
		description: req.body.description
	}

	// Gets all admin from the group
	getAllGroupAdmin(data) 
		.then(results => {
			// user is the group's creator or admin (check that user id is part the admin arr)
			if (results.filter(person => person.user_id == data.user_id).length > 0) {
				// update group description
				updateGroupDescription(data)
					.then(results => res.status(200).json(results[0]))
					.catch(next);
		
			// user is not the group's creator or admin
			} else {
				res.status(403).json({"message": "Error: User is not the group's creator or an admin"});
				return;
			}
	})
	.catch(next);
});

// Delete Group (creator_id) (Can only be done by the group's creator)
router.delete('/:group_id', (req, res, next) => {
  if (req.body == undefined || req.body.creator_id == undefined) {
    res.status(400).json({"message": "Error: creator_id is undefined"});
    return;
	} 

	const data = {
		group_id: req.params.group_id, 
		creator_id: req.body.creator_id,
	}

	// Get all groups where user is the creator
	getGroupByCreatorID(data) 
		.then(results => {
			// user is the group's creator (see if any id matches with this group)
			if (results.filter(group => group.id == data.group_id).length > 0) {
				deleteGroup(data)
					.then(results => {
					  if (results.length === 0) {
                return res.status(404).json({ "message": "Group not found" });
            } else {
                res.status(204).send();
            }

					})
					.catch(next);

			} else {
				res.status(403).json({"message": "Error: User is not the group's creator"});
				return;
			}
			
		})
		.catch(next);
});

// Update Group publicity (creator_id, public) (Can only be done by group's creator)
router.put('/public/:group_id', (req, res, next) => {
  if (req.body == undefined || req.body.creator_id == undefined || req.body.public == undefined) {
    res.status(400).json({"message": "Error: public or creator_id is undefined"});
    return;
	} 

	const data = {
		group_id: req.params.group_id, 
		creator_id: req.body.creator_id,
		public: req.body.public // true or false
	}

	// Get all groups where user is the creator
	getGroupByCreatorID(data) 
		.then(results => {
			// user is the group's creator (see if any id matches with this group)
			if (results.filter(group => group.id == data.group_id).length > 0) {
				updateGroupPublicity(data)
					.then(results => {
						res.status(200).json(results[0]);
					})
					.catch(next);

			} else {
				res.status(403).json({"message": "Error: User is not the group's creator"});
				return;
			}
			
		})
		.catch(next);
});

module.exports = router;
