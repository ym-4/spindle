const canvas = document.getElementById('drawing-board');

const pixelCanvas = document.getElementById('pixel-board');
const pixelCtx = pixelCanvas.getContext('2d');
const pixelSize = 20;

const pixels = {};
const pixelHistory = [];
const pixelRedo = [];

const ctx = canvas.getContext('2d');
const history = [];
const redoStack = [];
let zoom = 1;
const zoomLabel = document.getElementById('zoomLevel');
let currentMode = 'whiteboard';

canvas.style.display = 'block';

function resizeCanvas() {
  const h = window.innerHeight - document.getElementById('toolbar').offsetHeight;

  canvas.width = window.innerWidth;
  canvas.height = h;

  pixelCanvas.width = window.innerWidth;
  pixelCanvas.height = h;

  drawGrid();
}

resizeCanvas();
saveState();
window.addEventListener('resize', resizeCanvas);
savePixelState();

let isPainting = false;
let erasing = false;

const colorPicker = document.getElementById('stroke');
const sizeSlider = document.getElementById('lineWidth');
const opacitySlider = document.getElementById('opacity');
const shapeTool = document.getElementById('shapeTool');
const brushTool = document.getElementById('brushTool');

const eraserBtn = document.getElementById('eraser');

let startX;
let startY;

let snapshot;

eraserBtn.textContent = 'Eraser: OFF';

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

  saveState(); // save completed stroke
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

document.getElementById('clear').onclick = () => {
  if (canvas.style.display === 'block') {
    ctx.globalCompositeOperation = 'source-over';

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    saveState();
  } else {
    for (const key in pixels) delete pixels[key];

    redrawPixels();

    savePixelState();
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

document.getElementById('undo').addEventListener('click', () => {
  if (canvas.style.display === 'block') {
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
    console.log('here2');
  } else {
    undoPixel();
    console.log('here');
  }
});

document.getElementById('redo').addEventListener('click', () => {
  if (canvas.style.display === 'block') {
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
  } else {
    redoPixel();
  }
});

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

function saveState() {
  history.push(canvas.toDataURL());

  // Limit history to 50 states
  if (history.length > 50) {
    history.shift();
  }

  // New drawing clears the redo history
  redoStack.length = 0;
}

function updateZoom() {
  canvas.style.transform = `scale(${zoom})`;
}

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

// PIXEL
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

let pixelPainting = false;

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
});

pixelCanvas.addEventListener('mouseleave', () => {
  pixelPainting = false;
});

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

document.getElementById('whiteboardBtn').onclick = () => {
  canvas.style.display = 'block';
  pixelCanvas.style.display = 'none';
};

document.getElementById('pixelBtn').onclick = () => {
  canvas.style.display = 'none';
  pixelCanvas.style.display = 'block';

  redrawPixels();
};

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

document.getElementById('whiteboardBtn').onclick = () => {
  setMode('whiteboard');
};

document.getElementById('pixelBtn').onclick = () => {
  setMode('pixel');
};

setMode('whiteboard');
