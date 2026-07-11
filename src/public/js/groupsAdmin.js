// For groups_admin.html

// Get stored school
let school = localStorage.getItem('school');
// Get stored user
let userId = localStorage.getItem('loggedInUserId');
// Get stored group
let groupId = localStorage.getItem('groupId');
// Get stored token
let token = localStorage.getItem('token');
// Fetch group info
let group;
let groupMembers;
let groupChannels;
let groupAnnouncements;
let users;
let groupJoinRequests;

window.addEventListener('DOMContentLoaded', async () => {
  toggleButtons();
  addEventListeners();

  try {
    group = (await fetchGroupByGroupId(groupId))[0];
    groupMembers = await fetchGroupMembers(groupId);
    groupChannels = await fetchGroupChannels();
    groupAnnouncements = await fetchGroupAnnouncements();
    users = await fetchAllUsers();
    groupJoinRequests = await fetchGroupJoinRequests();

    displayGroupDetails();
    displayGroupMembers();
    displayGroupChannels();
    displayGroupAnnouncements();
    displayJoinRequests();

    setupPermissions();
  } catch (err) {
    console.error(err);
  }
});

// -------------------------------------------------------------------------------------
//                              Functions 1
// -------------------------------------------------------------------------------------

// Right sidebar - Button functionality
function toggleButtons() {
  const navButtons = document.querySelectorAll('#adminNav button[data-target]');
  const sections = document.querySelectorAll('.admin-section');

  // Hide all except Group Details
  sections.forEach((section) => (section.style.display = 'none'));
  document.getElementById('group-details').style.display = 'block';

  navButtons.forEach((button) => {
    button.addEventListener('click', () => {
      // Active button
      navButtons.forEach((btn) => btn.classList.remove('active'));
      button.classList.add('active');

      // Hide every section
      sections.forEach((section) => {
        section.style.display = 'none';
      });

      // Show selected section
      const target = document.getElementById(button.dataset.target);
      if (target) {
        target.style.display = 'block';
      }
    });
  });
}

function addEventListeners() {
  const memberSearch = document.getElementById('memberSearch');

  memberSearch.addEventListener('input', (e) => {
    displayGroupMembers(e.target.value);
  });

  document.getElementById('saveGroupDetails').addEventListener('click', editGroupDetails);

  // Members table
  document.querySelector('#members tbody').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const userId = button.dataset.id;

    if (button.classList.contains('remove-admin')) {
      removeAdmin(userId);
    } else if (button.classList.contains('promote-member')) {
      promoteMember(userId);
    } else if (button.classList.contains('remove-member')) {
      removeMember(userId);
    }
  });

  // Channels
  document.querySelector('#channels .list-group').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const channel = button.dataset.channel;

    if (button.classList.contains('delete-channel')) {
      deleteChannel(channel);
    }
  });

  // Join Requests
  document.querySelector('#join-requests .card-body').addEventListener('click', (e) => {
    const button = e.target.closest('button');
    if (!button) return;

    const userId = button.dataset.id;

    if (button.classList.contains('approve-request')) {
      acceptingJoinRequest(userId);
    } else if (button.classList.contains('reject-request')) {
      rejectingJoinRequest(userId);
    }
  });
}

// -------------------------------------------------------------------------------------
//                              Functions 2
// -------------------------------------------------------------------------------------

async function editGroupDetails() {
  const updatedGroup = {
    description: document.getElementById('groupDescription').value.trim(),
    module: document.getElementById('groupModule').value.trim(),
    public: document.getElementById('groupPublicity').value === 'Public',
  };

  try {
    // updates group details
    await updateGroup(updatedGroup);

    // refetch groups to get new data
    group = (await fetchGroupByGroupId(groupId))[0];

    // display new data
    displayGroupDetails();

    // success toast
    displayToast('success', 'Group updated successfully!');
  } catch (err) {
    console.error(err);
    // error toast
    displayToast('error', 'Failed to update group');
  }
}

async function removeAdmin(demotedUserId) {
  try {
    await updateRoleToUser(demotedUserId);

    // refresh data
    groupMembers = await fetchGroupMembers(groupId);
    await displayGroupMembers();
    displayToast('success', 'Member demoted!');
  } catch (err) {
    displayToast('error', err.message);
  }
}

async function promoteMember(promotedUserId) {
  try {
    await updateRoleToAdmin(promotedUserId);

    groupMembers = await fetchGroupMembers(groupId);
    displayGroupMembers();

    displayToast('success', 'Member promoted!');
  } catch (err) {
    displayToast('error', err.message);
  }
}

async function removeMember(removedMemberUserId) {
  try {
    await deleteGroupMember(removedMemberUserId);

    // refresh data
    groupMembers = await fetchGroupMembers(groupId);
    displayGroupMembers();

    displayToast('success', 'Member removed!');
  } catch (err) {
    displayToast('error', err.message);
  }
}

function editChannel() {}

function deleteChannel() {}

function createAnnouncement() {}

function editAnnouncement() {}

function deleteAnnouncement() {}

async function updateGroup(data) {
  await Promise.all([
    updateGroupDescription(data.description),
    updateGroupModule(data.module),
    updateGroupPublicity(data.public),
  ]);
}

async function acceptingJoinRequest(acceptedUserId) {
  try {
    await acceptJoinRequest(acceptedUserId);
    // Delete join request
    await deleteJoinRequest(acceptedUserId);

    // Refresh data
    groupJoinRequests = await fetchGroupJoinRequests();
    groupMembers = await fetchGroupMembers(groupId);
    displayToast('success', 'Join request approved!');

    displayJoinRequests();
    displayGroupMembers();
  } catch (err) {
    console.error(err);
    displayToast('error', 'Failed to approve join request');
  }
}

async function rejectingJoinRequest(rejectedUserId) {
  try {
    await declineJoinRequest(rejectedUserId);
    // Delete join request
    await deleteJoinRequest(rejectedUserId);

    // Refresh data
    groupJoinRequests = await fetchGroupJoinRequests();

    displayJoinRequests();

    displayToast('success', 'Join request rejected!');
  } catch (err) {
    console.error(err);
    displayToast('error', 'Failed to reject join request');
  }
}

// -------------------------------------------------------------------------------------
//                              Display Functions
// -------------------------------------------------------------------------------------

function displayGroupDetails() {
  document.getElementById('groupName').value = group.name;
  document.getElementById('groupName').disabled = true;

  document.getElementById('groupDescription').value = group.description;

  document.getElementById('groupModule').value = group.module;

  document.getElementById('groupPublicity').value = group.public ? 'Public' : 'Private';
}

function displayGroupMembers(search = '') {
  const tbody = document.querySelector('#members tbody');
  tbody.innerHTML = '';

  const sortedMembers = [...groupMembers].sort((a, b) => {
    const rank = (member) => {
      if (member.user_id == group.creator_id) return 0;
      if (member.role === 'admin') return 1;
      return 2;
    };

    const rankDiff = rank(a) - rank(b);
    if (rankDiff !== 0) return rankDiff;

    const userA = users.find((u) => u.id == a.user_id);
    const userB = users.find((u) => u.id == b.user_id);

    return (userA?.name ?? '').localeCompare(userB?.name ?? '');
  });

  sortedMembers
    .filter((member) => {
      const user = users.find((u) => u.id == member.user_id);
      return (user?.name ?? '').toLowerCase().includes(search.toLowerCase());
    })
    .forEach((member) => {
      const user = users.find((u) => u.id == member.user_id);

      let badge = '';
      let actions = '';

      if (group.creator_id == member.user_id) {
        badge = `<span class="badge bg-warning">Creator</span>`;
        actions = '-';
      } else if (member.role === 'admin') {
        badge = `<span class="badge bg-primary">Admin</span>`;

        // Don't allow removing yourself as admin
        if (member.user_id == userId) {
          actions = '-';
        } else {
          actions = `
                        <button class="btn btn-outline-secondary btn-sm remove-admin"
                                data-id="${member.user_id}">
                            Remove Admin
                        </button>
                    `;
        }
      } else {
        badge = `<span class="badge bg-secondary">Member</span>`;

        actions = `
                    <button class="btn btn-outline-success btn-sm promote-member"
                            data-id="${member.user_id}">
                        Promote
                    </button>

                    <button class="btn btn-outline-danger btn-sm remove-member"
                            data-id="${member.user_id}">
                        Remove
                    </button>
                `;
      }

      tbody.innerHTML += `
                <tr>
                    <td>${user?.name ?? 'Unknown User'}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
    });
}

function displayGroupChannels() {
  const list = document.querySelector('#channels .list-group');
  list.innerHTML = '';
  list.classList.add('list-group-flush'); // removes outer border

  if (!groupChannels || groupChannels.channels.length === 0) {
    list.innerHTML = `
            <li class="list-group-item text-center text-muted border-0">
                No channels yet.
            </li>
        `;
    return;
  }

  groupChannels.channels.forEach((channel) => {
    list.innerHTML += `
            <li class="list-group-item border-start-0 border-end-0 border-top-0 d-flex justify-content-between align-items-center py-2">

                <span># ${channel}</span>

                <button
                    class="btn btn-outline-danger btn-sm delete-channel"
                    data-channel="${channel}">
                    Delete
                </button>

            </li>
        `;
  });
}

function displayGroupAnnouncements() {
  const announcementList = document.getElementById('announcementList');
  const announcementCount = document.getElementById('announcementCount');

  announcementList.innerHTML = '';

  if (!groupAnnouncements || groupAnnouncements.length === 0) {
    announcementList.innerHTML = `
            <div class="p-4 text-center text-muted">
                No announcements yet.
            </div>
        `;
    announcementCount.textContent = '0 Active';
    return;
  }

  announcementCount.textContent = `${groupAnnouncements.length} Active`;

  groupAnnouncements.forEach((announcement) => {
    // Member name
    let user = users.find((member) => member.id == announcement.user_id);

    const div = document.createElement('div');
    div.className = 'p-4 border-bottom';

    div.innerHTML = `
            <div class="d-flex justify-content-between">

                <div>
                    <small class="text-muted">
                        Posted by ${user?.name ?? 'Anonymous'} •
                        ${new Date(announcement.created_at).toLocaleString()}
                    </small>
                </div>

                <div>
                    <button class="btn btn-outline-secondary btn-sm me-2"
                            data-id="${announcement.announcement_id}">
                        <i class="bi bi-pencil"></i>
                    </button>

                    <button class="btn btn-outline-danger btn-sm"
                            data-id="${announcement.announcement_id}">
                        <i class="bi bi-trash"></i>
                    </button>
                </div>

            </div>

            <p class="mt-3 mb-0">
                ${announcement.text}
            </p>
        `;

    announcementList.appendChild(div);
  });
}

function setupPermissions() {
  let isCreator = checkGroupCreator();
  let isAdmin = checkGroupAdmin();

  console.log('creator', isCreator);
  console.log('admin', isAdmin);

  // Admins but not creators
  if (isAdmin && !isCreator) {
    // Disable editing of group details
    document.getElementById('groupDescription').disabled = true;
    document.getElementById('groupModule').disabled = true;
    document.getElementById('groupPublicity').disabled = true;

    document.getElementById('saveGroupDetails').style.display = 'none';

    // Hide Delete Group button
    document.querySelector('#adminNav .text-danger').style.display = 'none';
  }
}

function displayJoinRequests() {
  const container = document.querySelector('#join-requests .card-body');
  const requestCount = document.getElementById('requestCount');

  container.innerHTML = '';

  if (!groupJoinRequests || groupJoinRequests.length === 0) {
    requestCount.textContent = '0 Pending';

    container.innerHTML = `
      <div class="p-4 text-center text-muted">
        No pending join requests.
      </div>
    `;
    return;
  }

  requestCount.textContent = `${groupJoinRequests.length} Pending`;

  groupJoinRequests.forEach((request) => {
    const user = users.find((u) => u.id == request.user_id);

    const div = document.createElement('div');
    div.className = 'p-3 border-bottom d-flex justify-content-between align-items-center';

    div.innerHTML = `
      <div>
        <strong>${user?.name ?? 'Unknown User'}</strong><br>
        <small class="text-muted">
          Requested ${request.requested_at ? new Date(request.requested_at).toLocaleString() : ''}
        </small>
      </div>

      <div>
        <button
          class="btn btn-success btn-sm me-2 approve-request"
          data-id="${request.user_id}">
          <i class="bi bi-check-lg"></i>
          Approve
        </button>

        <button
          class="btn btn-outline-danger btn-sm reject-request"
          data-id="${request.user_id}">
          Reject
        </button>
      </div>
    `;

    container.appendChild(div);
  });
}
