// For groups_admin.html 

window.addEventListener("DOMContentLoaded", async () => {
    // Get stored school
    school = localStorage.getItem("school");
    // Get stored user
    userId = localStorage.getItem("loggedInUserId");
    // Get stored group
    groupId = localStorage.getItem("groupId");
    // Get stored token
    token = localStorage.getItem('token');

    await fetchGroupByGroupId();

    // Check if user is the group's creator
    function checkGroupCreator(group_id) {
        if (currMessage.user_id == group.creator_id) {
            role = "creator"
        }
    }

    function checkGroupAdmin(group_id) {
        let adminList = members.filter(member => member.role == "admin");
        let isAdmin = adminList.find(admin => admin.user_id == userId);

        if (isAdmin) {
            return true;
        } else {
            return false;
        }
    }
    
    async function fetchGroupByGroupId() {
        return new Promise((resolve, reject) => {
                const url = `http://localhost:3000/groups/group/${groupId}`;

                const callback = (responseStatus, responseData) => {
                    console.log("fetchGroupByGroupId", responseData);

                    if (responseStatus == 200) {
                        group = responseData[0];
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


})