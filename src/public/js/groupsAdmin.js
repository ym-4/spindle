// For groups_admin.html 

// Get stored school
let school = localStorage.getItem("school");
// Get stored user
let userId = localStorage.getItem("loggedInUserId");
// Get stored group
let groupId = localStorage.getItem("groupId");
// Get stored token
let token = localStorage.getItem('token');
// Fetch group info
let group;
let groupMembers;
let groupChannels;
let groupAnnouncements;
let users; 

window.addEventListener("DOMContentLoaded", async () => {

    toggleButtons();
    addEventListeners();

    try {
        group = await fetchGroupByGroupId(groupId)[0];
        groupMembers = await fetchGroupMembers(groupId);
        groupChannels = await fetchGroupChannels();
        groupAnnouncements = await fetchGroupAnnouncements();
        users = await fetchAllUsers();

        displayGroupDetails();
        displayGroupMembers();
        displayGroupChannels();
        displayGroupAnnouncements();

    } catch (err) {
        console.error(err);
    }


})

// -------------------------------------------------------------------------------------
//                              Functions 1  
// -------------------------------------------------------------------------------------

// Right sidebar - Button functionality
function toggleButtons() {
    const navButtons = document.querySelectorAll("#adminNav button[data-target]");
    const sections = document.querySelectorAll(".admin-section");

    // Hide all except Group Details
    sections.forEach(section => section.style.display = "none");
    document.getElementById("group-details").style.display = "block";

    navButtons.forEach(button => {
        button.addEventListener("click", () => {

            // Active button
            navButtons.forEach(btn => btn.classList.remove("active"));
            button.classList.add("active");

            // Hide every section
            sections.forEach(section => {
                section.style.display = "none";
            });

            // Show selected section
            const target = document.getElementById(button.dataset.target);
            if (target) {
                target.style.display = "block";
            }
        });
    });
}

function addEventListeners() {
    const memberSearch = document.getElementById("memberSearch");

    memberSearch.addEventListener("input", e => {
        displayGroupMembers(e.target.value);
    });
}

// -------------------------------------------------------------------------------------
//                              Functions 2  
// -------------------------------------------------------------------------------------

function removeAdmin() {

}

function promoteMember() {

}

function removeMember() {

}

function editChannel() {

}

function deleteChannel() {

}

function createAnnouncement() {

}

function editAnnouncement() {

}

function deleteAnnouncement() {

}

// -------------------------------------------------------------------------------------
//                              Display Functions  
// -------------------------------------------------------------------------------------

function displayGroupDetails() {
    document.getElementById("groupName").value = group.name;
    document.getElementById("groupName").disabled = true;

    document.getElementById("groupDescription").value = group.description;

    document.querySelector("input[value='CS1010']").value = group.module;

    document.querySelector("select").value =
        group.public ? "Public" : "Private";
}

function displayGroupMembers(search = "") {

    const tbody = document.querySelector("#members tbody");
    tbody.innerHTML = "";

    const sortedMembers = [...groupMembers].sort((a, b) => {

        const rank = member => {
            if (member.user_id == group.creator_id) return 0;
            if (member.role === "admin") return 1;
            return 2;
        };

        const rankDiff = rank(a) - rank(b);
        if (rankDiff !== 0) return rankDiff;

        const userA = users.find(u => u.id == a.user_id);
        const userB = users.find(u => u.id == b.user_id);

        return (userA?.name ?? "").localeCompare(userB?.name ?? "");
    });

    sortedMembers
        .filter(member => {
            const user = users.find(u => u.id == member.user_id);
            return (user?.name ?? "")
                .toLowerCase()
                .includes(search.toLowerCase());
        })
        .forEach(member => {

            const user = users.find(u => u.id == member.user_id);

            let badge = "";
            let actions = "";

            if (group.creator_id == member.user_id) {

                badge = `<span class="badge bg-warning">Creator</span>`;
                actions = "-";

            } else if (member.role === "admin") {

                badge = `<span class="badge bg-primary">Admin</span>`;

                actions = `
                    <button class="btn btn-outline-secondary btn-sm remove-admin"
                            data-id="${member.user_id}">
                        Remove Admin
                    </button>
                `;

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
                    <td>${user?.name ?? "Unknown User"}</td>
                    <td>${badge}</td>
                    <td>${actions}</td>
                </tr>
            `;
        });

}

function displayGroupChannels() {

    const list = document.querySelector("#channels .list-group");
    list.innerHTML = "";
    list.classList.add("list-group-flush"); // removes outer border

    if (!groupChannels || groupChannels.channels.length === 0) {
        list.innerHTML = `
            <li class="list-group-item text-center text-muted border-0">
                No channels yet.
            </li>
        `;
        return;
    }

    groupChannels.channels.forEach(channel => {

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
    const announcementList = document.getElementById("announcementList");
    const announcementCount = document.getElementById("announcementCount");

    announcementList.innerHTML = "";

    if (!groupAnnouncements || groupAnnouncements.length === 0) {
        announcementList.innerHTML = `
            <div class="p-4 text-center text-muted">
                No announcements yet.
            </div>
        `;
        announcementCount.textContent = "0 Active";
        return;
    }

    announcementCount.textContent = `${groupAnnouncements.length} Active`;

    groupAnnouncements.forEach(announcement => {

        // Member name
        let user = users.find(member => member.id == announcement.user_id)

        const div = document.createElement("div");
        div.className = "p-4 border-bottom";

        div.innerHTML = `
            <div class="d-flex justify-content-between">

                <div>
                    <small class="text-muted">
                        Posted by ${user.name ?? "Anonymous"} •
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
