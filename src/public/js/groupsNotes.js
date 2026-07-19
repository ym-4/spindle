// Token, userId and groupId is global in other js file
// Global variables
let groupNotes = [];
let groupFolders = [];
let noteLinks = [];
let folderStates = {};

let currNoteId = null;

window.addEventListener('DOMContentLoaded', async () => {
  // Fetch data
  await fetchNoteData();

  // Display data
  displayFolderStructure();

  if (groupNotes.length > 0) {
    displayNote(groupNotes[0].id);
  }

  // Attach listeners
});

// -------------------------------------------------------------------------------------
//                           Event Listener Functions
// -------------------------------------------------------------------------------------

// -------------------------------------------------------------------------------------
//                              Display Functions
// -------------------------------------------------------------------------------------
function displayFolderStructure() {
  const container = document.getElementById('folderStructure');

  container.innerHTML = '';

  groupFolders.forEach((folder) => {
    if (folderStates[folder.id] === undefined) {
      folderStates[folder.id] = true;
    }

    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';

    const expanded = folderStates[folder.id];

    folderDiv.innerHTML = `
        <div class="folder-header">
            <i class="bi ${expanded ? 'bi-chevron-down' : 'bi-chevron-right'}"></i>

            <i class="bi bi-folder-fill text-warning"></i>

            ${folder.name}
        </div>

        <div class="folder-items"
            style="display:${expanded ? 'block' : 'none'}">
        </div>
    `;

    const folderItems = folderDiv.querySelector('.folder-items');

    const notes = groupNotes.filter((note) => note.folder_id === folder.id);

    notes.forEach((note) => {
      const noteLink = document.createElement('a');

      noteLink.className = 'wiki-file';

      if (note.id === currNoteId) {
        noteLink.classList.add('active');
      }

      noteLink.innerHTML = `
                <i class="bi ${
                  note.id === currNoteId ? 'bi-file-earmark-text-fill' : 'bi-file-earmark-text'
                }"></i>
                ${note.title}
            `;

      noteLink.onclick = () => {
        displayNote(note.id);
      };

      folderItems.appendChild(noteLink);
    });

    const header = folderDiv.querySelector('.folder-header');
    const items = folderDiv.querySelector('.folder-items');
    const arrow = header.querySelector('.bi');

    header.onclick = () => {
      folderStates[folder.id] = !folderStates[folder.id];

      items.style.display = folderStates[folder.id] ? 'block' : 'none';

      arrow.className = folderStates[folder.id] ? 'bi bi-chevron-down' : 'bi bi-chevron-right';
    };

    container.appendChild(folderDiv);
  });

  // Notes without folder
  const unfiled = groupNotes.filter((note) => note.folder_id == null);

  if (unfiled.length) {
    const folderDiv = document.createElement('div');

    folderDiv.className = 'folder';

    folderDiv.innerHTML = `
            <div class="folder-header">
                <i class="bi bi-chevron-down"></i>
                <i class="bi bi-folder-fill text-warning"></i>
                Unfiled
            </div>

            <div class="folder-items"></div>
        `;

    const items = folderDiv.querySelector('.folder-items');

    unfiled.forEach((note) => {
      const link = document.createElement('a');

      link.className = 'wiki-file';

      link.innerHTML = `
                <i class="bi bi-file-earmark-text"></i>
                ${note.title}
            `;

      link.onclick = () => displayNote(note.id);

      items.appendChild(link);
    });

    container.appendChild(folderDiv);
  }
}

function displayNote(noteId) {
  const note = groupNotes.find((n) => n.id === noteId);

  if (!note) return;

  currNoteId = note.id;

  document.getElementById('noteTitle').textContent = note.title;

  document.getElementById('noteLastEdited').textContent =
    `Last edited ${new Date(note.updated_at).toLocaleString()}`;

  document.getElementById('noteContent').innerHTML = note.content || '';

  // Refresh sidebar so active note changes
  displayFolderStructure();
}

function displayLinks() {}

// -------------------------------------------------------------------------------------
//                              Other Functions
// -------------------------------------------------------------------------------------
async function fetchNoteData() {
  groupNotes = await fetchGroupNotes();
  groupFolders = await fetchGroupFolders();
  noteLinks = await fetchNoteLinks();
}

// -------------------------------------------------------------------------------------
//                              Fetch Functions
// -------------------------------------------------------------------------------------

// Gets the notes for the group
async function fetchGroupNotes() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/group/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupNotes', responseData);

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

// Gets the folders for the group
async function fetchGroupFolders() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/group/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupFolders', responseData);

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

// Gets note by id
async function fetchNoteById(id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/note/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchNoteById', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Note not found',
        });
        displayToast('error', 'Note not found');
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// Gets all note links
async function fetchNoteLinks() {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/links/`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchNoteLinks', responseData);

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

// Gets note links by source note
// Get note links referenced by a note (Get notes that are referenced by this note)
async function fetchNoteLinksBySourceNoteId(id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/links/source/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchNoteLinksBySourceNoteId', responseData);

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

// Gets note links by target note
// Get note links that references a note (Get notes that are reference this note)
async function fetchNoteLinksByTargetNoteId(id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/links/target/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchNoteLinksByTargetNoteId', responseData);

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

// Create note
async function createNote(title) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/${groupId}`;

    const data = {
      title: title,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createNote', responseData);

      // note created: success
      if (responseStatus == 201) {
        resolve(responseData);

        displayToast('success', 'Note was created!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // title conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Note with the same name already exists',
        });

        displayToast('error', 'Note with the same name already exists');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

// Update note
// has id
// is_archived(boolean), is_pinned(boolean), template, title, folder_id
async function updateNote(data) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/${data.id}/group/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('updateNote', responseData);

      // note updated: success
      if (responseStatus == 200) {
        resolve(responseData);

        displayToast('success', 'Note was updated successfully');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // Not the creator of the note
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'Not the creator of the note',
        });

        displayToast('error', 'You did not create this note');

        // note not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Note not found',
        });

        displayToast('error', 'Note not found');

        // conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Note with the same name already exists',
        });

        displayToast('error', 'Note with the same name already exists');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update note content
// data: content, id
async function updateNoteContent(data) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/${data.id}/content`;

    const callback = (responseStatus, responseData) => {
      console.log('updateNoteContent', responseData);

      // note updated: success
      if (responseStatus == 200) {
        resolve(responseData);

        displayToast('success', 'Note saved!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // note not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Note not found',
        });

        displayToast('error', 'Note not found');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Delete note
async function deleteNote(id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/note/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteNote', responseData);

      if (responseStatus == 204) {
        resolve(responseData);

        displayToast('success', 'Note was deleted successfully!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // no permission
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User did not create this note',
        });

        displayToast('error', 'You did not create this note');
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Note not found',
        });

        displayToast('error', 'Note not found');
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', data, token);
  });
}

// Create folder
async function createFolder(name) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/${groupId}`;

    const data = {
      name: name,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createFolder', responseData);

      // folder created: success
      if (responseStatus == 201) {
        resolve(responseData);

        displayToast('success', 'Folder was created!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // title conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Folder with the same name already exists',
        });

        displayToast('error', 'Folder with the same name already exists');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

// Update folder color
// data has: id, color
async function updateFolderColor(data) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/${data.id}/color`;

    const callback = (responseStatus, responseData) => {
      console.log('updateFolderColor', responseData);

      // Folder updated: success
      if (responseStatus == 200) {
        resolve(responseData);

        displayToast('success', 'Folder updated!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // Folder not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Folder not found',
        });

        displayToast('error', 'Folder not found');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update folder icon
// data has: id, icon
async function updateFolderIcon(data) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/${data.id}/icon`;

    const callback = (responseStatus, responseData) => {
      console.log('updateFolderIcon', responseData);

      // Folder updated: success
      if (responseStatus == 200) {
        resolve(responseData);

        displayToast('success', 'Folder updated!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // Folder not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Folder not found',
        });

        displayToast('error', 'Folder not found');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update folder name
// data has: id, name, group_id
async function updateFolderName(data) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/${data.id}/name`;

    const callback = (responseStatus, responseData) => {
      console.log('updateFolderName', responseData);

      // Folder updated: success
      if (responseStatus == 200) {
        resolve(responseData);

        displayToast('success', 'Folder updated!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // Folder not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Folder not found',
        });

        displayToast('error', 'Folder not found');

        // conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Folder name already exists',
        });

        displayToast('error', 'Folder with the same name already exists.');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Delete folder
async function deleteFolder(id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteFolder', responseData);

      if (responseStatus == 204) {
        resolve(responseData);

        displayToast('success', 'Folder was deleted successfully!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Folder not found',
        });

        displayToast('error', 'Folder not found');
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

// Create Link
async function createNoteLink(source_note_id, target_note_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/links/${source_note_id}/${target_note_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('createNoteLink', responseData);

      // folder created: success
      if (responseStatus == 201) {
        resolve(responseData);

        displayToast('success', 'Notes are linked!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Note not found',
        });

        displayToast('error', 'Note not found');

        // title conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Note link already exists',
        });

        displayToast('error', 'Note link already exists');

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', null, token);
  });
}

// Delete Link
async function deleteNoteLink(source_note_id, target_note_id) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/links/${source_note_id}/${target_note_id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteNoteLink', responseData);

      if (responseStatus == 204) {
        resolve(responseData);

        displayToast('success', 'Link was removed!');

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // not found
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Link not found',
        });

        displayToast('error', 'Link not found');
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}
