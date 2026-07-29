/* global fetchMethod, groupId, token:writable, userWhiteboards:writable */

// --------------------------------------------------
//                 GLOBAL VARIABLES
// --------------------------------------------------

// Others
let userWhiteboard;
// Get stored token
token = localStorage.getItem('token');

// redirect to login if no token
if (token == null) {
  window.location.href = 'login.html';
}

let whiteboardID = localStorage.getItem('whiteboardID');
let saveTimeout;

// Canvas
const canvas = document.getElementById('drawing-board');
const ctx = canvas.getContext('2d');
const history = [];
const redoStack = [];

// Pixel
const pixelCanvas = document.getElementById('pixel-board');
const pixelCtx = pixelCanvas.getContext('2d');
const pixelSize = 20;
const pixels = {};
const pixelHistory = [];
const pixelRedo = [];

// Shared
let zoom = 1;
const zoomLabel = document.getElementById('zoomLevel');
let currentMode = 'whiteboard';
let isPainting = false;
let erasing = false;
let pixelPainting = false;
let startX;
let startY;
let snapshot;

const colorPicker = document.getElementById('stroke');
const sizeSlider = document.getElementById('lineWidth');
const opacitySlider = document.getElementById('opacity');
const shapeTool = document.getElementById('shapeTool');
const brushTool = document.getElementById('brushTool');
const eraserBtn = document.getElementById('eraser');

// --------------------------------------------------
//             SAVE / BACK FUNCTIONS
// --------------------------------------------------

// Save drawing to database
async function saveDrawing() {
  if (!whiteboardID) {
    console.error('No whiteboard ID found.');
    return false;
  }

  // Cancel any pending auto-save
  clearTimeout(saveTimeout);

  try {
    await saveWhiteboard();
    console.log('Whiteboard saved successfully.');
    return true;
  } catch (err) {
    console.error('Failed to save whiteboard:', err);
    return false;
  }
}

// SAVE BUTTON
document.getElementById('save').onclick = async () => {
  // First save to database
  const saved = await saveDrawing();

  if (!saved) {
    alert('Failed to save your whiteboard.');
    return;
  }

  // Then download PNG
  const link = document.createElement('a');
  link.download = 'drawing.png';

  if (currentMode === 'pixel') {
    link.href = pixelCanvas.toDataURL('image/png');
  } else {
    link.href = canvas.toDataURL('image/png');
  }

  link.click();
};

// BACK BUTTON
document.getElementById('back').onclick = async () => {
  // Save to database before leaving
  const saved = await saveDrawing();

  if (!saved) {
    const leaveAnyway = confirm('Your drawing could not be saved. Do you want to leave anyway?');

    if (!leaveAnyway) {
      return;
    }
  }

  // Change this to the page you want to return to
  window.location.href = 'home.html';
};

// --------------------------------------------------
//              WHITEBOARD FUNCTIONS
// --------------------------------------------------
document.getElementById('undo').addEventListener('click', () => {
  if (currentMode === 'whiteboard') {
    if (history.length <= 1) return;

    redoStack.push(history.pop());

    const img = new Image();

    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

    img.src = history[history.length - 1];
    scheduleSave();
  } else {
    undoPixel();
    scheduleSave();
  }
});

document.getElementById('redo').addEventListener('click', () => {
  if (currentMode === 'whiteboard') {
    // existing whiteboard redo
    if (redoStack.length === 0) return;

    const state = redoStack.pop();
    history.push(state);

    const img = new Image();

    img.onload = () => {
      ctx.globalCompositeOperation = 'source-over';
      ctx.globalAlpha = 1;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0);
    };

    img.src = state;
    scheduleSave();
  } else {
    redoPixel();
    scheduleSave();
  }
});

canvas.addEventListener('mousedown', (e) => {
  isPainting = true;

  const rect = canvas.getBoundingClientRect();

  startX = (e.clientX - rect.left) / zoom;
  startY = (e.clientY - rect.top) / zoom;

  snapshot = ctx.getImageData(0, 0, canvas.width, canvas.height);

  if (shapeTool.value === 'freehand') {
    ctx.beginPath();
    ctx.moveTo(startX, startY);
  }
});

canvas.addEventListener('mouseup', () => {
  if (!isPainting) return;

  isPainting = false;
  ctx.beginPath();

  saveState();
  scheduleSave();
});

canvas.addEventListener('mouseleave', () => {
  isPainting = false;
  ctx.beginPath();
});

canvas.addEventListener('mousemove', (e) => {
  if (!isPainting) return;

  const rect = canvas.getBoundingClientRect();

  const x = (e.clientX - rect.left) / zoom;
  const y = (e.clientY - rect.top) / zoom;

  ctx.lineWidth = Number(sizeSlider.value);
  ctx.lineCap = 'round';

  const opacity = Number(opacitySlider.value);

  switch (brushTool.value) {
    case 'pen':
      ctx.globalAlpha = opacity;
      break;

    case 'marker':
      ctx.globalAlpha = opacity * 0.35;
      break;

    case 'pencil':
      ctx.globalAlpha = opacity * 0.7;
      ctx.lineWidth *= 0.7;
      break;
  }

  if (erasing) {
    ctx.globalCompositeOperation = 'destination-out';
  } else {
    ctx.globalCompositeOperation = 'source-over';
    ctx.strokeStyle = colorPicker.value;
  }

  if (shapeTool.value === 'freehand') {
    ctx.lineTo(x, y);
    ctx.stroke();

    ctx.beginPath();
    ctx.moveTo(x, y);
  } else {
    ctx.putImageData(snapshot, 0, 0);

    ctx.beginPath();

    switch (shapeTool.value) {
      case 'line':
        ctx.moveTo(startX, startY);
        ctx.lineTo(x, y);
        break;

      case 'rectangle':
        ctx.rect(startX, startY, x - startX, y - startY);
        break;

      case 'circle':
        const radius = Math.sqrt((x - startX) ** 2 + (y - startY) ** 2);

        ctx.arc(startX, startY, radius, 0, Math.PI * 2);
        break;
    }

    ctx.stroke();
  }
});

// --------------------------------------------------
//              PIXEL ART FUNCTIONS
// --------------------------------------------------
function undoPixel() {
  if (pixelHistory.length <= 1) return;

  pixelRedo.push(pixelHistory.pop());

  loadPixelState(pixelHistory[pixelHistory.length - 1]);
}

function redoPixel() {
  if (pixelRedo.length === 0) return;

  const state = pixelRedo.pop();

  pixelHistory.push(state);

  loadPixelState(state);
}

pixelCanvas.addEventListener('mousedown', (e) => {
  pixelPainting = true;

  drawPixel(e);
});

pixelCanvas.addEventListener('mousemove', (e) => {
  if (!pixelPainting) return;

  drawPixel(e);
});

pixelCanvas.addEventListener('mouseup', () => {
  pixelPainting = false;

  savePixelState();
  scheduleSave();
});

pixelCanvas.addEventListener('mouseleave', () => {
  pixelPainting = false;
});

function savePixelState() {
  pixelHistory.push(JSON.stringify(pixels));

  if (pixelHistory.length > 50) pixelHistory.shift();

  pixelRedo.length = 0;
}

function loadPixelState(state) {
  // clear current pixels
  for (const key in pixels) delete pixels[key];

  // restore saved pixels
  Object.assign(pixels, JSON.parse(state));

  redrawPixels();
}

function drawGrid() {
  pixelCtx.clearRect(0, 0, pixelCanvas.width, pixelCanvas.height);

  pixelCtx.strokeStyle = '#ddd';

  for (let x = 0; x <= pixelCanvas.width; x += pixelSize) {
    pixelCtx.beginPath();
    pixelCtx.moveTo(x, 0);
    pixelCtx.lineTo(x, pixelCanvas.height);
    pixelCtx.stroke();
  }

  for (let y = 0; y <= pixelCanvas.height; y += pixelSize) {
    pixelCtx.beginPath();
    pixelCtx.moveTo(0, y);
    pixelCtx.lineTo(pixelCanvas.width, y);
    pixelCtx.stroke();
  }
}

function redrawPixels() {
  drawGrid();

  for (const key in pixels) {
    const [col, row] = key.split(',').map(Number);

    pixelCtx.fillStyle = pixels[key];

    pixelCtx.fillRect(col * pixelSize, row * pixelSize, pixelSize, pixelSize);
  }
}

function drawPixel(e) {
  const rect = pixelCanvas.getBoundingClientRect();

  const x = e.clientX - rect.left;
  const y = e.clientY - rect.top;

  const col = Math.floor(x / pixelSize);
  const row = Math.floor(y / pixelSize);

  const key = `${col},${row}`;

  if (erasing) {
    delete pixels[key];
  } else {
    pixels[key] = colorPicker.value;
  }

  redrawPixels();
}

// --------------------------------------------------
//             SHARED FUNCTIONS
// --------------------------------------------------
document.getElementById('clear').onclick = () => {
  if (canvas.style.display === 'block') {
    ctx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    saveState();
    scheduleSave();
  } else {
    for (const key in pixels) delete pixels[key];

    redrawPixels();

    savePixelState();
    scheduleSave();
  }
};

document.getElementById('save').onclick = () => {
  const link = document.createElement('a');

  link.download = 'drawing.png';

  if (pixelCanvas.style.display !== 'none') {
    // Pixel Art mode
    link.href = pixelCanvas.toDataURL('image/png');
  } else {
    // Whiteboard mode
    link.href = canvas.toDataURL('image/png');
  }

  link.click();
};

document.getElementById('fullscreen').onclick = () => {
  if (!document.fullscreenElement) document.documentElement.requestFullscreen();
  else document.exitFullscreen();
};

eraserBtn.onclick = () => {
  erasing = !erasing;

  if (erasing) {
    eraserBtn.textContent = 'Eraser: ON';
    eraserBtn.classList.add('active');
  } else {
    eraserBtn.textContent = 'Eraser: OFF';
    eraserBtn.classList.remove('active');
  }
};

function saveState() {
  history.push(canvas.toDataURL());

  // Limit history to 50 states
  if (history.length > 50) {
    history.shift();
  }

  // New drawing clears the redo history
  redoStack.length = 0;
}

// CTRL Z and CTRL Y
document.addEventListener('keydown', (e) => {
  if (e.ctrlKey && e.key === 'z') {
    e.preventDefault();
    document.getElementById('undo').click();
  }

  if (e.ctrlKey && e.key === 'y') {
    e.preventDefault();
    document.getElementById('redo').click();
  }
});

// NOT WORKING FOR PIXEL
document.getElementById('zoomIn').onclick = () => {
  zoom = Math.min(zoom + 0.1, 5);

  updateZoom();

  zoomLabel.textContent = Math.round(zoom * 100) + '%';
};

document.getElementById('zoomOut').onclick = () => {
  zoom = Math.max(zoom - 0.1, 0.2);

  updateZoom();

  zoomLabel.textContent = Math.round(zoom * 100) + '%';
};

function updateZoom() {
  canvas.style.transform = `scale(${zoom})`;
}

// --------------------------------------------------
//             EVENT LISTENERS
// --------------------------------------------------
document.getElementById('whiteboardBtn').onclick = () => {
  canvas.style.display = 'block';
  pixelCanvas.style.display = 'none';
  setMode('whiteboard');
};

document.getElementById('pixelBtn').onclick = () => {
  setMode('pixel');
  canvas.style.display = 'none';
  pixelCanvas.style.display = 'block';

  redrawPixels();
};

window.addEventListener('resize', resizeCanvas);

// --------------------------------------------------
//             OTHER FUNCTIONS
// --------------------------------------------------

function resizeCanvas() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;

  canvas.width = window.innerWidth;
  canvas.height = h;

  pixelCanvas.width = window.innerWidth;
  pixelCanvas.height = h;

  drawGrid();
}

function setMode(mode) {
  currentMode = mode;

  const whiteboardBtn = document.getElementById('whiteboardBtn');
  const pixelBtn = document.getElementById('pixelBtn');

  if (mode === 'whiteboard') {
    canvas.style.display = 'block';
    pixelCanvas.style.display = 'none';

    whiteboardBtn.classList.add('active-mode');
    pixelBtn.classList.remove('active-mode');
  } else {
    canvas.style.display = 'none';
    pixelCanvas.style.display = 'block';

    whiteboardBtn.classList.remove('active-mode');
    pixelBtn.classList.add('active-mode');

    redrawPixels();
  }
}

function loadWhiteboard(board) {
  if (board.mode === 'whiteboard') {
    setMode('whiteboard');
    loadCanvas(board.drawing_data);
  } else {
    setMode('pixel');
    loadPixelDrawing(board.drawing_data);
  }
}

// Updates whiteboard
async function saveWhiteboard() {
  const data = {
    id: whiteboardID,
    mode: currentMode,
    drawing_data: getCurrentDrawing(),
  };

  try {
    await updateWhiteboardDrawingData(data);
  } catch (err) {
    console.error(err);
  }
}

function getCurrentDrawing() {
  if (currentMode === 'whiteboard') {
    return {
      history,
    };
  }

  return {
    pixels,
  };
}

// Automatically saves whiteboard a second after user finishes drawing
function scheduleSave() {
  if (!whiteboardID) return;

  clearTimeout(saveTimeout);

  saveTimeout = setTimeout(saveWhiteboard, 1000);
}

// Load canvas
function loadCanvas(data) {
  if (!data.history || data.history.length === 0) return;

  const img = new Image();

  img.onload = () => {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0);

    history.length = 0;
    history.push(...data.history);
  };

  img.src = data.history[data.history.length - 1];
}

// Load pixel
function loadPixelDrawing(data) {
  for (const key in pixels) delete pixels[key];

  if (data.pixels) {
    Object.assign(pixels, data.pixels);
  }

  redrawPixels();
}

// --------------------------------------------------
//                  SETUP
// --------------------------------------------------

const whiteboardMode = localStorage.getItem('whiteboardMode');

async function init() {
  canvas.style.display = 'block';
  eraserBtn.textContent = 'Eraser: OFF';

  if (whiteboardMode === 'pixel') {
    // Initialise pixel whiteboard
    const whiteboardBtn = document.getElementById('whiteboardBtn');

    whiteboardBtn.disabled = true;
    whiteboardBtn.style.display = 'none';
    setMode('pixel');
  } else {
    // Initialise normal whiteboard
    setMode('whiteboard');
    const pixelBtn = document.getElementById('pixelBtn');

    pixelBtn.disabled = true;
    pixelBtn.style.display = 'none';
  }

  resizeCanvas();
  saveState();
  savePixelState();

  try {
    userWhiteboards = await fetchUserWhiteboards();
    console.log(userWhiteboards);

    if (whiteboardID) {
      userWhiteboard = await fetchWhiteboardByID(whiteboardID);

      loadWhiteboard(userWhiteboard);
    }
  } catch (err) {
    console.error(err);
  }
}

init();

// --------------------------------------------------
//              FETCH FUNCTIONS
// --------------------------------------------------

// Fetch whiteboard by user id
async function fetchUserWhiteboards() {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/user`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchUserWhiteboards', responseData);

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

// Fetch whiteboard by group id
async function fetchGroupWhiteboards() {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/group/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupWhiteboards', responseData);

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

// Fetch whiteboard by user and group id
async function fetchGroupAndUserWhiteboards() {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/user/${groupId}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchGroupAndUserWhiteboards', responseData);

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

// Fetch whiteboard by id
async function fetchWhiteboardByID(id) {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchWhiteboardByID', responseData);

      if (responseStatus == 200) {
        resolve(responseData[0]);

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

// --------------------------------------------------
//           CREATE/UPDATE/DELETE FUNCTIONS
// --------------------------------------------------

// Create whiteboard (empty)
// Request body: group_id (optional), title, mode
async function createWhiteboard(data) {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards`;

    const callback = (responseStatus, responseData) => {
      console.log('createWhiteboard', responseData);

      if (responseStatus == 201) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

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

// Update whiteboard drawing
// Data has drawing data and id
async function updateWhiteboardDrawingData(data) {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/${data.id}/drawing_data`;

    const callback = (responseStatus, responseData) => {
      console.log('updateWhiteboardDrawingData', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Whiteboard not found',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'You did not create the whiteboard',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Update whiteboard title data
// Data has title and id
async function updateWhiteboardTitle(data) {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/${data.id}/title`;

    const callback = (responseStatus, responseData) => {
      console.log('updateWhiteboardTitle', responseData);

      // message edited: success
      if (responseStatus == 200) {
        resolve(responseData);

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Whiteboard not found',
        });

        // User has no permissions
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'You did not create the whiteboard',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'PUT', data, token);
  });
}

// Delete whiteboard
async function deleteWhiteboard(id) {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/whiteboards/${id}`;

    const callback = (responseStatus, responseData) => {
      console.log('deleteWhiteboard', responseData);

      // message deleted: success
      if (responseStatus == 204) {
        resolve();

        // Token expired
      } else if (responseStatus == 401) {
        window.location.href = './home.html';

        // bad request: missing info
      } else if (responseStatus == 400) {
        reject({
          type: 'bad request',
          message: 'Missing required fields',
        });
      } else if (responseStatus == 404) {
        reject({
          type: 'not found',
          message: 'Whiteboard not found',
        });
      } else if (responseStatus == 403) {
        reject({
          type: 'forbidden',
          message: 'You did not create this whiteboard',
        });
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'DELETE', null, token);
  });
}
