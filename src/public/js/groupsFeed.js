
// Global variables
let school; 
let userId;
let groupId;
// Stores all user data (id, email, name, avatar)
let users; 
// Stores channel names
let channels; 
// Store current channel name
let currChannel;


/*  Sample data 
    channel_name: "general"
    created_at: "2026-05-25T13:24:54.620Z"
    group_id: 1
    id: 2
    message: "Anyone understands recursion for CS1010?"
    user_id: 2
*/

// Stores the current channel messages
let currChannelMessages;
//


// Stores current message clicked
let message;

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

window.addEventListener("DOMContentLoaded", async () => {
    // Get stored school
    school = localStorage.getItem("school");
    // Get stored user
    userId = localStorage.getItem("loggedInUserId");
    // Get stored group
    groupId = localStorage.getItem("groupId");

    try {
        // Fetch data
        // Fetches group channels
        await fetchGroupChannels();

        // Fetch user data 
        await fetchAllUsers();

        // Fetch group discussion for first group channel
        await fetchGroupDiscussionByChannel(channels[0]);
        currChannel = channels[0];

        // Display data 
        displayChannelSidebar(channels);
        displayChannelMessages(currChannelMessages);

        // Add event listeners
        addEventListenerToChannels(channels);
        addEventListenerToSendMessageButton();
        addEventListenerToMessages();

    } catch (err) {
        console.error(err);
        alert("Error occured");
    }

    console.log('messages', currChannelMessages);

})

// -------------------------------------------------------------------------------------
//                              Handler Functions  
// -------------------------------------------------------------------------------------

async function handleChannelClicked() {
    // Get channel name from id
    const channelName = event.currentTarget.id;

    // Check if user already on the channel clicked
    // User already on the channel (nothing happens)
    // If not change to that channel and display messages from that channel
    if (channelName != currChannel) {
        // Change to that channel
        await changeChannel(channelName);
    }

    console.log("channel clicked");
}

async function handleSendMessageClicked() {
    // Get channel name from id
    const message = document.getElementById("messageInput").value.trim();

    // Check if there is anything in the message 
    // If there is something send message
    if (message != undefined && message != '') {
        await createGroupDiscussionMessage(message);
    
        // Refresh with new message
        await refreshChannelAndChat(currChannel);

        console.log("message sent");

    } else {
        console.log("no message sent");
    }
}

async function handleMessageClicked() {
    
    const messageId = event.currentTarget.id;
    message = currChannelMessages.find(message => message.id == messageId);

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
    console.log("messagesfdsfd", message);
    console.log("save message button clicked");

    const newMessage = document.getElementById("editMessageInput").value.trim();
    
    // Check that new message is not empty 
    if (newMessage == '') {

        const modalElement = document.getElementById("messageModal");
        const modal = new bootstrap.Modal(modalElement);
        
        // Close modal
        modal.hide();

        // change to toast 
        alert("new message cannot be empty")

    } else {
        // Update message
        updateGroupDiscussionMessage(message.id, newMessage);

        // Refresh to show new message
        refreshChannelAndChat(currChannel);

    }

}

// Deletes message
async function handleDeleteMessageButton(message) {
    console.log("delete message button clicked");

}

// -------------------------------------------------------------------------------------
//                              Display Functions  
// -------------------------------------------------------------------------------------

function displayChannelSidebar(channels) {
    // Container
    let channelContainer = document.getElementById("channel-container"); 
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
    document.getElementById("channelHeader").innerText = `# ${currChannel}`;
    
    
    document.getElementById("messageDiv").innerHTML = 
    `
        <input type="text" class="form-control" placeholder="Message #${currChannel}..." id="messageInput">
        <button class="btn" id="sendChatBtn">
            <i class="bi bi-send"></i>
        </button>
    `;

    let messageContainer = document.getElementById("message-container");
    let tempHTML = '';
    let previousDate = null;


    // insert dividers by day 
    for (let i = 0; i < messages.length; i++) {
        let currMessage = messages[i];

        // Format date
        const currentDate = new Date(currMessage.created_at)
            .toLocaleDateString('en-GB', {
                day: 'numeric',
                month: 'short',
                year: 'numeric'
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

        const currUser = users.find(user => user.id == currMessage.user_id);

        tempHTML += `
            <div class="msg ${isUsers ? 'msg-right' : 'msg-left'}">

                <div class="meta">
                    <b class="name">
                        ${isUsers ? 'You' : currUser.name || 'User'}
                    </b>

                    <small>
                        ${new Date(currMessage.created_at).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit'
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

    document.getElementById("modalMessageText").innerText = message.message;

    document.getElementById("editMessageInput").value = message.message;
    
    const modalElement = document.getElementById("messageModal");

    const modal = new bootstrap.Modal(modalElement);

    // Show modal
    modal.show();

}


// -------------------------------------------------------------------------------------
//                              Fetch Functions  
// -------------------------------------------------------------------------------------

// Gets the channels for the group
async function fetchGroupChannels() {
   return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/channels/${groupId}`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchGroupDiscussionChannels", responseData);

            if (responseStatus == 200) {
                channels = responseData.channels;
                console.log("fetchGroupChannels data", responseData)
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

// fetch messages by channel
async function fetchGroupDiscussionByChannel(channel_name) {
   return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/channel/${groupId}/${channel_name}`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchGroupDiscussionByChannel", responseData);

            if (responseStatus == 200) {
                currChannelMessages = responseData;
                console.log("fetchGroupDiscussionByChannel data", responseData)
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

async function fetchGroupDiscussionMatch(matchString) {
   return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/match/${groupId}/${currChannel}/${matchString}`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchGroupDiscussionMatch", responseData);

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

async function fetchAllUsers() {
   return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/persons`;

        const callback = (responseStatus, responseData) => {
            console.log("fetchAllUsers", responseData);

            if (responseStatus == 200) {
                users = responseData;
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
//                         Create/Update/Delete Functions  
// -------------------------------------------------------------------------------------


async function createGroupDiscussionChannel(channel_name) {

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/channel/${userId}`;

        const data = {
            group_id: groupId, 
            channel_name: channel_name
        }

        const callback = (responseStatus, responseData) => {
            console.log("createGroupDiscussionChannel", responseData);

            // channel created: success
            if (responseStatus == 201) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // name conflict
            } else if (responseStatus == 409) {
                reject({
                    "type": "conflict", 
                    "message": "Group channel already exists"
                })

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            // User has no permissions
            } else if (responseStatus = 403) {
                reject({
                    "type": "forbidden",
                    "message": "User is not an admin"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "POST", data);

    })

}

async function createGroupDiscussionMessage(message) {

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/send/${userId}`;

        const data = {
            group_id: groupId, 
            channel_name: currChannel, 
            message: message
        }

        const callback = (responseStatus, responseData) => {
            console.log("createGroupDiscussionMessage", responseData);

            // message created: success
            if (responseStatus == 201) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            // User has no permissions
            } else if (responseStatus = 403) {
                reject({
                    "type": "forbidden",
                    "message": "User is not a group member"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "POST", data);

    })

}

async function updateGroupDiscussionMessage(messageId, newMessage) {

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/edit/${userId}`;

        const data = {
            id: messageId, 
            new_message: newMessage
        }

        const callback = (responseStatus, responseData) => {
            console.log("createGroupDiscussionMessage", responseData);

            // message edited: success
            if (responseStatus == 200) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            // User has no permissions
            } else if (responseStatus = 403) {
                reject({
                    "type": "forbidden",
                    "message": "User did not send this message"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "PUT", data);

    })
}

async function deleteGroupDiscussionMessage(messageId) {

    return new Promise((resolve, reject) => {
        const url = `http://localhost:3000/groups/messages/delete/${userId}}`;

        const data = {
            id: messageId
        }

        const callback = (responseStatus, responseData) => {
            console.log("deleteGroupDiscussionMessage", responseData);

            // message deleted: success
            if (responseStatus == 204) {
                resolve(responseData);

            // Token expired
            } else if (responseStatus == 401) {
                window.location.href = './login.html';

            // bad request: missing info
            } else if (responseStatus == 400) {
                reject({
                    "type": "bad request",
                    "message": "Missing required fields"
                })

            // User did not send the message
            } else if (responseStatus == 403) {
                reject({
                    "type": "forbidden", 
                    "message": "User did not send this message"
                })

            } else {
                reject(responseData);
            }
        };

        fetchMethod(url, callback, "DELETE", requestData);

    })
}

async function deleteGroupDiscussionChannel() {
    // BACKEND ROUTE NOT DONE
}

// -------------------------------------------------------------------------------------
//                          Add Event Listener Functions  
// -------------------------------------------------------------------------------------

function addEventListenerToChannels(channels) {
    channels.forEach(channel => {
        document.getElementById(channel).removeEventListener("click", handleChannelClicked); 
        document.getElementById(channel).addEventListener("click", handleChannelClicked);
    })
}

function addEventListenerToSendMessageButton() {
    document.getElementById("sendChatBtn").removeEventListener("click", handleSendMessageClicked); 
    document.getElementById("sendChatBtn").addEventListener("click", handleSendMessageClicked);
}

function addEventListenerToMessages() {
    currChannelMessages.forEach(message => {
        document.getElementById(message.id).removeEventListener("click", handleMessageClicked);
        document.getElementById(message.id).addEventListener("click", handleMessageClicked);
    })
}

function addEventListenerToMessageOptionsButton() {
    document.getElementById("saveMessageBtn").removeEventListener("click", handleSaveMessageButton);
    document.getElementById("saveMessageBtn").addEventListener("click", handleSaveMessageButton);

    document.getElementById("deleteMessageBtn").removeEventListener("click", handleDeleteMessageButton);
    document.getElementById("deleteMessageBtn").addEventListener("click", handleDeleteMessageButton);
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

    // Fetch messages from that channel
    await fetchGroupDiscussionByChannel(currChannel);

    // Update channel sidebar 
    displayChannelSidebar(channels);

    // Display messages from that channel
    displayChannelMessages(currChannelMessages);

    // add event listeners again 
    addEventListenerToChannels(channels);
    addEventListenerToSendMessageButton();
    addEventListenerToMessages();

}