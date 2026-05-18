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

async function handleSchoolButtonClick(school) {
    let groups = await fetchGroupsBySchool();


    // Redirect user to groups_page.html
    window.location.href = '/groups_page.html';


}





// function fetchGroupsBySchool() {
//     // Get the user_id from the local storage
//     const user_id = localStorage.getItem('userId');

//     const url = `http://localhost:3000/groups/school/${school_name}`;

//     // getting the fields where data will be displayed
//     const usernameMessage = document.getElementById('usernameField');
//     const pointsMessage = document.getElementById('pointsField')

//     const callback = (responseStatus, responseData) => {
//         console.log(responseData)
//         if (responseStatus == 200) {
//             usernameMessage.innerText = responseData.username;
//             pointsMessage.innerText = responseData.points;

//         // User not found or token expired
//         } else if (responseStatus == 404 || responseStatus == 401) {
//             // redirects to login page
//             window.location.href = './login.html'
//         // Internal server error
//         } else {
//             alert('Error occured with the server. Check server is running before trying again. ')
//         }
//     }

//     fetchMethod(url, callback)
// }

// function getJoinedGroups() {
//     // get the user_id from the local storage
//     const user_id = localStorage.getItem('userId');

//     const url = `http://localhost:3000/api/users/${user_id}`;

//     // getting the fields where data will be displayed
//     const usernameMessage = document.getElementById('usernameField');
//     const pointsMessage = document.getElementById('pointsField')

//     const callback = (responseStatus, responseData) => {
//         console.log(responseData)
//         if (responseStatus == 200) {
//             usernameMessage.innerText = responseData.username;
//             pointsMessage.innerText = responseData.points;

//         // User not found or token expired
//         } else if (responseStatus == 404 || responseStatus == 401) {
//             // redirects to login page
//             window.location.href = './login.html'
//         // Internal server error
//         } else {
//             alert('Error occured with the server. Check server is running before trying again. ')
//         }
//     }

//     fetchMethod(url, callback)
// }

// getUsernameAndPoints();