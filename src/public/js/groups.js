/* For logic across Groups pages */


/*
    Additional: 
    Users can upload images to use as the group image
    (For now: Placeholder image will be used)
*/

/* HTML Templates */
let groupCardTemplate = `
    <div class="group-card">
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
let currentSchool = '';
let popularGroupsContainer;
let joinedGroupsContainer;

// Keeps track of what page the user is on currently
let currentPopularPage = 1;
let currentJoinedPage = 1;

// -------------------------------------------------------------------------------------
//                              Handler Functions  
// -------------------------------------------------------------------------------------

function handleSchoolButtonClick(school) {
    localStorage.setItem("school", school);
    window.location.href = "groups_page.html";

}

// Only run in groups_page.html
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

        currentSchoolObj = fullSchoolName.find(obj => obj.id == school);

        if (!currentSchoolObj) {
            currentSchoolObj = {
                name: "All Joined Groups",
                code: "JOIN_GROUPS"
            };
        }

        // Display school name 
        document.getElementById("school-name").innerText = currentSchoolObj.name;

        // Display school image
        document.getElementById("school-img").src = `./images/Groups_${currentSchoolObj.code}_Building.png`;


        popularGroupsContainer = document.getElementById('popularGroupsContainer');
        joinedGroupsContainer = document.getElementById('joinedGroupsContainer');

        try  {

            // Get groups user joined
            joinedGroups = await fetchJoinedGroups();
            console.log("joinedGroups", joinedGroups);

            // Display all joined groups
            if (school == "userGroups") {
                // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                // NOT COMPLETE
                // !!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!!
                
                // Hide the Popular Groups tab
                document.getElementById("popularGroupsSection").style.display = "none";

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


                groups = await fetchGroupsBySchool(school.toUpperCase());
                console.log("Groups", groups);
                
                // Get all group ID for school
                let groupIDs = groups.map(group => group.id)

                // filter joined groups by school
                joinedGroups = joinedGroups.filter(joinedGroup => {
                    return groupIDs.includes(joinedGroup.group_id);
                })

                // Display groups 
                displayGroups(groups, popularGroupsContainer, currentPopularPage);

                // Display joined groups
                displayGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);

                // Displays message if there are no groups
                if (groups.length == 0) {
                    popularGroupsContainer.innerHTML = "There are no groups currently, feel free to create one";
                }

                if (joinedGroups.length == 0) {
                    joinedGroupsContainer.innerText = "There are no groups currently, feel free to join one";
                }

            }

        } catch (err) {
            console.error(err);
            alert("Failed to fetch groups");
        }

    })
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

        displayGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);

    } else if (btnID == "joinedRight") {
        // Already on last page (Go to first page) 
        if (currentJoinedPage == maxJoinedPage) {
            currentJoinedPage = 1;

        } else {
            currentJoinedPage++;
        }

        displayGroups(joinedGroups, joinedGroupsContainer, currentJoinedPage);

    } else {
        // button id does not match any case
        // ???
        console.log("arrow button error")
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

        // CHANGE currentSchool to respective group icon if implemented
        tempHTML += `
            <div class="group-card">
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
                    <span>🟢 Online</span>
                    <span>10K Members</span>
                </div>
            </div>
        `;

    }

    container.innerHTML = tempHTML;
}

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
        
        // CHANGE currentSchool to respective group icon if implemented
        tempHTML += `
            <div class="group-card">
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
                    <span>🟢 Online</span>
                    <span>10K Members</span>
                </div>
            </div>
        `;

    }

    container.innerHTML = tempHTML;
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



