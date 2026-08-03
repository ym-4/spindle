// Global variables
let school;
let userId;
let groupId;
let fullSchoolName = [
  { id: 'cls', name: 'Chemical and Life Sciences', code: 'CLS' },
  { id: 'mae', name: 'Mechanical & Aeronautical Engineering', code: 'MAE' },
  { id: 'eee', name: 'Electrical and Electronic Engineering', code: 'EEE' },
  { id: 'abe', name: 'Architecture and The Built Environment', code: 'ABE' },
  { id: 'sb', name: 'School of Business', code: 'SB' },
  { id: 'mad', name: 'Media, Arts & Design', code: 'MAD' },
  { id: 'soc', name: 'School of Computing', code: 'SOC' },
  { id: 'sma', name: 'Singapore Maritime Academy', code: 'SMA' },
];

// Stores all user data (id, email, name, avatar)
let users = [];
// Stores token
let token = [];
// Stores channel names
let channels = [];
// Store current channel name
let currChannel = [];
// Store announcements
let announcements = [];
// Store current group data
let group = [];
/* Sample data
    creator_id: 1
    description: "A group for SOC students to revise and share notes."
    id: 1
    module: "CS1010"
    name: "SOC Study Buddies"
    public: true
    school: "SOC"
*/

// Store group members
let members = [];
/*
    group_id
    role
    user_id
*/

// Stores the current channel messages
let currChannelMessages = [];
/*  Sample data 
    channel_name: "general"
    created_at: "2026-05-25T13:24:54.620Z"
    group_id: 1
    id: 2
    message: "Anyone understands recursion for CS1010?"
    user_id: 2
*/

// Stores current message clicked
let message = [];

// Admin list
let adminMembers = [];

// HTML Templates

// Channel sidebar template
/*
    <a href="#" class="list-group-item list-group-item-action active d-flex align-items-center channel-color" id="generalChannel">
        <span class="me-2">#</span> general
    </a>
*/

// Chat divider
/*
    <div class="chat-divider"><span> 20 May 2026 </span></div>
*/

// Others messages (left)
/*
    <div class="msg msg-left">
        <div class="meta">
            <b class="name">Beni</b>
            <small>20/5/2026 18:54 AM</small>
        </div>

        <div class="bubble">
            When is the CA2 due? 
        </div>
    </div>
*/

// Your messages (right)
/*
    <div class="msg msg-right">
        <div class="meta">
            <b class="name">You</b>
            <small>23/5/2026 10:33 AM</small>
        </div>

        <div class="bubble">
            Yeah, I just submitted it 👍
        </div>
    </div>
*/

// Send messages input
/*
    <div class="card-footer bg-white">
        <div class="input-group">
            <input type="text" class="form-control" placeholder="Message #general..." id="messageInput">
            <button class="btn" id="sendChatBtn">
                <i class="bi bi-send"></i>
            </button>
        </div>
    </div>
*/

// Admin member
/*
    <div class="d-flex align-items-center mb-2">
        <img src="images/Groups_profile_2.png" class="rounded-circle me-2" width="30" height="30">
        <span>Alex</span>
    </div>
*/

// Offcanvas
/* 
    <div class="member-card creator">
        <img src="images/Groups_profile_2.png">
        <div>
            <div class="name">Alice</div>
            <small>Creator</small>
        </div>
    </div>
*/

// Main function
window.addEventListener('DOMContentLoaded', async () => {
  // Get stored school
  school = localStorage.getItem('school');
  // Get stored user
  userId = localStorage.getItem('loggedInUserId');
  // Get stored group
  groupId = localStorage.getItem('groupId');
  // Get stored token
  token = localStorage.getItem('token');

  // redirect to login if no token
  if (token == null) {
    window.location.href = 'home.html';
  }

  try {
    // Fetch data
    // Fetches group channels
    await fetchGroupChannels();
    // Fetch group details
    await fetchGroupByGroupId(groupId);
    // Fetch group members
    await fetchGroupMembers(groupId);

    // Fetch user data
    await fetchAllUsers();
    announcements = await fetchGroupAnnouncements();

    // Fetch group discussion for first group channel
    await fetchGroupDiscussionByChannel(channels[0]);
    currChannel = channels[0];

    // Display data
    displayChannelSidebar(channels);
    displayChannelMessages(currChannelMessages);
    displayGroupDetails();
    displayAdmins();
    displayAnnouncements();

    // Add event listeners
    addEventListenerToChannels(channels);
    addEventListenerToSendMessageButton();
    addEventListenerToMessages();
    addEventListenerToCreateChannelButton();
    addEventListenerToLeaveButton();
    addEventListenerToMembersButton();
    addEventListenerToMemberSearch();

    adminMembers = members.filter((member) => member.role == 'admin');

    // Show button to manage group if user is an admin
    if (userId == group.creator_id || checkGroupAdmin()) {
      document.getElementById('manageGroupButton').style.display = 'block';
    } else {
      document.getElementById('manageGroupButton').style.display = 'none';
    }

    const buttonGroup = document.getElementById('tabButtons');

    function moveButtons(tabPane) {
      const placeholder = tabPane.querySelector('.tab-buttons-placeholder');
      if (placeholder) {
        placeholder.appendChild(buttonGroup);
      }
    }
    // Initial tab
    moveButtons(document.querySelector('.tab-pane.active'));

    // Bootstrap tab change
    document.querySelectorAll('[data-bs-toggle="tab"]').forEach((btn) => {
      btn.addEventListener('shown.bs.tab', function (e) {
        const target = document.querySelector(e.target.dataset.bsTarget);
        moveButtons(target);
      });
    });
  } catch (err) {
    console.error(err);
    alert('Error occured');
  }

  console.log('messages', currChannelMessages);
});

// -------------------------------------------------------------------------------------
//                              Handler Functions
// -------------------------------------------------------------------------------------

async function handleChannelClicked(event) {
  // Get channel name from id
  const channelName = event.currentTarget.id;

  // Check if user already on the channel clicked
  // User already on the channel (nothing happens)
  // If not change to that channel and display messages from that channel
  if (channelName != currChannel) {
    // Change to that channel
    await changeChannel(channelName);
  }

  console.log('channel clicked');
}

async function handleSendMessageClicked() {
  // Get channel name from id
  const message = document.getElementById('messageInput').value.trim();

  // Check if there is anything in the message
  // If there is something send message
  if (message != undefined && message != '') {
    await createGroupDiscussionMessage(message);

    // Refresh with new message
    await refreshChannelAndChat(currChannel);

    console.log('message sent');
  } else {
    console.log('no message sent');
  }
}

async function handleMessageClicked(event) {
  const messageId = event.currentTarget.id;
  message = currChannelMessages.find((message) => message.id == messageId);

  // Check that message clicked is users
  // User sent the message (let user see modal that shows message options (edit/delete))
  if (message.user_id == userId) {
    // Show modal
    displayMessageOptionsModal(message);

    // Add event listener
    addEventListenerToMessageOptionsButton();
  } else {
    return;
  }

  console.log('message clicked');
}

// Edits message
async function handleSaveMessageButton() {
  console.log('save message button clicked');

  const newMessage = document.getElementById('editMessageInput').value.trim();

  // Check that new message is not empty
  if (newMessage == '') {
    // change to toast
    alert('new message cannot be empty');
  } else {
    // Update message
    await updateGroupDiscussionMessage(message.id, newMessage);

    // Refresh to show new message
    await refreshChannelAndChat(currChannel);
  }
}

// Deletes message
async function handleDeleteMessageButton() {
  console.log('delete message button clicked');

  // MAYBE ADD CONFIRMATION FOR DELETION
  // Delete message
  await deleteGroupDiscussionMessage(message.id);

  const modalElement = document.getElementById('messageModal');
  const modal = bootstrap.Modal.getInstance(modalElement);

  // Close modal
  if (modal) {
    modal.hide();
  }

  // Refresh to delete message
  await refreshChannelAndChat(currChannel);
}

async function handlecreateChannelButtonClicked() {
  // Check if user is an admin
  let isAdmin = adminMembers.find((admin) => admin.user_id == userId);

  // User is an admin
  if (isAdmin) {
    // Show create channel modal
    displayCreateChannelModal();
    // Add event listener
    addEventListenerToCreateNewChannelButton();

    // User is not an admin
  } else {
    // change to toast
    displayToast('error', 'You do not have permission to create a channel (admin only)');
  }
}

async function handleCreateNewChannelButtonClicked() {
  let newChannelName = document.getElementById('channelNameInput').value;
  // FUTURE CHANGE: CURRENTLY THE CHECKED BUTTON FOR ADMIN ONLY GROUP DOESN'T WORK
  let isAdminOnly = document.getElementById('isPrivateChannel').checked;

  // Remove spaces from channel replace with "-"
  channelName = newChannelName.split(' ').join('-');

  try {
    // Create new channel
    await createGroupDiscussionChannel(channelName);

    const modalElement = document.getElementById('createChannelModal');
    const modal = bootstrap.Modal.getInstance(modalElement);

    // Close modal
    if (modal) {
      modal.hide();
    }

    // refresh Data
    await refreshChannelAndChat(channelName);
    displayToast('success', `Created Channel: ${channelName} channel has been created`);
  } catch (err) {
    console.error(err);

    const modalElement = document.getElementById('createChannelModal');
    const modal = bootstrap.Modal.getInstance(modalElement);

    // Close modal
    if (modal) {
      modal.hide();
    }

    // 409
    if (err.type == 'conflict') {
      displayToast('error', 'Create Channel Failed: Channel with the same name already exists');

      // 403
    } else if (err.type == 'forbidden') {
      displayToast('error', 'Create Channel Failed: You do not have permission (admin only) ');

      // 400
    } else if (err.type == 'bad request') {
      alert('Missing information');
    } else {
      alert('Something went wrong');
    }
  }

  // reset input
  document.getElementById('channelNameInput').value = '';
}

async function handleLeaveButtonClicked() {
  try {
    // leave group
    await deleteGroupMembership();

    displayToast('success', `Left Group: You have left ${group.name}`);

    // redirect to group_page
    window.location.href = './groups_page.html';
  } catch (err) {
    // 409
    if (err.type == 'conflict') {
      displayToast('error', "Leave Group Failed: You cannot leave as the group's creator");

      // 403
    } else if (err.type == 'not found') {
      displayToast('error', 'Leave Group Failed: You are not a member of this group');

      // 400
    } else if (err.type == 'bad request') {
      alert('Missing information');
    } else {
      alert('Something went wrong');
    }
  }
}

async function handleMembersButtonClicked() {
  // Add content to offcanvas
  displayMembers();

  // show offcanvas
  displayOffcanvas();
}

async function handleMemberSearch(e) {
  let matchStr = e.target.value.toLowerCase().trim();

  // display default
  if (matchStr == '') {
    displayMembers();

    // find match
  } else {
    // Look for users that match matchStr
    let matchesUser = users.filter((user) => {
      return user.name.toLowerCase().includes(matchStr);
    });

    let matchedIds = matchesUser.map((u) => u.id);

    // Then check if they are members
    let memberMatches = members.filter((member) => matchedIds.includes(member.user_id));

    console.log('matchesUser', matchesUser);
    console.log('memberMatches', memberMatches);

    displayMemberSearchResults(memberMatches);

    console.log('searchMemberInput', matchStr);
  }
}

// -------------------------------------------------------------------------------------
//                              Display Functions
// -------------------------------------------------------------------------------------

function displayChannelSidebar(channels) {
  // Container
  let channelContainer = document.getElementById('channel-container');
  let tempHTML = '';

  for (let i = 0; i < channels.length; i++) {
    // add active class
    if (channels[i] == currChannel) {
      tempHTML += `
                <a href="#" class="list-group-item list-group-item-action active d-flex align-items-center channel-color" id=${`${channels[i]}`}>
                    <span class="me-2">#</span> ${channels[i]}
                </a>
            `;
    } else {
      tempHTML += `
                <a href="#" class="list-group-item list-group-item-action d-flex align-items-center channel-color" id=${`${channels[i]}`}>
                    <span class="me-2">#</span> ${channels[i]}
                </a>
            `;
    }
  }

  channelContainer.innerHTML = tempHTML;
}

function displayChannelMessages(messages) {
  document.getElementById('channelHeader').innerText = `# ${currChannel}`;

  document.getElementById('messageDiv').innerHTML = `
        <input type="text" class="form-control" placeholder="Message #${currChannel}..." id="messageInput">
        <button class="btn" id="sendChatBtn">
            <i class="bi bi-send"></i>
        </button>
    `;

  let messageContainer = document.getElementById('message-container');
  let tempHTML = '';
  let previousDate = null;

  // insert dividers by day
  for (let i = 0; i < messages.length; i++) {
    let currMessage = messages[i];

    // Format date
    const currentDate = new Date(currMessage.created_at).toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });

    // Insert divider if date changed
    if (currentDate !== previousDate) {
      tempHTML += `
                <div class="chat-divider">
                    <span>${currentDate}</span>
                </div>
            `;

      previousDate = currentDate;
    }

    // Check if user sent the message
    // User sent: right
    // User did not send: left
    const isUsers = Number(currMessage.user_id) === Number(userId);

    const currUser = users.find((user) => user.id == currMessage.user_id);

    let role = 'user';
    let userMember = members.find((member) => member.user_id == currMessage.user_id);

    if (userMember && userMember.role === 'admin') {
      role = 'admin';
    }

    if (currMessage.user_id == group.creator_id) {
      role = 'creator';
    }

    console.log('currMessage.user_id:', currMessage.user_id);
    console.log('users:', users);
    console.log('currUser:', currUser);

    tempHTML += `
            <div class="msg ${isUsers ? 'msg-right' : 'msg-left'}">

                <div class="meta">
                    <b class="name ${role}">
                        ${isUsers ? 'You' : currUser.name || 'User'}
                    </b>

                    <small>
                        ${new Date(currMessage.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                    </small>
                </div>

                <div class="bubble" id="${currMessage.id}">
                    ${currMessage.message}
                </div>

            </div>
        `;
  }

  messageContainer.innerHTML = tempHTML;
}

function displayMessageOptionsModal(message) {
  document.getElementById('modalMessageText').innerText = message.message;

  document.getElementById('editMessageInput').value = message.message;

  const modalElement = document.getElementById('messageModal');

  const modal = new bootstrap.Modal(modalElement);

  // Show modal
  modal.show();
}

function displayMembers() {
  document.getElementById('memberCountOffcanvas').innerText = members.length;

  let adminList = members.filter((member) => member.role == 'admin');
  let tempHTMLAdmin = '';
  let tempHTMLUser = '';
  let tempHTMLCreator = '';

  let countUser = 0;
  let colours = {
    0: 'red',
    1: 'orange',
    2: 'yellow',
    3: 'green',
    4: 'blue',
    5: 'purple',
    6: 'pink',
  };

  for (let i = 0; i < members.length; i++) {
    let currUser = users.find((user) => user.id == members[i].user_id);
    let role = '';
    // true: curr user, false: other users
    let isCurrUser = currUser.id == userId;

    // admin
    if (members[i].role == 'admin') {
      // Check if user is the creator
      if (currUser.id == group.creator_id) {
        role = 'Creator';
        // Displays profile img 1 if its current user and 2 if not
        tempHTMLCreator = `
                    <div class="member-card creator">
                        <div class="member-inner">
                            <img src="images/Groups_profile_${isCurrUser ? 1 : 2}.png">
                            <div>
                                <div class="name">${isCurrUser ? 'You' : currUser.name}</div>
                                <small>${role}</small>
                            </div>
                        </div>
                    </div>
                `;
      } else {
        role = 'Admin';
        // Displays profile img 1 if its current user and 2 if not
        tempHTMLAdmin += `
                    <div class="member-card admin">
                        <img src="images/Groups_profile_${isCurrUser ? 1 : 2}.png">
                        <div>
                            <div class="name">${isCurrUser ? 'You' : currUser.name}</div>
                            <small>${role}</small>
                        </div>
                    </div>
                `;
      }
    } else {
      // cycles through the colours
      let colorId = countUser % 7;
      let color = colours[colorId];
      role = 'User';

      // Displays profile img 1 if its current user and 2 if not
      tempHTMLUser += `
                <div class="member-card user color-${color}">
                    <img src="images/Groups_profile_${isCurrUser ? 1 : 2}.png">
                    <div>
                        <div class="name">${isCurrUser ? 'You' : currUser.name}</div>
                        <small>${role}</small>
                    </div>
                </div>
            `;
      countUser++;
    }
  }

  document.getElementById('adminHeaderOffcanvas').style.display = 'block';
  document.getElementById('memberHeaderOffcanvas').style.display = 'block';

  document.getElementById('adminListOffcanvas').innerHTML = tempHTMLCreator + tempHTMLAdmin;
  document.getElementById('userListOffcanvas').innerHTML = tempHTMLUser;
}

function displayAdmins() {
  let adminContainer = document.getElementById('adminContainer');
  let tempHTML = '';

  let adminList = members.filter((member) => member.role == 'admin');

  for (let i = 0; i < adminList.length; i++) {
    let currAdminId = adminList[i].user_id;

    let currAdmin = users.find((user) => user.id == currAdminId);

    if (currAdminId == group.creator_id) {
      tempHTML += `
                <div class="d-flex align-items-center mb-2">
                    <img src="images/Groups_profile_2.png" class="rounded-circle me-2" width="30" height="30">
                    <span class="me-3">${currAdmin.name}</span>
                    <span class="badge rounded-pill px-3 py-2" style="background-color: #d1aa0c">
                        <i class="bi bi-star-fill me-1"></i>
                        Creator
                    </span>
                </div>
            `;
    } else {
      tempHTML += `
                <div class="d-flex align-items-center mb-2">
                    <img src="images/Groups_profile_2.png" class="rounded-circle me-2" width="30" height="30">
                    <span class="me-3">${currAdmin.name}</span>
                    <span class="badge rounded-pill px-3 py-2" style="background-color: #d10c0c">
                        Admin
                    </span>
                </div>
            `;
    }
  }

  adminContainer.innerHTML = tempHTML;
}

function displayGroupDetails() {
  const schoolObj = fullSchoolName.find((school) => school.code == group.school);

  document.getElementById('bannerGroupName').innerText = group.name;
  document.getElementById('bannerGroupDetails').innerText =
    `${group.module} • ${schoolObj.name} • ${members.length} members`;

  document.getElementById('groupInfoDescription').innerText = group.description;
  document.getElementById('groupInfoModule').innerText = group.module;
  document.getElementById('groupInfoMemberCount').innerText = members.length;
  document.getElementById('groupInfoPublicity').innerText = group.public ? 'Public' : 'Private';
}

function displayAnnouncements() {
  const container = document.getElementById('announcementContainer');

  if (!announcements || announcements.length === 0) {
    container.innerHTML = `
            <div class="text-muted small">
                No announcements yet.
            </div>
        `;
    return;
  }

  let temp = '';

  announcements.forEach((announcement) => {
    temp += `
            <div class="alert p-2 small announcement-color mb-2">
                ${announcement.text}
            </div>
        `;
  });

  container.innerHTML = temp;
}

function displayCreateChannelModal() {
  const modalElement = document.getElementById('createChannelModal');

  const modal = new bootstrap.Modal(modalElement);

  // Show modal
  modal.show();
}

function displayOffcanvas() {
  const offcanvas = new bootstrap.Offcanvas(document.getElementById('membersOffcanvas'));
  offcanvas.show();
}

function displayMemberSearchResults(results) {
  document.getElementById('memberCountOffcanvas').innerText = members.length;

  let adminList = members.filter((member) => member.role == 'admin');
  let tempHTMLUser = '';

  let countUser = 0;
  let colours = {
    0: 'red',
    1: 'orange',
    2: 'yellow',
    3: 'green',
    4: 'blue',
    5: 'purple',
    6: 'pink',
  };

  for (let i = 0; i < results.length; i++) {
    let currUser = users.find((user) => user.id == results[i].user_id);
    let role = '';

    // cycles through the colours
    let colorId = countUser % 7;
    let color = colours[colorId];
    role = 'User';

    tempHTMLUser += `
            <div class="member-card user color-${color}">
                <img src="images/Groups_profile_2.png">
                <div>
                    <div class="name">${currUser.name}</div>
                    <small>${role}</small>
                </div>
            </div>
        `;

    countUser++;
  }

  // Hide admin
  document.getElementById('adminHeaderOffcanvas').style.display = 'none';
  document.getElementById('memberHeaderOffcanvas').style.display = 'none';
  document.getElementById('adminListOffcanvas').innerHTML = '';

  document.getElementById('userListOffcanvas').innerHTML = tempHTMLUser;
}

// -------------------------------------------------------------------------------------
//                          Add Event Listener Functions
// -------------------------------------------------------------------------------------

function addEventListenerToChannels(channels) {
  channels.forEach((channel) => {
    // document.getElementById(channel).removeEventListener("click", (e) => handleChannelClicked(e));
    document.getElementById(channel).addEventListener('click', (e) => handleChannelClicked(e));
  });
}

function addEventListenerToSendMessageButton() {
  // document.getElementById("sendChatBtn").removeEventListener("click", handleSendMessageClicked);
  document.getElementById('sendChatBtn').addEventListener('click', handleSendMessageClicked);
}

function addEventListenerToMessages() {
  currChannelMessages.forEach((message) => {
    // document.getElementById(message.id).removeEventListener("click", (e) => handleMessageClicked(e));
    document.getElementById(message.id).addEventListener('click', (e) => handleMessageClicked(e));
  });
}

function addEventListenerToMessageOptionsButton() {
  // document.getElementById("saveMessageBtn").removeEventListener("click", handleSaveMessageButton);
  document.getElementById('saveMessageBtn').addEventListener('click', handleSaveMessageButton);

  // document.getElementById("deleteMessageBtn").removeEventListener("click", handleDeleteMessageButton);
  document.getElementById('deleteMessageBtn').addEventListener('click', handleDeleteMessageButton);
}

function addEventListenerToCreateChannelButton() {
  // document.getElementById("saveMessageBtn").removeEventListener("click", handleSaveMessageButton);
  document
    .getElementById('createChannelBtn')
    .addEventListener('click', handlecreateChannelButtonClicked);
}

function addEventListenerToCreateNewChannelButton() {
  // document.getElementById("createNewChannelBtn").removeEventListener("click", handleCreateNewChannelButtonClicked);
  document
    .getElementById('createNewChannelBtn')
    .addEventListener('click', handleCreateNewChannelButtonClicked);
}

function addEventListenerToLeaveButton() {
  // document.getElementById("leaveButton").removeEventListener("click", handleLeaveButtonClicked);
  document.getElementById('leaveButton').addEventListener('click', handleLeaveButtonClicked);
}

function addEventListenerToMembersButton() {
  // document.getElementById("membersButton").removeEventListener("click", handleMembersButtonClicked);
  document.getElementById('membersButton').addEventListener('click', handleMembersButtonClicked);
}

function addEventListenerToMemberSearch() {
  document.getElementById('searchMemberInput').addEventListener('input', (e) => {
    handleMemberSearch(e);
  });
}

// -------------------------------------------------------------------------------------
//                            Other Functions
// -------------------------------------------------------------------------------------

async function changeChannel(newChannelName) {
  currChannel = newChannelName;

  // Fetch messages from that channel
  await fetchGroupDiscussionByChannel(newChannelName);

  // Update channel sidebar
  displayChannelSidebar(channels);

  // Display messages from that channel
  displayChannelMessages(currChannelMessages);

  // add event listeners again
  addEventListenerToChannels(channels);
  addEventListenerToSendMessageButton();
  addEventListenerToMessages();
}

// Refresh chat and channels
async function refreshChannelAndChat(channelName) {
  currChannel = channelName;

  // Fetch channels
  await fetchGroupChannels();

  // Fetch Group details
  await fetchGroupByGroupId(groupId);

  // Fetch Group members
  await fetchGroupMembers(groupId);

  // Fetch messages from that channel
  await fetchGroupDiscussionByChannel(currChannel);

  announcements = await fetchGroupAnnouncements();
  displayAnnouncements();

  // Fetch user data
  await fetchAllUsers();

  // Update channel sidebar
  displayChannelSidebar(channels);

  // Display messages from that channel
  displayChannelMessages(currChannelMessages);

  // Display Group details
  displayGroupDetails();

  // Display admins
  displayAdmins();

  // add event listeners again
  addEventListenerToChannels(channels);
  addEventListenerToSendMessageButton();
  addEventListenerToMessages();
  addEventListenerToCreateChannelButton();
  addEventListenerToCreateChannelButton();
  addEventListenerToLeaveButton();
  addEventListenerToMembersButton();
  addEventListenerToMemberSearch();
}
