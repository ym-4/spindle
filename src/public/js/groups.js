/* For logic across Groups pages */


/*
    Additional: 
    Users can upload images to use as the group image
    (For now: Placeholder image will be used)
*/

/* HTML Templates */
let groupCardTemplate = `
    <div class="group-card" data-group-id="curr-group-id">
        <div class="group-top">

            <div class="group-info">
                <img src="images/Groups_SOC_Building.png" class="group-icon">
                <h3>Genshin Impact Official</h3>
            </div>

            <div class="card-line"></div>
        </div>


        <p>
            Lorem ipsum dolor sit amet consectetur adipisicing elit.
        </p>

        <div class="group-footer">
            <span>🟢 Online</span>
            <span>10K Members</span>
        </div>
    </div>
`;

/* Event listeners */ 

/* Listen for button clicks */
const schoolButtons = document.querySelectorAll(".btn-style");

schoolButtons.forEach(btn => {
    btn.addEventListener("click", (e) => {
        console.log("Clicked button ID:", e.currentTarget.id);
        handleSchoolButtonClick(e.currentTarget.id);
    });
});

let groups = [];
let joinedGroups = [];
let groupMembers = [];
let currentSchool = '';
let popularGroupsContainer;
let joinedGroupsContainer;

// Keeps track of what page the user is on currently
let currentPopularPage = 1;
let currentJoinedPage = 1;

// Only runs in groups_page.html
const currentURL = window.location.href; 
if (currentURL == 'http://localhost:3000/groups_page.html') {
    window.addEventListener("DOMContentLoaded", async () => {
        // Get stored school
        const school = localStorage.getItem("school");

        // No school found
        if (!school) {
            console.error("No school found in localStorage");
            return
        }

        let fullSchoolName = [
            { id: "cls", name: "Chemical and Life Sciences", code: "CLS" },
            { id: "mae", name: "Mechanical & Aeronautical Engineering", code: "MAE" },
            { id: "eee", name: "Electrical and Electronic Engineering", code: "EEE" },
            { id: "abe", name: "Architecture and The Built Environment", code: "ABE" },
            { id: "sb", name: "School of Business", code: "SB" },
            { id: "mad", name: "Media, Arts & Design", code: "MAD" },
            { id: "soc", name: "School of Computing", code: "SOC" },
            { id: "sma", name: "Singapore Maritime Academy", code: "SMA" }
        ];

        let currentSchoolObj = fullSchoolName.find(obj => obj.id == school);

        if (!currentSchoolObj) {
            currentSchoolObj = {
                name: "All Joined Groups",
                code: "JOIN_GROUPS"
            };
        }

        // Display school name 
        document.getElementById("school-name").innerText = currentSchoolObj.name;

        // Display school image 
        // User Groups image: <a href="https://www.flaticon.com/free-icons/people" title="people icons">People icons created by Freepik - Flaticon</a>
        document.getElementById("school-img").src = `./images/Groups_${currentSchoolObj.code}_Building.png`;

        popularGroupsContainer = document.getElementById('popularGroupsContainer');
        joinedGroupsContainer = document.getElementById('joinedGroupsContainer');

        try  {

            // Get groups user joined
            joinedGroups = await fetchJoinedGroups();
            console.log("joinedGroups", joinedGroups);

            console.log("School: ", school);
            // Display all joined groups
            if (school == "userGroups") {
                
                groups = joinedGroups;

                // Hide the Popular Groups tab
                document.getElementById("popularGroupsSection").style.display = "none";

                // Hide Add button 
                document.getElementById("add-btn").style.display = "none";


                // Add event listeners for arrow buttons
                document.getElementById("joinedLeft")
                    .addEventListener("click", () => handleArrowButtonClick("joinedLeft"));

                document.getElementById("joinedRight")
                    .addEventListener("click", () => handleArrowButtonClick("joinedRight"));

                if (joinedGroups.length == 0) {
                    joinedGroupsContainer.innerText = "There are no groups currently, feel free to join one";
                } else {
                    // reset
                    groupMembers = [];
                   // Get group members for each group
                    for (let i = 0; i < joinedGroups.length; i++) {
                        let members = await fetchGroupMembers(joinedGroups[i].group_id);
                        let groupId = joinedGroups[i].group_id;
                        groupMembers.push({
                            groupId: groupId, 
                            member: members
                        });
                    }

                    // Add event listener to detect when group is clicked
                    joinedGroupsContainer.addEventListener("click", (e) => {
                        const card = e.target.closest(".group-card");
                        if (!card) return;

                        const groupId = card.dataset.groupId;;
                        handleJoinedGroupClicked(groupId);
                    });
                }

                displayJoinedGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage)

            // Display groups from school clicked
            } else {
                currentSchool = school;

                // Add event listeners for arrow buttons
                document.getElementById("popularLeft")
                    .addEventListener("click", () => handleArrowButtonClick("popularLeft"));

                document.getElementById("popularRight")
                    .addEventListener("click", () => handleArrowButtonClick("popularRight"));

                document.getElementById("joinedLeft")
                    .addEventListener("click", () => handleArrowButtonClick("joinedLeft"));

                document.getElementById("joinedRight")
                    .addEventListener("click", () => handleArrowButtonClick("joinedRight"));

                // Add event listener for add button
                document.getElementById("add-btn") 
                    .addEventListener("click", () => handleAddButton(school));

                groups = await fetchGroupsBySchool(school.toUpperCase());
                console.log("Groups", groups);
                
                // Get all group ID for school
                let groupIDs = groups.map(group => group.id)

                // filter joined groups by school
                joinedGroups = joinedGroups.filter(joinedGroup => {
                    return groupIDs.includes(joinedGroup.group_id);
                })

                // Displays message if there are no groups
                if (groups.length == 0) {
                    popularGroupsContainer.innerHTML = "There are no groups currently, feel free to create one";
                } else {
                    // reset
                    groupMembers = [];

                    // Get group members for each group
                    for (let i = 0; i < groups.length; i++) {
                        let members = await fetchGroupMembers(groups[i].id);
                        let group_id = groups[i].id;
                        groupMembers.push({
                            groupId: group_id, 
                            member: members
                        });
                    }

                    // Display groups 
                    displayGroups(groups, popularGroupsContainer, currentPopularPage);

                    // Add event listener to detect when group is clicked
                    popularGroupsContainer.addEventListener("click", (e) => {
                        const card = e.target.closest(".group-card");
                        if (!card) return;

                        const groupId = card.dataset.groupId;;
                        handleGroupClicked(groupId);
                    });
                }

                if (joinedGroups.length == 0) {
                    joinedGroupsContainer.innerText = "There are no groups currently, feel free to join one";
                } else {
                    // Display joined groups
                    displayJoinedGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);

                    // Add event listener to detect when group is clicked
                    joinedGroupsContainer.addEventListener("click", (e) => {
                        const card = e.target.closest(".group-card");
                        if (!card) return;

                        const groupId = card.dataset.groupId;
                        handleJoinedGroupClicked(groupId);
                    });
                }

            }

        } catch (err) {
            console.error(err);
            alert("Failed to fetch groups");
        }

    })
}

// -------------------------------------------------------------------------------------
//                              Handler Functions  
// -------------------------------------------------------------------------------------

function handleSchoolButtonClick(school) {
    localStorage.setItem("school", school);
    window.location.href = "groups_page.html";

}

async function handleArrowButtonClick(btnID) {

    if (groups.length == 0) {
        popularGroupsContainer.innerHTML = "There are no groups currently, feel free to create one";
        return; 
    }

    if (joinedGroups.length == 0) {
        joinedGroupsContainer.innerHTML = "There are no groups currently, feel free to join one";
        return;
    }

    const cardsPerPage = 4;
    const maxPopularPage = Math.ceil(groups.length / cardsPerPage);
    const maxJoinedPage = Math.ceil(joinedGroups.length / cardsPerPage);


    if (btnID == "popularLeft") {
        // Already on first page (Go to last page)
        if (currentPopularPage == 1) {
            currentPopularPage = maxPopularPage;
        } else {
            currentPopularPage--;
        }

        displayGroups(groups, popularGroupsContainer, currentPopularPage);


    } else if (btnID == "popularRight") {
        // Already on last page (Go to first page) 
        if (currentPopularPage == maxPopularPage) {
            currentPopularPage = 1;

        } else {
            currentPopularPage++;
        }

        displayGroups(groups, popularGroupsContainer, currentPopularPage);


    } else if (btnID == "joinedLeft") {
        // Already on first page (Go to last page)
        if (currentJoinedPage == 1) {
            currentJoinedPage = maxJoinedPage;
        } else {
            currentJoinedPage--;
        }

        displayJoinedGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);

    } else if (btnID == "joinedRight") {
        // Already on last page (Go to first page) 
        if (currentJoinedPage == maxJoinedPage) {
            currentJoinedPage = 1;

        } else {
            currentJoinedPage++;
        }

        displayJoinedGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);

    } else {
        // button id does not match any case
        // ???
        console.log("arrow button error")
    }
}

async function handleAddButton(school) {

    const modalElement = document.getElementById('create-group-modal');
    const modal = new bootstrap.Modal(modalElement);

    modal.show();

    document.getElementById("create-group-btn").onclick = () => {
        handleCreateButton();
    };

    // Reset form when closed
    document.getElementById("create-group-form").reset();

}

async function handleCreateButton() {
    const name = document.getElementById("group-name").value.trim();
    const description = document.getElementById("group-description").value.trim();
    const module = document.getElementById("group-module").value.trim();

    if (!name || !description || !module) {
        // CHANGE TO TOAST
        alert("Please fill in the required fields");
        return;
    }

    const data = {
        "name": name, 
        "description": description, 
        "school": currentSchool.toUpperCase(), 
        "module": module
    }

    try {
        const result = await createGroup(data);
        console.log("Group created: ", result);

        const modalElement = document.getElementById('create-group-modal');
        const modal = bootstrap.Modal.getInstance(modalElement);
        // Hide modal
        modal.hide();

        // Refresh page with new group
        await refreshGroupPage()

    // Catches any errors that occur (e.g. name conflict)
    } catch (err) {
        console.error(err);

        if (err.type === "conflict") {
            alert("Group name already exists");
        
        } else if (err.type === "bad request") {
            alert("Missing required fields");
        
        } else {
            alert("Something went wrong");
        }

    }
}

// Show modal for group clicked
async function handleGroupClicked(groupId) {
    console.log("Group clicked");

    const modalElement = document.getElementById('join-group-modal');
    const modal = new bootstrap.Modal(modalElement);

    // store groupId
    modalElement.dataset.groupId = groupId;

    displayGroupInfo(groupId);

    // Add event listeners to detect if user clicks button
    document.getElementById("leave-group-btn").onclick = () => {
        handleLeaveButton();
    }

    document.getElementById("join-group-btn").onclick = () => {
        handleJoinButton();
    }

    modal.show();

}

// Redirects user to respective group feed
async function handleJoinedGroupClicked(groupId) {
    console.log("Joined group clicked");
    window.location.href = './groups_feed.html';

}

// Send confirm message then let user leave (as long as the user is not the group's creator)
async function handleLeaveButton() {
    // NOT DONE

    // Get group id 
    const modalElement = document.getElementById('join-group-modal');
    const groupId = modalElement.dataset.groupId;

    try {
        await deleteMember({group_id: groupId});

        let currGroup = groups.find(group => group.id == groupId);

        // TODO: CHANGE TO TOAST
        alert(`You have left ${currGroup.name}`);

        // Show new data 
        refreshGroupPage();

        const modalElement = document.getElementById('join-group-modal');
        const modal = bootstrap.Modal.getInstance(modalElement);

        // close the modal
        modal.hide();

    } catch (err) {
        console.error(err);

        if (err.type == "conflict") {
            // TODO: CHANGE TO TOAST
            alert("You cannot leave as its creator"); 

        } else if (err.type == "not found") {
            // TODO: CHANGE TO TOAST
            alert("You are not a member");

        } else if (err.type == "bad request") {
            // TODO: CHANGE TO TOAST
            alert("Missing information");

        } else {
            alert("Something went wrong");
        }
    }
}

// Let user join the group (for now all are allowed to join any groups)
// In future: only allowed to join public groups and send request to join private groups
async function handleJoinButton() {

    // Get group id 
    const modalElement = document.getElementById('join-group-modal');
    const groupId = modalElement.dataset.groupId;

    try {
        await createMember({group_id: groupId});

        let currGroup = groups.find(group => group.id == groupId);

        // TODO: CHANGE TO TOAST
        alert(`You have successfully joined ${currGroup.name}`);

        // Show new data 
        refreshGroupPage();

        const modalElement = document.getElementById('join-group-modal');
        const modal = bootstrap.Modal.getInstance(modalElement);

        // close the modal
        modal.hide();

    } catch (err) {
        console.error(err);

        if (err.type == "conflict") {
            // TODO: CHANGE TO TOAST
            alert("You are already a member"); 

        } else if (err.type == "not found") {
            // TODO: CHANGE TO TOAST
            alert("Group not found");

        } else if (err.type == "bad request") {
            // TODO: CHANGE TO TOAST
            alert("Missing information");

        } else {
            alert("Something went wrong");
        }
    }

}

// -------------------------------------------------------------------------------------
//                              Display Functions  
// -------------------------------------------------------------------------------------

// Displays groups based on what page the user is currently on
// Increments current page
function displayGroups(groups, container, currPage) {
    let tempHTML = '';

    // Calculate what index to display 
    let cardsPerPage = 4;
    let start = (currPage - 1) * cardsPerPage; 
    let end = start + cardsPerPage;

    // Example:  
    // currPage = 2
    // cardsperpage = 4
    // start = (2 - 1) * 4 = 4 
    // end = 4 + 4 = 8

    // Make sure that there are sufficient groups (groups.length > end)
    for (let i = start; i < end && i < groups.length; i++) {
        let currGroup = groups[i];

        let groupObj = groupMembers.find(groupObj => currGroup.id == groupObj.groupId);
        let members = groupObj ? groupObj.member : [];

        // CHANGE currentSchool to respective group icon if implemented
        tempHTML += `
            <div class="group-card" data-group-id="${currGroup.id}">
                <div class="group-top">

                    <div class="group-info">
                        <img src="images/Groups_${currentSchool}_Building.png" class="group-icon">
                        <h3>${currGroup.name}</h3>
                    </div>

                    <div class="card-line"></div>
                </div>


                <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit.
                </p>

                <div class="group-footer">
                    <span>${currGroup.module}</span>
                    <span>${members?.length || 0}  Members</span>
                </div>
            </div>
        `;

    }

    container.innerHTML = tempHTML;
}

// Difference between displayGroups: school changes based on group VS just one school shown
function displayJoinedGroups(groups, container, currPage) {
    let tempHTML = '';

    // Calculate what index to display 
    let cardsPerPage = 4;
    let start = (currPage - 1) * cardsPerPage; 
    let end = start + cardsPerPage;

    // Example:  
    // currPage = 2
    // cardsperpage = 4
    // start = (2 - 1) * 4 = 4 
    // end = 4 + 4 = 8

    // Make sure that there are sufficient groups (groups.length > end)
    for (let i = start; i < end && i < groups.length; i++) {
        let currGroup = groups[i];
        let school = currGroup.school;
        
        console.log("jigfoji", groupMembers)
        let groupObj = groupMembers.find(groupObj => currGroup.group_id == groupObj.groupId);
        console.log("jifdsjsfdjoji", groupObj)

        let members = groupObj ? groupObj.member : [];

        // CHANGE currentSchool to respective group icon if implemented
        tempHTML += `
            <div class="group-card" data-group-id="${currGroup.group_id}">
                <div class="group-top">

                    <div class="group-info">
                        <img src="images/Groups_${school.toUpperCase()}_Building.png" class="group-icon">
                        <h3>${currGroup.name}</h3>
                    </div>

                    <div class="card-line"></div>
                </div>


                <p>
                    Lorem ipsum dolor sit amet consectetur adipisicing elit.
                </p>

                <div class="group-footer">
                    <span>${currGroup.module}</span>
                    <span>${members?.length || 0} Members</span>
                </div>
            </div>
        `;

    }

    container.innerHTML = tempHTML;
}

// Displays Group info and allows users to join or leave group
function displayGroupInfo(groupId) {

    // Get the current group 
    const currGroup = groups.find(group => {return group.id == groupId});
    // Sample group
    /*
        creator_id: 1
        description: "A group for SOC students to revise and share notes."
        id: 1
        module: "CS1010"
        name: "SOC Study Buddies"
        public: true
        school: "SOC"
    */
   console.log("currgroup", currGroup)

    let groupObj = groupMembers.find(groupObj => groupObj.groupId == groupId);
    let members = groupObj ? groupObj.member : [];

    const isJoined = joinedGroups.find(group => {
        return group.group_id == groupId
    })

    // Update modal details
    document.getElementById("joinGroupName").innerText = currGroup.name;
    document.getElementById("joinGroupMembers").innerText = members.length;
    document.getElementById("joinGroupModule").innerText = currGroup.module;
    document.getElementById("joinGroupSchool").innerText = currGroup.school;
    document.getElementById("joinGroupDescription").innerText = currGroup.description;
    
    document.getElementById("joinGroupPublicity").classList.remove("bg-success", "bg-danger");

    if (currGroup.public) {
        document.getElementById("joinGroupPublicity").innerText = "Public Group";
        document.getElementById("joinGroupPublicity").classList.add("bg-success");

    } else {
        document.getElementById("joinGroupPublicity").innerText = "Private Group";
        document.getElementById("joinGroupPublicity").classList.add("bg-danger");
    
    }

    // Check if user is a member 
    // Is a member (hide join button and show leave button)
    if (isJoined) {
        document.getElementById("leave-group-btn").style.display = "block";
        document.getElementById("join-group-btn").style.display = "none";

    // Not a member (hide leave button and show join button)
    } else {
        document.getElementById("join-group-btn").style.display = "block";
        document.getElementById("leave-group-btn").style.display = "none";

    }

}

// -------------------------------------------------------------------------------------
//                              Fetch Functions  
// -------------------------------------------------------------------------------------

function fetchGroupsBySchool(school) {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/school/${school.toUpperCase()}`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchGroupsBySchool", responseData);

            if (responseStatus == 200) {
                groups = responseData;
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback);
    });
}

function fetchJoinedGroups() {
    // get the user_id from the local storage
    const user_id = localStorage.getItem('userId');

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/joined_groups/${user_id}`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchJoinedGroups", responseData);

            if (responseStatus == 200) {
                joinedGroups = responseData;
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback);
    });
}

function fetchGroupMembers(groupId) {
    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/joined/${groupId}`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchGroupMembers", responseData);

            if (responseStatus == 200) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback);
    });
}

// -------------------------------------------------------------------------------------
//                              Create Functions  
// -------------------------------------------------------------------------------------

// data includes: (name, description, school, module)
function createGroup(data) {
    // get the user_id from the local storage
    const user_id = localStorage.getItem('userId');

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/create/${user_id}`;

        const callback = (responseStatus, responseData) => {
            console.log("createGroup", responseData);

            // group created: success
            if (responseStatus == 201) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // name conflict
            } else if (responseStatus == 409) {
                reject({
                    "type": "conflict", 
                    "message": "Group name already exists"
                })

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "POST", data);

    })
}

// data includes: (group_id)
function createMember(data) {
    // get the user_id from the local storage
    const user_id = localStorage.getItem('userId');

    const requestData = {
        ...data,
        user_id: user_id
    };

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/join/${requestData.group_id}`;

        const callback = (responseStatus, responseData) => {
            console.log("createMember", responseData);

            // membership added: success
            if (responseStatus == 201) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // user is already a member 
            } else if (responseStatus == 409) {
                reject({
                    "type": "conflict", 
                    "message": "User is already a member"
                })

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            } else if (responseStatus == 404) {
                reject({
                    "type": "not found", 
                    "message": "Group not found"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "POST", requestData);

    })
}

// -------------------------------------------------------------------------------------
//                              Delete Functions  
// -------------------------------------------------------------------------------------

// data includes: group_id
function deleteMember(data) {
    // get the user_id from the local storage
    const user_id = localStorage.getItem('userId');

    const requestData = {
        ...data,
        user_id: user_id
    };

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/leave/${requestData.group_id}`;

        const callback = (responseStatus, responseData) => {
            console.log("deleteMember", responseData);

            // membership deleted: success
            if (responseStatus == 204) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // user cannot leave 
            } else if (responseStatus == 409) {
                reject({
                    "type": "conflict", 
                    "message": "User cannot leave as its creator"
                })

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            // User is not a member
            } else if (responseStatus == 404) {
                reject({
                    "type": "not found", 
                    "message": "User is not a member"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "DELETE", requestData);

    })
}


// -------------------------------------------------------------------------------------
//                              Other Functions  
// -------------------------------------------------------------------------------------

async function refreshGroupPage() {
    groups = await fetchGroupsBySchool(currentSchool.toUpperCase());

    let groupIDs = groups.map(group => group.id);

    joinedGroups = await fetchJoinedGroups();
    joinedGroups = joinedGroups.filter(g => groupIDs.includes(g.group_id));
    currentPopularPage = 1;
    currentJoinedPage = 1;

    // Display with new data
    // Popular groups
    if (groups.length == 0) {
        popularGroupsContainer.innerHTML =
            "There are no groups currently, feel free to create one";
    } else {
        groupMembers = [];

        for (let i = 0; i < groups.length; i++) {
            let members = await fetchGroupMembers(groups[i].id);

            groupMembers.push({
                groupId: groups[i].id,
                member: members
            });
        }

        displayGroups(groups, popularGroupsContainer, currentPopularPage);
    }

    // Joined groups
    if (joinedGroups.length == 0) {
        joinedGroupsContainer.innerHTML =
            "There are no groups currently, feel free to join one";
    } else {
        displayJoinedGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);
    }

}