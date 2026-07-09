const express = require('express');

// Import functions needed
const {
  getAllGroups,
  getGroupsByGroupID,
  getGroupsByGroupName,
  getGroupByCreatorID,
  getGroupsBySchool,
  getSuggestedGroups,
  insertGroup,
  updateGroupName,
  updateGroupDescription,
  deleteGroup,
  updateGroupPublicity,
  getGroupMemberByGroupID,
  getGroupMemberByUserID,
  insertGroupMember,
  updateMemberRoleToAdmin,
  updateMemberRoleToUser,
  getAllGroupAdmin,
  insertGroupDiscussion,
  updateGroupDiscussion,
  getAllGroupDiscussionByGroupID,
  getGroupDiscussionMatch,
  deleteGroupMemberByUserId,
  getGroupDiscussionByUserID,
  deleteGroupDiscussionByID,
  getGroupDiscussionByGroupIDAndChannelName,
  getGroupAnnouncementsByGroupID,
  getGroupAnnouncements,
  insertGroupAnnouncement,
  updateGroupAnnouncement,
  deleteAnnouncementByID,
  deleteGroupChannelByChannelName,
  updateGroupModule,
  getGroupJoinRequestsByGroupId,
  insertGroupJoinRequest,
  updateGroupJoinRequest,
  deleteGroupJoinRequest,
  getGroupJoinRequestByGroupAndUser,
  getGroupJoinRequestByUser,
} = require('../models/Groups.model');

const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();

// ------------------------------------------------------------------
// 							Groups
// ------------------------------------------------------------------

// Get all Groups
router.get('/', (req, res, next) => {
  getAllGroups()
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// GET Group by group id
router.get('/group/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getGroupsByGroupID(data)
    .then((group) => res.status(200).json(group))
    .catch(next);
});

// GET Groups by creator id (get groups that user is the creator of)
router.get('/creator/:creator_id', authenticateJWT, (req, res, next) => {
  const data = {
    creator_id: res.locals.userId,
  };

  getGroupByCreatorID(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// GET Groups by school
router.get('/school/:school_name', (req, res, next) => {
  const data = {
    school: req.params.school_name,
  };

  getGroupsBySchool(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// Create new Group (name, description, school, module)
// Error handled: same name
router.post('/create/:creator_id', authenticateJWT, (req, res, next) => {
  if (
    req.body == undefined ||
    req.body.name == undefined ||
    req.body.description == undefined ||
    req.body.school == undefined ||
    req.body.module == undefined
  ) {
    res.status(400).json({ message: 'Error: name, description, school or module is undefined' });
    return;
  }

  const data = {
    creator_id: req.user.id,
    user_id: req.user.id,
    name: req.body.name,
    description: req.body.description,
    school: req.body.school,
    module: req.body.module,
    // so that the getGroupsByGroupName has a group_id to reference (not the actual group_id)
    group_id: -1,
  };

  // Check that group with the same name doesn't already exist
  getGroupsByGroupName(data)
    .then((groups) => {
      // A group with the same name already exists
      if (groups.length > 0) {
        res.status(409).json({ message: 'Error: Group name already exists' });

        // Create the group
      } else {
        insertGroup(data)
          .then((results) => {
            const group = results[0];
            data.group_id = group.id;

            // Add group creator to group's member list
            insertGroupMember(data)
              .then((results) => {
                // Add group creator to admin list
                updateMemberRoleToAdmin({
                  user_being_promoted_user_id: data.creator_id,
                  group_id: group.id,
                })
                  .then((results) => res.status(201).json(group))
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
router.put('/name/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.name == undefined) {
    res.status(400).json({ message: 'Error: name is undefined' });
    return;
  }

  const data = {
    group_id: req.params.group_id,
    creator_id: res.locals.userId,
    name: req.body.name,
  };

  // Get all groups where user is the creator
  getGroupByCreatorID(data)
    .then((results) => {
      // user is the group's creator (see if any id matches with this group)
      if (results.filter((group) => group.id == data.group_id).length > 0) {
        // Check new name does not already exist
        getGroupsByGroupName(data)
          .then((group) => {
            // A group with the same name already exists
            if (group.length > 0) {
              res.status(409).json({ message: 'Error: Group name already exists' });

              // Update the group
            } else {
              updateGroupName(data)
                .then((results) => {
                  res.status(200).json(results[0]);
                })
                .catch(next);
            }
          })
          .catch(next);
      } else {
        res.status(403).json({ message: "Error: User is not the group's creator" });
        return;
      }
    })
    .catch(next);
});

// Update Group description (user_id, description) - only creator/admins
router.put('/description/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.description == undefined) {
    res.status(400).json({ message: 'Error: description is undefined' });
    return;
  }

  const data = {
    group_id: req.params.group_id,
    user_id: req.user.id,
    description: req.body.description,
  };

  // Gets all admin from the group
  getAllGroupAdmin(data)
    .then((results) => {
      // user is the group's creator or admin (check that user id is part the admin arr)
      if (results.filter((person) => person.user_id == data.user_id).length > 0) {
        // update group description
        updateGroupDescription(data)
          .then((results) => res.status(200).json(results[0]))
          .catch(next);

        // user is not the group's creator or admin
      } else {
        res.status(403).json({ message: "Error: User is not the group's creator or an admin" });
        return;
      }
    })
    .catch(next);
});

// Update Group publicity (creator_id, public) (Can only be done by group's creator)
router.put('/public/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.public == undefined) {
    res.status(400).json({ message: 'Error: public or creator_id is undefined' });
    return;
  }

  const data = {
    group_id: req.params.group_id,
    creator_id: req.user.id,
    public: req.body.public, // true or false
  };

  // Get all groups where user is the creator
  getGroupByCreatorID(data)
    .then((results) => {
      // user is the group's creator (see if any id matches with this group)
      if (results.filter((group) => group.id == data.group_id).length > 0) {
        updateGroupPublicity(data)
          .then((results) => {
            res.status(200).json(results[0]);
          })
          .catch(next);
      } else {
        res.status(403).json({ message: "Error: User is not the group's creator" });
        return;
      }
    })
    .catch(next);
});

// Update Group module (user_id, module) - only creator/admins
router.put('/module/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.module == undefined) {
    res.status(400).json({ message: 'Error: module is undefined' });
    return;
  }

  const data = {
    group_id: req.params.group_id,
    user_id: req.user.id,
    module: req.body.module,
  };

  // Gets all admin from the group
  getAllGroupAdmin(data)
    .then((results) => {
      // user is the group's creator or admin (check that user id is part the admin arr)
      if (results.filter((person) => person.user_id == data.user_id).length > 0) {
        // update group module
        updateGroupModule(data)
          .then((results) => res.status(200).json(results[0]))
          .catch(next);

        // user is not the group's creator or admin
      } else {
        res.status(403).json({ message: "Error: User is not the group's creator or an admin" });
        return;
      }
    })
    .catch(next);
});

// Delete Group (creator_id) (Can only be done by the group's creator)
router.delete('/:group_id', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
    creator_id: req.user.id,
  };

  // Get all groups where user is the creator
  getGroupByCreatorID(data)
    .then((results) => {
      // user is the group's creator (see if any id matches with this group)
      if (results.filter((group) => group.id == data.group_id).length > 0) {
        deleteGroup(data)
          .then((results) => {
            if (results.length === 0) {
              return res.status(404).json({ message: 'Group not found' });
            } else {
              res.status(204).send();
            }
          })
          .catch(next);
      } else {
        res.status(403).json({ message: "Error: User is not the group's creator" });
        return;
      }
    })
    .catch(next);
});

// for home page
// GET suggested groups (excludes groups user already belongs to)
router.get('/suggested', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id || 0,
  };

  getSuggestedGroups(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// ------------------------------------------------------------------
// 							Group Members
// ------------------------------------------------------------------

// Get Joined Groups by user_id
router.get('/joined_groups/', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
  };

  getGroupMemberByUserID(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// Get Group members by group_id
// Response: group_id, user_id, role
router.get('/joined/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getGroupMemberByGroupID(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// Let user join group (as user)
// Insert user as group member
// Request: user_id
router.post('/join/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.user_id == undefined) {
    res.status(400).json({ message: 'Error: user_id is undefined' });
    return;
  }

  const data = {
    group_id: req.params.group_id,
    user_id: req.user.id,
  };

  // Check group exists
  getGroupsByGroupID(data)
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Error: Group not found' });
      } else {
        // Check that user is not already a member
        getGroupMemberByGroupID(data)
          .then((results) => {
            let isMember = results.filter((member) => member.user_id == data.user_id);

            // user is already a member
            if (isMember.length > 0) {
              return res.status(409).json({ message: 'Error: User is already a member' });

              // user is not a member yet
            } else {
              // Insert Group Member
              insertGroupMember(data)
                .then((results) => {
                  return res.status(201).json(results);
                })
                .catch(next);
            }
          })
          .catch(next);
      }
    })
    .catch(next);
});

// Let user leave group (if not creator)
// Request: user_id
router.delete('/leave/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.user_id == undefined) {
    return res.status(400).json({ message: 'Error: user_id is undefined' });
  }

  const data = {
    group_id: req.params.group_id,
    user_id: req.user.id,
  };

  // Check that user is a member
  getGroupMemberByUserID(data)
    .then((groups) => {
      let found = groups.find((groups) => groups.group_id == data.group_id);

      // User is a member
      if (found) {
        if (found.creator_id == data.user_id) {
          return res.status(409).json({ message: 'User cannot leave the group as its creator' });
        } else {
          // Let user leave
          deleteGroupMemberByUserId(data)
            .then((results) => {
              res.status(204).send();
            })
            .catch(next);
        }

        // User is not a member
      } else {
        return res.status(404).json({ message: 'User is not a member' });
      }
    })
    .catch(next);
});

router.delete('/kick/:group_id/:removed_user_id', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
    user_id: req.user.id,
    removed_user_id: req.params.removed_user_id,
  };

  getAllGroupAdmin(data).then((results) => {
    if (results.filter((person) => person.user_id == data.user_id).length > 0) {
      // Remove member
      // Check that user is a member
      getGroupMemberByUserID({ user_id: data.removed_user_id })
        .then((groups) => {
          let found = groups.find((groups) => groups.group_id == data.group_id);

          // User is a member
          if (found) {
            if (found.creator_id == data.removed_user_id) {
              return res
                .status(409)
                .json({ message: 'User cannot leave the group as its creator' });
            } else {
              // Let user leave
              deleteGroupMemberByUserId({ group_id: data.group_id, user_id: data.removed_user_id })
                .then((results) => {
                  res.status(204).send();
                })
                .catch(next);
            }

            // User is not a member
          } else {
            return res.status(404).json({ message: 'User is not a member' });
          }
        })
        .catch(next);
    } else {
      res.status(403).json({ message: "Error: User is not the group's creator or an admin" });
      return;
    }
  });
});

// Update role from user to admin (admin/creator only)
router.put(
  '/roleToAdmin/:group_id/:user_being_promoted_user_id',
  authenticateJWT,
  (req, res, next) => {
    const data = {
      user_being_promoted_user_id: req.params.user_being_promoted_user_id,
      group_id: req.params.group_id,
      user_id: req.user.id,
    };

    // Gets all admin from the group
    getAllGroupAdmin(data)
      .then((results) => {
        // user is the group's creator or admin (check that user id is part the admin arr)
        if (results.filter((person) => person.user_id == data.user_id).length > 0) {
          // update role
          updateMemberRoleToAdmin(data)
            .then((results) => {
              if (results.length === 0) {
                return res.status(404).json({ message: 'Group member not found.' });
              }

              res.status(200).json(results[0]);
            })
            .catch(next);

          // user is not the group's creator or admin
        } else {
          res.status(403).json({ message: "Error: User is not the group's creator or an admin" });
          return;
        }
      })
      .catch(next);
  },
);

// Update role from admin to user (creator only)
router.put(
  '/roleToUser/:group_id/:user_being_demoted_user_id',
  authenticateJWT,
  (req, res, next) => {
    const data = {
      user_being_demoted_user_id: req.params.user_being_demoted_user_id,
      group_id: req.params.group_id,
      user_id: req.user.id,
      creator_id: req.user.id,
    };

    // Get all groups where user is the creator
    getGroupByCreatorID(data)
      .then((results) => {
        // user is the group's creator (see if any id matches with this group)
        if (results.filter((group) => group.id == data.group_id).length > 0) {
          // update role
          updateMemberRoleToUser(data)
            .then((results) => {
              if (results.length === 0) {
                return res.status(404).json({ message: 'Group member not found.' });
              }

              res.status(200).json(results[0]);
            })
            .catch(next);
        } else {
          res.status(403).json({ message: "Error: User is not the group's creator" });
          return;
        }
      })
      .catch(next);
  },
);

// ------------------------------------------------------------------
// 							Group Discussions
// ------------------------------------------------------------------

// Get Group Discussion that match a string
router.get('/messages/match/:group_id/:channel_name/:match_string', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
    match: req.params.match_string,
    channel_name: req.params.channel_name,
  };

  getGroupDiscussionMatch(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// Get Group Discussion by group_id and channel_name
router.get('/messages/channel/:group_id/:channel_name', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
    channel_name: req.params.channel_name,
  };

  getGroupDiscussionByGroupIDAndChannelName(data)
    .then((groups) => res.status(200).json(groups))
    .catch(next);
});

// Get Group Discussion channel_name by group_id
router.get('/messages/channels/:group_id', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getAllGroupDiscussionByGroupID(data)
    .then((groups) => {
      let channels = [];
      groups.forEach((message) => {
        if (!channels.includes(message.channel_name)) {
          channels.push(message.channel_name);
        }
      });

      res.status(200).json({ channels });
    })
    .catch(next);
});

// Send/Create group message
// Request: message, group_id, channel_name
router.post('/messages/send/:user_id', authenticateJWT, (req, res, next) => {
  if (
    req.body == undefined ||
    req.body.channel_name == undefined ||
    req.body.message == undefined ||
    req.body.group_id == undefined
  ) {
    res.status(400).json({ message: 'Error: channel_name, message or group_id is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    group_id: req.body.group_id,
    channel_name: req.body.channel_name,
    message: req.body.message,
  };

  // Check that user is a group member
  getGroupMemberByUserID(data)
    .then((groups) => {
      let found = groups.filter((group) => group.group_id == data.group_id);

      // User is a member
      if (found.length > 0) {
        // Send message
        insertGroupDiscussion(data)
          .then((results) => {
            res.status(201).json(results);
          })
          .catch(next);

        // User is not a member
      } else {
        res.status(403).json({ message: 'User is not a member of the group' });
      }
    })
    .catch(next);
});

// Create new channel (Only Admin)
// Request: group_id, channel_name
router.post('/messages/channel/:user_id', authenticateJWT, (req, res, next) => {
  if (
    req.body == undefined ||
    req.body.channel_name == undefined ||
    req.body.group_id == undefined
  ) {
    res.status(400).json({ message: 'Error: channel_name or group_id is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    group_id: req.body.group_id,
    channel_name: req.body.channel_name,
    message: `Welcome to the new ${req.body.channel_name} channel`,
  };

  // Check that user is an admin
  getAllGroupAdmin(data)
    .then((admins) => {
      let found = admins.filter((admin) => admin.user_id == data.user_id);

      // User is an admin
      if (found.length > 0) {
        // Check that channel name doesn't already exist for the group
        getAllGroupDiscussionByGroupID(data)
          .then((groups) => {
            let channels = [];
            groups.forEach((message) => {
              if (!channels.includes(message.channel_name)) {
                channels.push(message.channel_name);
              }
            });

            // channel already exists for group
            if (channels.includes(data.channel_name)) {
              res
                .status(409)
                .json({ message: 'Error: Group channel with the same name already exists' });

              // channel doesn't already exist for group
            } else {
              // Send first message
              insertGroupDiscussion(data)
                .then((results) => {
                  res.status(201).json(results);
                })
                .catch(next);
            }
          })
          .catch(next);

        // User is not an admin
      } else {
        res.status(403).json({ message: 'User is not an admin' });
      }
    })
    .catch(next);
});

// Edit/Update group message
// Request: id, new_message
router.put('/messages/edit/:user_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.id == undefined || req.body.new_message == undefined) {
    res.status(400).json({ message: 'Error: id or new_message is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    id: req.body.id,
    message: req.body.new_message,
  };

  // Check that user is the one that sent the message
  getGroupDiscussionByUserID(data)
    .then((results) => {
      let match = results.filter((message) => message.id == data.id);
      // match found (user sent the message)
      if (match.length > 0) {
        // Update message
        updateGroupDiscussion(data)
          .then((results) => {
            return res.status(200).json(results);
          })
          .catch(next);

        // match not found (user did not send the message)
      } else {
        return res.status(403).json({ message: 'Error: You did not send this message' });
      }
    })
    .catch(next);
});

// Delete group message
// Request: id
router.delete('/messages/delete/:user_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.id == undefined) {
    return res.status(400).json({ message: 'Error: id is undefined' });
  }

  const data = {
    user_id: req.user.id,
    id: req.body.id,
  };

  // Check that user created the message
  getGroupDiscussionByUserID(data)
    .then((results) => {
      let match = results.filter((message) => message.id == data.id);

      // match found (user sent the message)
      if (match.length > 0) {
        // Delete message
        deleteGroupDiscussionByID(data)
          .then((results) => {
            return res.status(204).send();
          })
          .catch(next);

        // match not found (user did not send the message)
      } else {
        return res.status(403).json({ message: 'Error: You did not send this message' });
      }
    })
    .catch(next);
});

// Delete group channel and its messages
router.delete('/messages/channel/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.channel_name == undefined) {
    return res.status(400).json({ message: 'Error: channel_name is undefined' });
  }

  const data = {
    user_id: req.user.id,
    group_id: req.params.group_id,
    channel_name: req.body.channel_name,
  };

  // Prevent deletion of default channel
  if (data.channel_name === 'general') {
    return res.status(400).json({
      message: 'Cannot delete the default channel',
    });
  }
  getAllGroupAdmin(data)
    .then((admins) => {
      let found = admins.filter((admin) => admin.user_id == data.user_id);

      // User is an admin
      if (found.length > 0) {
        // Delete group channel and messages
        deleteGroupChannelByChannelName(data)
          .then((results) => {
            if (results.length === 0) {
              return res.status(404).json({
                message: 'Channel Name not found',
              });
            }

            return res.status(204).send();
          })
          .catch(next);

        // User is not an admin
      } else {
        res.status(403).json({ message: 'User is not an admin' });
      }
    })
    .catch(next);
});

// ------------------------------------------------------------------
// 							Group Annoucements
// ------------------------------------------------------------------

// GET all announcements by group id
router.get('/announcements/:group_id', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getGroupAnnouncementsByGroupID(data)
    .then((groupAnnouncements) => res.status(200).json(groupAnnouncements))
    .catch(next);
});

// GET all announcements
router.get('/announcements', authenticateJWT, (req, res, next) => {
  getGroupAnnouncements()
    .then((groupAnnouncements) => res.status(200).json(groupAnnouncements))
    .catch(next);
});

// Create new announcement (Only Admin)
// Request: text
router.post('/announcements/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.text == undefined) {
    res.status(400).json({ message: 'Error: text is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    text: req.body.text,
    group_id: req.params.group_id,
  };

  // Check that user is an admin
  getAllGroupAdmin(data)
    .then((admins) => {
      let found = admins.filter((admin) => admin.user_id == data.user_id);

      // User is an admin
      if (found.length > 0) {
        insertGroupAnnouncement(data)
          .then((results) => {
            res.status(201).json(results);
          })
          .catch(next);

        // User is not an admin
      } else {
        res.status(403).json({ message: 'User is not an admin' });
      }
    })
    .catch(next);
});

// Update announcement (Only Admin)
// Request: text
router.put('/announcements/:group_id/:announcement_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.text == undefined) {
    res.status(400).json({ message: 'Error: text is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    group_id: req.params.group_id,
    announcement_id: req.params.announcement_id,
    text: req.body.text,
  };

  // Check that user is an admin
  getAllGroupAdmin(data)
    .then((admins) => {
      let found = admins.filter((admin) => admin.user_id == data.user_id);

      // User is an admin
      if (found.length > 0) {
        updateGroupAnnouncement(data)
          .then((results) => {
            if (results.length === 0) {
              return res.status(404).json({
                message: 'Announcement not found',
              });
            }

            res.status(200).json(results);
          })
          .catch(next);

        // User is not an admin
      } else {
        res.status(403).json({ message: 'User is not an admin' });
      }
    })
    .catch(next);
});

// Delete group announcement (Only Admin)
router.delete('/announcements/:group_id/:announcement_id', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
    group_id: req.params.group_id,
    announcement_id: req.params.announcement_id,
  };

  // Check that user is an admin
  getAllGroupAdmin(data)
    .then((admins) => {
      let found = admins.filter((admin) => admin.user_id == data.user_id);

      // User is an admin
      if (found.length > 0) {
        // Delete announcement
        deleteAnnouncementByID(data)
          .then((results) => {
            if (results.length === 0) {
              return res.status(404).json({
                message: 'Announcement not found',
              });
            }

            return res.status(204).send();
          })
          .catch(next);

        // User is not an admin
      } else {
        res.status(403).json({ message: 'User is not an admin' });
      }
    })
    .catch(next);
});

// ------------------------------------------------------------------
// 							Group Join Requests
// ------------------------------------------------------------------
// Get join request by user id
router.get('/join-requests/user', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
  };

  getGroupJoinRequestByUser(data)
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// GET join requests by group_id
router.get('/join-requests/:group_id', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getGroupJoinRequestsByGroupId(data)
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// Create join requests
router.post('/join-requests/:group_id', authenticateJWT, async (req, res, next) => {
  try {
    const data = {
      user_id: req.user.id,
      group_id: req.params.group_id,
    };

    // Check if already a member
    const members = await getGroupMemberByGroupID(data);

    if (members.find((member) => member.user_id == data.user_id)) {
      return res.status(409).json({
        message: 'You are already a member',
      });
    }

    // TODO: Check if a join request already exists
    const joinRequests = await getGroupJoinRequestByGroupAndUser(data);
    if (joinRequests.length > 0) {
      return res.status(409).json({ message: 'You already requested to join this group. ' });
    } else {
      const results = await insertGroupJoinRequest(data);
      return res.status(201).json(results);
    }
  } catch (err) {
    next(err);
  }
});

// Accept join request
router.put(
  '/join-requests/accept/:group_id/:accepted_user_id',
  authenticateJWT,
  (req, res, next) => {
    const data = {
      admin_user_id: req.user.id,
      group_id: req.params.group_id,
      user_id: req.params.accepted_user_id,
      status: 'accepted',
    };

    // Check that user is an admin
    getAllGroupAdmin(data)
      .then((admins) => {
        let found = admins.filter((admin) => admin.user_id == data.admin_user_id);

        // User is an admin
        if (found.length > 0) {
          updateGroupJoinRequest(data)
            .then((results) => {
              if (results.length === 0) {
                return res.status(404).json({
                  message: 'Join Request not found',
                });
              }

              // add group member
              insertGroupMember({
                group_id: data.group_id,
                user_id: data.user_id,
              })
                .then((results) => res.status(200).json(results))
                .catch(next);
            })
            .catch(next);

          // User is not an admin
        } else {
          res.status(403).json({ message: 'User is not an admin' });
        }
      })
      .catch(next);
  },
);

// Decline join request
router.put(
  '/join-requests/decline/:group_id/:declined_user_id',
  authenticateJWT,
  (req, res, next) => {
    const data = {
      admin_user_id: req.user.id,
      group_id: req.params.group_id,
      user_id: req.params.declined_user_id,
      status: 'denied',
    };

    // Check that user is an admin
    getAllGroupAdmin(data)
      .then((admins) => {
        let found = admins.filter((admin) => admin.user_id == data.admin_user_id);

        // User is an admin
        if (found.length > 0) {
          updateGroupJoinRequest(data)
            .then((results) => {
              if (results.length === 0) {
                return res.status(404).json({
                  message: 'Join Request not found',
                });
              }

              res.status(200).json(results);
            })
            .catch(next);

          // User is not an admin
        } else {
          res.status(403).json({ message: 'User is not an admin' });
        }
      })
      .catch(next);
  },
);

// Delete join request
router.delete(
  '/join-requests/:group_id/:being_deleted_user_id',
  authenticateJWT,
  (req, res, next) => {
    const data = {
      group_id: req.params.group_id,
      user_id: req.params.being_deleted_user_id,
    };

    // Delete join request
    deleteGroupJoinRequest(data)
      .then((results) => {
        if (results.length === 0) {
          return res.status(404).json({
            message: 'Join request not found',
          });
        }

        return res.status(204).send();
      })
      .catch(next);
  },
);

module.exports = router;
