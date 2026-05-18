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

async function handleSchoolButtonClick(school) {
    try  {
        // Get groups user joined
        joinedGroups = await fetchJoinedGroups();
        console.log("joinedGroups", joinedGroups);

        // Display joined groups
        if (school == "userGroups") {
            
        // Display groups from school clicked
        } else {

            groups = await fetchGroupsBySchool(school.toUpperCase());
            console.log("Groups", groups);
            

            // filter joined groups by school
            joinedGroups.forEach(joinedGroup => {
                let currGroupID = joinedGroup.group_id;
            })

            // Redirect user to groups_page.html
            window.location.href = 'groups_page.html';
        }

    } catch (err) {
        console.error(err);
        alert("Failed to fetch groups");
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



