/* global token, fetchMethod, groupId, displayToast, bootstrap */

// Token, userId and groupId is global in other js file
// Global variables
let groupNotes = [];
let groupFolders = [];
let noteLinks = [];
let folderStates = {};
let quill;

let currNoteId = null;

const newNoteFolderModal = new bootstrap.Modal(document.getElementById('newNoteFolderModal'));
const newNoteModal = new bootstrap.Modal(document.getElementById('newNoteModal'));

window.addEventListener('DOMContentLoaded', async () => {
  // Fetch data
  await fetchNoteData();

  // Setup quill
  quill = new Quill('#noteEditor', {
    theme: 'snow',
    placeholder: 'Write your note...',
    modules: {
      toolbar: false,
    },
  });

  // Display folder structure
  displayFolderStructure();

  // Display note
  if (groupNotes.length > 0) {
    displayNote(groupNotes[0].id);
  }

  // Hide editor
  displayNoteEditor(false);

  // Attach listeners
  addListeners();
  addEditorListeners();
});

// -------------------------------------------------------------------------------------
//                           Event Listener Functions
// -------------------------------------------------------------------------------------

function addListeners() {
  // For save and edit note
  document.getElementById('saveNoteBtn').addEventListener('click', handleSaveNote);
  document.getElementById('editNoteBtn').addEventListener('click', handleEditNote);

  // For create new note / folder / whiteboard
  document.getElementById('createNoteBtn').addEventListener('click', () => {
    // Show modal to create note
    document.getElementById('noteNameInput').value = '';
    newNoteModal.show();
  });
  document.getElementById('newNoteBtn').addEventListener('click', handleNewNote);

  document.getElementById('createNoteFolderBtn').addEventListener('click', () => {
    // Shows modal to create new note folder
    document.getElementById('noteFolderNameInput').value = '';
    newNoteFolderModal.show();
  });

  document.getElementById('newNoteFolderBtn').addEventListener('click', handleNewNoteFolder);

  document.getElementById('createWhiteboardBtn').addEventListener('click', handleNewWhiteboard);

  // For graph view
  document.getElementById('graphViewBtn').addEventListener('click', displayLinks);
}

// BUGS: Not implemented: Highlighter, checkboxes, insert functions
// Not working: Font size
// Using headings make scroll move up
// Cannot see save button
// Can change note will editing a note??
function addEditorListeners() {
  // Bold
  document.getElementById('boldBtn').addEventListener('click', () => {
    const current = quill.getFormat();
    quill.format('bold', !current.bold);
  });

  // Italic
  document.getElementById('italicBtn').addEventListener('click', () => {
    const current = quill.getFormat();
    quill.format('italic', !current.italic);
  });

  // Underline
  document.getElementById('underlineBtn').addEventListener('click', () => {
    const current = quill.getFormat();
    quill.format('underline', !current.underline);
  });

  // Strike
  document.getElementById('strikethroughBtn').addEventListener('click', () => {
    const current = quill.getFormat();
    quill.format('strike', !current.strike);
  });

  // Highlighter
  document.getElementById('highlighterBtn').onclick = () => {
    const current = quill.getFormat();

    if (current.background === 'yellow') {
      quill.format('background', false);
    } else {
      quill.format('background', 'yellow');
    }
  };

  // Text headings
  document.getElementById('heading1').addEventListener('click', (e) => {
    e.preventDefault();
    quill.format('header', 1);
  });

  document.getElementById('heading2').addEventListener('click', (e) => {
    e.preventDefault();
    quill.format('header', 2);
  });

  document.getElementById('heading3').addEventListener('click', (e) => {
    e.preventDefault();
    quill.format('header', 3);
  });

  document.getElementById('normalText').addEventListener('click', (e) => {
    e.preventDefault();
    quill.format('header', false);
  });

  // Lists
  document.getElementById('bulletList').onclick = () => quill.format('list', 'bullet');

  document.getElementById('numberList').onclick = () => quill.format('list', 'ordered');

  // DOESN'T WORK
  document.getElementById('checkList').onclick = () => quill.format('list', 'check');

  document.getElementById('noneList').onclick = () => quill.format('list', false);

  // Alignment
  document.getElementById('leftAlignBtn').onclick = () => quill.format('align', '');

  document.getElementById('centerAlignBtn').onclick = () => quill.format('align', 'center');

  document.getElementById('rightAlignBtn').onclick = () => quill.format('align', 'right');

  document.getElementById('justifyAlignBtn').onclick = () => quill.format('align', 'justify');

  // Font size
  const Size = Quill.import('attributors/style/size');

  Size.whitelist = ['12px', '14px', '16px', '18px', '20px', '24px', '28px', '32px'];

  Quill.register(Size, true);

  quill = new Quill('#noteEditor', {
    theme: 'snow',
    modules: {
      toolbar: false,
    },
  });

  document.getElementById('fontSize12').onclick = () => quill.format('size', '12px');
  document.getElementById('fontSize14').onclick = () => quill.format('size', '14px');
  document.getElementById('fontSize16').onclick = () => quill.format('size', '16px');
  document.getElementById('fontSize18').onclick = () => quill.format('size', '18px');
  document.getElementById('fontSize20').onclick = () => quill.format('size', '20px');
  document.getElementById('fontSize24').onclick = () => quill.format('size', '24px');
  document.getElementById('fontSize28').onclick = () => quill.format('size', '28px');
  document.getElementById('fontSize32').onclick = () => quill.format('size', '32px');

  // Inserts

  // Link
  document.getElementById('insertLink').onclick = () => {
    const url = prompt('Enter URL');

    if (!url) return;

    const range = quill.getSelection();

    if (range) {
      quill.format('link', url);
    }
  };

  // Image
  document.getElementById('insertImage').onclick = () => {
    const url = prompt('Image URL');

    if (!url) return;

    const range = quill.getSelection(true);

    quill.insertEmbed(range.index, 'image', url);
  };
}

// -------------------------------------------------------------------------------------
//                              Handler Functions
// -------------------------------------------------------------------------------------

// -----------------------
// Create new something
// -----------------------
async function handleNewNoteFolder() {
  console.log('new folder');
  let folderName = document.getElementById('noteFolderNameInput').value;

  // Hide the modal
  newNoteFolderModal.hide();

  try {
    // Create folder
    const response = await createNoteFolder(folderName);

    // Refresh data
    await fetchNoteData();
    displayFolderStructure();

    displayToast('success', 'Folder was created!');
  } catch (err) {
    displayToast('error', 'Folder with the same name already exists');
  }
}

async function handleNewNote() {
  console.log('new note');
  let noteName = document.getElementById('noteNameInput').value;

  // Hide the modal
  newNoteModal.hide();

  try {
    // Create note
    const response = await createNote(noteName);

    // Refresh data
    await fetchNoteData();
    // Calls display folder structure
    displayNote(response[0].id);

    displayToast('success', 'Note was created!');
  } catch (err) {
    displayToast('error', 'Note with the same name already exists');
  }
}

// NOT DONE
// Use whiteboard.js file
function handleNewWhiteboard() {
  console.log('new whiteboard');
}

// -----------------------
// Edit something
// -----------------------

function handleEditNote() {
  const note = groupNotes.find((n) => n.id === currNoteId);

  if (!note) return;

  document.getElementById('noteTitleInput').value = note.title;
  quill.root.innerHTML = note.content || '';

  displayNoteEditor(true);
}

// NOT DONE
function handleEditWhiteboard() {}

// -----------------------
// Save something
// -----------------------
async function handleSaveNote() {
  const title = document.getElementById('noteTitleInput').value;
  const content = quill.root.innerHTML;

  try {
    // Update note title
    await updateNote({
      id: currNoteId,
      title: title,
    });

    // Update note content
    await updateNoteContent({
      id: currNoteId,
      content: content,
    });

    // Refresh data
    await fetchNoteData();

    // Display again
    displayNote(currNoteId);

    // Hide editor
    displayNoteEditor(false);
  } catch (err) {
    console.error(err);
  }
}

// -------------------------------------------------------------------------------------
//                              Display Functions
// -------------------------------------------------------------------------------------

// Left sidebar - folders
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
  // Notes without folder
  const unfiled = groupNotes.filter((note) => note.folder_id == null);

  if (unfiled.length) {
    // Give Unfiled its own state key
    if (folderStates['unfiled'] === undefined) {
      folderStates['unfiled'] = true;
    }

    const expanded = folderStates['unfiled'];

    const folderDiv = document.createElement('div');
    folderDiv.className = 'folder';

    folderDiv.innerHTML = `
    <div class="folder-header">
      <i class="bi ${expanded ? 'bi-chevron-down' : 'bi-chevron-right'}"></i>
      <i class="bi bi-folder-fill text-warning"></i>
      Unfiled
    </div>

    <div class="folder-items" style="display:${expanded ? 'block' : 'none'}"></div>
  `;

    const items = folderDiv.querySelector('.folder-items');

    unfiled.forEach((note) => {
      const link = document.createElement('a');
      link.className = 'wiki-file';

      // Active note highlight
      if (note.id === currNoteId) {
        link.classList.add('active');
      }

      link.innerHTML = `
      <i class="bi ${
        note.id === currNoteId ? 'bi-file-earmark-text-fill' : 'bi-file-earmark-text'
      }"></i>
      ${note.title}
    `;

      link.onclick = () => displayNote(note.id);

      items.appendChild(link);
    });

    // Make Unfiled collapsible
    const header = folderDiv.querySelector('.folder-header');
    const arrow = header.querySelector('.bi');

    header.onclick = () => {
      folderStates['unfiled'] = !folderStates['unfiled'];

      items.style.display = folderStates['unfiled'] ? 'block' : 'none';

      arrow.className = folderStates['unfiled'] ? 'bi bi-chevron-down' : 'bi bi-chevron-right';
    };

    container.appendChild(folderDiv);
  }
}

// Middle section - Actual note being shown
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

// NOT DONE
// Displays graph view
// When zoomed out no note name, note names shown if zoomed in
// TODO: Handle when a link to a note that doesn't exist occurs (like obsidian? or dont allow?)
function displayLinks() {
  console.log('graph view');
}

// NOT DONE
// Displays links that are connected to the node that was clicked
function displayConnectedLinks() {}

// NOT DONE
// Display in another whiteboard folder
function displayWhiteboards() {}

// NOT DONE
// Hide editor when not editing a note
// Show editor when editing a note
function displayNoteEditor(editing) {
  document.getElementById('noteTitle').classList.toggle('d-none', editing);

  document.getElementById('noteContent').classList.toggle('d-none', editing);

  document.getElementById('noteTitleInput').classList.toggle('d-none', !editing);

  document.getElementById('noteEditor').classList.toggle('d-none', !editing);

  document.getElementById('editNoteBtn').classList.toggle('d-none', editing);

  document.getElementById('saveNoteBtn').classList.toggle('d-none', !editing);
}

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
  // Get stored group
  let groupId = localStorage.getItem('groupId');
  // Get stored token
  let token = localStorage.getItem('token');

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

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // title conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Note with the same name already exists',
        });

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
async function createNoteFolder(name) {
  return new Promise((resolve, reject) => {
    const url = `http://localhost:3000/notes/folders/${groupId}`;

    const data = {
      name: name,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createNoteFolder', responseData);

      // folder created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // title conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Folder with the same name already exists',
        });

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
