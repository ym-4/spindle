/* global token, fetchMethod, userId, groupId */

// Token, userId and groupId is global in other js file
let groupFiles = [];
let currentFolder = 'none';
let folders = [];
let selectedFileId = null;

window.addEventListener('DOMContentLoaded', async () => {
  groupFiles = await fetchGroupFiles();
  folders = await fetchFolders();

  currentFolder = 'Unorganised';

  displayFolders();
  displayFiles();
  attachListeners();
});

// ---------------------------------------------------
// Display functions
// ---------------------------------------------------
function displayFiles() {
  const fileList = document.getElementById('fileList');
  //   const folder = folders.find((f) => f.name === currentFolder);
  //   document.getElementById('fileListHeader').innerHTML = `
  //     <div class="d-flex align-items-center w-100">

  //         <div class="d-flex align-items-center">
  //             <i class="bi ${
  //             currentFolder === 'Unorganised' ? 'bi-inbox-fill' : 'bi-folder-fill'
  //             } text-warning me-2 fs-5"></i>

  //             <span class="fw-semibold fs-5">${currentFolder}</span>
  //         </div>

  //         ${
  //         folder
  //             ? `
  //             <button
  //                 class="btn btn-sm btn-light text-danger ms-auto"
  //                 title="Delete Folder"
  //                 onclick="event.stopPropagation(); deleteFolder(${folder.id});">

  //                 <i class="bi bi-trash"></i>

  //             </button>
  //             `
  //             : ''
  //         }

  //     </div>
  //     `;

  fileList.innerHTML = '';

  const files = groupFiles.filter((file) => {
    if (currentFolder === 'Unorganised') {
      return !file.folder_name || file.folder_name === 'Unorganised';
    }

    return file.folder_name === currentFolder;
  });

  // no files in folder
  if (files.length === 0) {
    fileList.innerHTML = `
    <div class="text-center py-5 text-muted">
      <i class="bi bi-folder2-open display-4"></i>

      <h5 class="mt-3">No files yet</h5>

      <p class="mb-0">
        Upload a file or move one into this folder.
      </p>
    </div>
  `;
    return;
  }

  files.forEach((file) => {
    const icon = getFileIcon(file.name);

    fileList.innerHTML += `
  <div class="list-group-item d-flex justify-content-between align-items-center">

      <div
        role="button"
        onclick="fetchFile('${file.file_path}')"
      >
          <i class="bi ${icon} me-2"></i>
          ${file.name}
      </div>

      <div class="dropdown">

          <button
            class="btn btn-sm btn-light"
            data-bs-toggle="dropdown">

              <i class="bi bi-three-dots-vertical"></i>

          </button>

          <ul class="dropdown-menu dropdown-menu-end">

              <li>
                  <button
                    class="dropdown-item"
                    onclick="fetchFile('${file.file_path}')">

                    <i class="bi bi-download me-2"></i>

                    Download

                  </button>
              </li>

              <li>
                  <button
                    class="dropdown-item"
                    onclick="showMoveModal(${file.id})">

                    <i class="bi bi-folder-symlink me-2"></i>

                    Move to...

                  </button>
              </li>

              <li><hr class="dropdown-divider"></li>

              <li>
                  <button
                    class="dropdown-item text-danger"
                    onclick="deleteGroupFiles(${file.id})">

                    <i class="bi bi-trash me-2"></i>

                    Delete

                  </button>
              </li>

          </ul>

      </div>

  </div>
  `;
  });
}

function displayFolders() {
  const folderList = document.getElementById('folderList');

  folderList.innerHTML = '';

  // Virtual folder
  const unorganisedCount = groupFiles.filter(
    (file) => !file.folder_name || file.folder_name === 'Unorganised',
  ).length;

  folderList.innerHTML += `
    <div
      class="folder-item ${currentFolder === 'Unorganised' ? 'active' : ''}"
      onclick="changeFolder('Unorganised')"
    >
      <div class="folder-icon">
        <i class="bi bi-inbox-fill"></i>
      </div>

      <span>Unorganised</span>

      <small>${unorganisedCount}</small>
    </div>
  `;

  // Database folders
  folders.forEach((folder) => {
    const count = groupFiles.filter((file) => file.folder_name === folder.name).length;

    folderList.innerHTML += `
      <div
        class="folder-item ${folder.name === currentFolder ? 'active' : ''}"
        onclick="changeFolder('${folder.name}')"
      >
        <div class="folder-icon">
          <i class="bi bi-folder-fill"></i>
        </div>

        <span>${folder.name}</span>

        <small>${count}</small>
      </div>
    `;
  });
}

function showMoveModal(fileId) {
  selectedFileId = fileId;

  const select = document.getElementById('moveFolderSelect');

  select.innerHTML = '';

  select.innerHTML += `
        <option value="Unorganised">
            Unorganised
        </option>
    `;

  folders.forEach((folder) => {
    select.innerHTML += `
            <option value="${folder.name}">
                ${folder.name}
            </option>
        `;
  });

  const modal = new bootstrap.Modal(document.getElementById('moveFileModal'));

  modal.show();
}

// ---------------------------------------------------
// Add event listener functions
// ---------------------------------------------------
function attachListeners() {
  const fileInput = document.getElementById('fileInput');

  document.getElementById('uploadGroupFileBtn').addEventListener('click', () => fileInput.click());

  fileInput.addEventListener('change', handleFileSelected);

  const modal = new bootstrap.Modal(document.getElementById('newFolderModal'));

  document.getElementById('newFolderBtn').addEventListener('click', () => {
    document.getElementById('folderNameInput').value = '';
    modal.show();
  });

  document.getElementById('createFolderBtn').addEventListener('click', handleNewFolder);

  document.getElementById('moveFileBtn').addEventListener('click', handleMoveFile);
}

// ---------------------------------------------------
// Handler functions
// ---------------------------------------------------

async function handleFileSelected(e) {
  const file = e.target.files[0];

  if (!file) return;

  try {
    await createGroupFiles(file);

    displayToast('success', 'File uploaded successfully.');

    groupFiles = await fetchGroupFiles();

    displayFolders();
    displayFiles();

    e.target.value = '';
  } catch (err) {
    displayToast('error', err.message || 'Failed to upload file.');

    e.target.value = '';
  }
}

async function handleNewFolder() {
  const folderName = document.getElementById('folderNameInput').value.trim();

  if (!folderName) {
    displayToast('error', 'Please enter a folder name.');
    return;
  }

  try {
    await createFolder(folderName);

    folders = await fetchFolders();

    currentFolder = folderName;

    displayFolders();
    displayFiles();

    bootstrap.Modal.getInstance(document.getElementById('newFolderModal')).hide();

    displayToast('success', 'Folder created.');
  } catch (err) {
    displayToast('error', err.message);
  }
}

async function handleMoveFile() {
  const folder = document.getElementById('moveFolderSelect').value;

  try {
    await updateGroupFileFolder(selectedFileId, folder);

    groupFiles = await fetchGroupFiles();

    displayFolders();
    displayFiles();

    bootstrap.Modal.getInstance(document.getElementById('moveFileModal')).hide();

    displayToast('success', 'File moved.');
  } catch (err) {
    displayToast('error', err.message);
  }
}

// ---------------------------------------------------
// Other functions
// ---------------------------------------------------

function changeFolder(folder) {
  currentFolder = folder;

  displayFolders();
  displayFiles();
}

function getFileIcon(filename) {
  const extension = filename.split('.').pop().toLowerCase();

  switch (extension) {
    case 'pdf':
      return 'bi-file-earmark-pdf-fill text-danger';

    case 'doc':
    case 'docx':
      return 'bi-file-earmark-word-fill text-primary';

    case 'xls':
    case 'xlsx':
      return 'bi-file-earmark-excel-fill text-success';

    case 'ppt':
    case 'pptx':
      return 'bi-file-earmark-ppt-fill text-warning';

    case 'zip':
    case 'rar':
      return 'bi-file-earmark-zip-fill text-secondary';

    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'gif':
    case 'webp':
      return 'bi-file-earmark-image-fill text-success';

    case 'txt':
      return 'bi-file-earmark-text-fill text-secondary';

    default:
      return 'bi-file-earmark-fill';
  }
}

// ---------------------------------------------------
// Calling Backend functions
// ---------------------------------------------------
async function fetchGroupFiles() {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/groupFiles/files/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupFiles', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback);
  });
}

async function fetchFile(file_path) {
  const fileUrl = `${getCurrentUrl}/uploads/group_files/${file_path}`;
  window.open(fileUrl, '_blank');
}

async function createGroupFiles(file) {
  const url = `${getCurrentUrl}/groupFiles/files/${groupId}`;

  const folderName = 'Unorganised';

  const formData = new FormData();

  formData.append('file', file);
  formData.append('folder_name', folderName);

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
      },
      body: formData,
    });

    const responseData = await response.json();

    console.log('createGroupFiles', responseData);

    if (response.status === 201) {
      return responseData;
    }

    if (response.status === 401) {
      window.location.href = './home.html';
      return;
    }

    if (response.status === 400) {
      throw {
        type: 'bad request',
        message: 'Missing required fields',
      };
    }

    if (response.status === 403) {
      throw {
        type: 'forbidden',
        message: 'User is not a group member',
      };
    }

    throw responseData;
  } catch (err) {
    console.error(err);
    throw err;
  }
}

async function updateGroupFileFolder(fileId, folderName) {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/groupFiles/files/${fileId}`;

    const data = {
      folder_name: folderName,
    };

    const callback = (status, response) => {
      if (status === 200) {
        resolve(response);
      } else {
        reject(response);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

async function deleteGroupFiles(fileId) {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/groupFiles/files/${fileId}`;

    const callback = async (status, response) => {
      if (status === 204) {
        // Refresh files
        groupFiles = await fetchGroupFiles();

        displayFolders();
        displayFiles();

        displayToast('success', 'File deleted.');

        resolve();
      } else {
        reject(response);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}

async function fetchFolders() {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/groupFiles/folders/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchFolders', responseData);

      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback);
  });
}

async function createFolder(folderName) {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/groupFiles/folders/${groupId}`;

    const data = {
      group_id: groupId,
      name: folderName,
    };

    const callback = (responseStatus, responseData) => {
      console.log('createFolder', responseData);

      // channel created: success
      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // name conflict
      } else if (responseStatus == 409) {
        reject({
          type: 'conflict',
          message: 'Group channel already exists',
        });

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'User is not an admin',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'POST', data, token);
  });
}

async function deleteFolder(folderId) {
  if (!confirm('Delete this folder?\nFiles inside will be moved to Unorganised.')) {
    return;
  }

  try {
    await deleteFolderRequest(folderId);

    currentFolder = 'Unorganised';

    folders = await fetchFolders();
    groupFiles = await fetchGroupFiles();

    displayFolders();
    displayFiles();

    displayToast('success', 'Folder deleted.');
  } catch (err) {
    displayToast('error', err.message || 'Failed to delete folder.');
  }
}

async function deleteFolderRequest(folderId) {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/groupFiles/folders/${folderId}`;

    const callback = (status, response) => {
      if (status === 204) {
        resolve();
      } else {
        reject(response);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}
