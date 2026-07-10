// Shared functions used across multiple groups_XX.js files

// -------------------------------------------------------------------------------------
//                              Fetch Functions
// -------------------------------------------------------------------------------------

// Gets the channels for the group
async function fetchGroupChannels() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/channels/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupDiscussionChannels', responseData);

      if (responseStatus == 200) {
        channels = responseData.channels;
        console.log('fetchGroupChannels data', responseData);
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// Fetch messages by channel
async function fetchGroupDiscussionByChannel(channel_name) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/channel/${groupId}/${channel_name}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupDiscussionByChannel', responseData);

      if (responseStatus == 200) {
        currChannelMessages = responseData;
        console.log('fetchGroupDiscussionByChannel data', responseData);
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

async function fetchGroupDiscussionMatch(groupId, currChannel, matchString) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/match/${groupId}/${currChannel}/${matchString}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupDiscussionMatch', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback);
  });
}

async function fetchAllUsers() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/persons`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchAllUsers', responseData);

      if (responseStatus == 200) {
        users = responseData;
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback);
  });
}

// Fetch group details
async function fetchGroupByGroupId(groupId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/group/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupByGroupId', responseData);

      if (responseStatus == 200) {
        group = responseData[0];
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback);
  });
}

// Fetch group members
async function fetchGroupMembers(groupId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/joined/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupMembers', responseData);

      if (responseStatus == 200) {
        members = responseData;
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback);
  });
}

// Fetch group announcements
async function fetchGroupAnnouncements() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/announcements/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupAnnouncements', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// Fetch group join requests
async function fetchGroupJoinRequests() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/join-requests/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupJoinRequests', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// -------------------------------------------------------------------------------------
//                         Create/Update/Delete Functions
// -------------------------------------------------------------------------------------

async function createGroupDiscussionChannel(channel_name) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/channel/${userId}`;

    const data = {
      group_id: groupId,
      channel_name: channel_name,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createGroupDiscussionChannel', responseData);

      // channel created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // name conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Group channel already exists',
        });

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

async function createGroupDiscussionMessage(message) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/send/${userId}`;

    const data = {
      group_id: groupId,
      channel_name: currChannel,
      message: message,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createGroupDiscussionMessage', responseData);

      // message created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not a group member',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

async function updateGroupDiscussionMessage(messageId, newMessage) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/edit/${userId}`;

    const data = {
      id: messageId,
      new_message: newMessage,
    };

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupDiscussionMessage', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not send this message',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

async function deleteGroupDiscussionMessage(messageId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/delete/${userId}`;

    const data = {
      id: messageId,
    };

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupDiscussionMessage', responseData);

      // message deleted: success
      if (responseStatus == 204) {
        resolve();

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User did not send the message
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not send this message',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', data, token);
  });
}

// Delete Group Channel
async function deleteGroupDiscussionChannel(channel_name) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/messages/channel/${groupId}`;

    const data = {
      channel_name: channel_name,
    };

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupDiscussionChannel', responseData);

      // message deleted: success
      if (responseStatus == 204) {
        resolve();

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User did not send the message
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Group channel not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', data, token);
  });
}

// Leave group
async function deleteGroupMembership() {
  const data = {
    group_id: groupId,
    user_id: userId,
  };

  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/leave/${data.group_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupMembership', responseData);

      // membership deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // user cannot leave
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'User cannot leave as its creator',
        });

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User is not a member
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'User is not a member',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', data, token);
  });
}

// Remoeve member
async function deleteGroupMember(removedUsedId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/kick/${groupId}/${removedUsedId}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupMembership', responseData);

      // membership deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // user cannot leave
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'User cannot leave as its creator',
        });

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User is not a member
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'User is not a member',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

// Create group announcement
async function createGroupAnnouncement(text) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/announcements/${groupId}`;

    const data = {
      text: text,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createGroupAnnouncement', responseData);

      // message created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not a group member',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

// Update group announcement
async function updateGroupAnnouncement(text, announcementId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/announcements/${groupId}/${announcementId}`;

    const data = {
      text: text,
    };

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupAnnouncement', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });

        // Announcement not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Announcement not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

async function deleteGroupAnnouncement(announcementId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/announcements/${groupId}/${announcementId}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroupAnnouncement', responseData);

      // membership deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User is not a member
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Announcement not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

// Update group description
async function updateGroupDescription(description) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/description/${groupId}`;

    const data = {
      description: description,
    };

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupDescription', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Group not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update group module
async function updateGroupModule(module) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/module/${groupId}`;

    const data = {
      module: module,
    };

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupModule', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Group not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update group publicity
async function updateGroupPublicity(public) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/public/${groupId}`;

    const data = {
      public: public,
    };

    const callback = (responseStatus, responseData) => {
      console.log('updateGroupPublicity', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Group not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// user to admin
async function updateRoleToAdmin(userBeingPromotedUserId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/roleToAdmin/${groupId}/${userBeingPromotedUserId}`;

    const callback = (responseStatus, responseData) => {
      console.log('updateRoleToAdmin', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Group not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', null, token);
  });
}

// admin to user
async function updateRoleToUser(userBeingDemotedUserId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/roleToUser/${groupId}/${userBeingDemotedUserId}`;

    const callback = (responseStatus, responseData) => {
      console.log('updateRoleToUser', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: "You are not the group's creator",
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Group not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', null, token);
  });
}

// Create join request
async function createJoinRequest() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/join-requests/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('createJoinRequest', responseData);

      // message created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // Conflict already a member or already has join request
      } else if (responseStatus == 409) {
        reject({
          type: 'forbidden',
          message: 'User is already a group member OR User already has a pending join request',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', null, token);
  });
}

// Accept join request
async function acceptJoinRequest(acceptedUserId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/join-requests/accept/${groupId}/${acceptedUserId}`;

    const callback = (responseStatus, responseData) => {
      console.log('acceptJoinRequest', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'You are not a group admin',
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Join request not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', null, token);
  });
}

// Decline join request
async function declineJoinRequest(declinedUserId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/join-requests/decline/${groupId}/${declinedUserId}`;

    const callback = (responseStatus, responseData) => {
      console.log('declineJoinRequest', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'You are not a group admin',
        });

        // Group not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Join request not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', null, token);
  });
}

// Delete join request
async function deleteJoinRequest(beingDeletedUserId) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/join-requests/${groupId}/${beingDeletedUserId}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteJoinRequest', responseData);

      // membership deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User is not a member
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Join request not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

// Delete group (creator only)
async function deleteGroup() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/groups/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteGroup', responseData);

      // membership deleted: success
      if (responseStatus == 204) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User is not a member
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Join request not found',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

// -------------------------------------------------------------------------------------
//                         Other Functions
// -------------------------------------------------------------------------------------
function checkGroupCreator() {
  if (userId == group.creator_id) {
    return true;
  } else {
    return false;
  }
}

function checkGroupAdmin() {
  let adminList = members.filter((member) => member.role == 'admin');

  if (adminList.find((admin) => admin.user_id == userId)) {
    return true;
  } else {
    return false;
  }
}

function displayToast(type, message) {
  const toastEl = document.getElementById('groupsFeedToast');
  const toastBody = document.getElementById('toastBody');

  // Icons
  const icons = {
    success: 'bi-check-circle-fill',
    error: 'bi-x-circle-fill',
    warning: 'bi-exclamation-triangle-fill',
    info: 'bi-info-circle-fill',
  };

  // Colours
  const colors = {
    success: '#198754',
    error: '#dc3545',
    warning: '#ffc107',
    info: '#0dcaf0',
  };

  // Set background color (sets it to the corresponding type or black if match none)
  toastEl.style.backgroundColor = colors[type] || '#333';

  // Set content (sets it to corresponding icon if exist if not info icon used)
  toastBody.innerHTML = `
        <i class="bi ${icons[type] || icons.info}"></i>
        <span>${message}</span>
    `;

  const toast = new bootstrap.Toast(toastEl, {
    delay: 2500,
    autohide: true,
  });

  toast.show();
}
