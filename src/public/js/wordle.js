const WORD_LENGTH = 5;
const MAX_GUESSES = 6;

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['ENTER', 'Z', 'X', 'C', 'V', 'B', 'N', 'M', 'DEL'],
];

const boardEl = document.getElementById('wordle-board');
const keyboardEl = document.getElementById('wordle-keyboard');
const messageEl = document.getElementById('wordle-message');

const resultModalEl = document.getElementById('resultModal');
const resultModal = new bootstrap.Modal(resultModalEl);
const resultIcon = document.getElementById('resultIcon');
const resultTitle = document.getElementById('resultTitle');
const resultBody = document.getElementById('resultBody');

let currentRow = 0;
let currentGuess = '';
let gameOver = false;
let isSubmitting = false;
let keyStatus = {}; // letter -> 'correct' | 'present' | 'absent'

init();

async function init() {
  buildBoard();
  buildKeyboard();
  attachPhysicalKeyboard();

  const state = await getJSON('/wordle/state');

  if (!state.active) {
    await postJSON('/wordle/new');
    return;
  }

  // Replay any guesses already made this session (e.g. after a refresh)
  state.guesses.forEach(({ guess, result }) => {
    placeRowInstant(currentRow, guess, result);
    applyKeyColors(guess, result);
    currentRow++;
  });

  if (state.gameOver) {
    finishGame(state.won, state.answer);
  }
}

function buildBoard() {
  boardEl.innerHTML = '';
  for (let r = 0; r < MAX_GUESSES; r++) {
    const row = document.createElement('div');
    row.className = 'wordle-row';
    row.id = `row-${r}`;
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.createElement('div');
      tile.className = 'wordle-tile';
      tile.id = `tile-${r}-${c}`;
      row.appendChild(tile);
    }
    boardEl.appendChild(row);
  }
}

function buildKeyboard() {
  keyboardEl.innerHTML = '';
  KEYBOARD_ROWS.forEach((rowKeys) => {
    const row = document.createElement('div');
    row.className = 'keyboard-row';
    rowKeys.forEach((key) => {
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'key';
      btn.id = `key-${key}`;
      btn.textContent = key === 'DEL' ? '⌫' : key;
      if (key === 'ENTER' || key === 'DEL') btn.classList.add('key-wide');
      btn.addEventListener('click', () => handleKey(key));
      row.appendChild(btn);
    });
    keyboardEl.appendChild(row);
  });
}

function attachPhysicalKeyboard() {
  document.addEventListener('keydown', (e) => {
    if (gameOver || isSubmitting) return;
    const key = e.key.toUpperCase();
    if (key === 'ENTER') handleKey('ENTER');
    else if (key === 'BACKSPACE') handleKey('DEL');
    else if (/^[A-Z]$/.test(key)) handleKey(key);
  });
}

function handleKey(key) {
  if (gameOver || isSubmitting) return;

  if (key === 'ENTER') {
    submitGuess();
  } else if (key === 'DEL') {
    if (currentGuess.length > 0) {
      currentGuess = currentGuess.slice(0, -1);
      renderCurrentRow();
    }
  } else if (currentGuess.length < WORD_LENGTH) {
    currentGuess += key;
    renderCurrentRow();
  }
}

function renderCurrentRow() {
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.getElementById(`tile-${currentRow}-${c}`);
    const letter = currentGuess[c] || '';
    tile.textContent = letter;
    tile.classList.toggle('filled', !!letter);
  }
}

async function submitGuess() {
  if (currentGuess.length !== WORD_LENGTH) {
    showMessage(`Guess must be ${WORD_LENGTH} letters.`);
    shakeRow(currentRow);
    return;
  }

  isSubmitting = true;
  showMessage('');

  try {
    const res = await fetch('/wordle/guess', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ guess: currentGuess }),
    });
    const data = await res.json();

    if (!res.ok) {
      showMessage(data.error || 'Something went wrong.');
      shakeRow(currentRow);
      isSubmitting = false;
      return;
    }

    await animateRow(currentRow, currentGuess, data.result);
    applyKeyColors(currentGuess, data.result);

    if (data.gameOver) {
      gameOver = true;
      finishGame(data.won, data.answer);
    } else {
      currentRow++;
      currentGuess = '';
    }
  } catch {
    showMessage('Network error — try again.');
  } finally {
    isSubmitting = false;
  }
}

function animateRow(row, guess, result) {
  return new Promise((resolve) => {
    for (let c = 0; c < WORD_LENGTH; c++) {
      const tile = document.getElementById(`tile-${row}-${c}`);
      setTimeout(() => {
        tile.classList.add('flip');
        setTimeout(() => {
          tile.textContent = guess[c];
          tile.classList.add(colorClass(result[c]));
        }, 275); // halfway through the flip, swap the face
      }, c * 250);
    }
    setTimeout(resolve, WORD_LENGTH * 250 + 300);
  });
}

function placeRowInstant(row, guess, result) {
  for (let c = 0; c < WORD_LENGTH; c++) {
    const tile = document.getElementById(`tile-${row}-${c}`);
    tile.textContent = guess[c];
    tile.classList.add('filled', colorClass(result[c]));
  }
  applyKeyColors(guess, result);
}

function colorClass(cell) {
  if (cell === 'G') return 'correct';
  if (cell === 'Y') return 'present';
  return 'absent';
}

function applyKeyColors(guess, result) {
  const priority = { absent: 0, present: 1, correct: 2 };
  for (let c = 0; c < WORD_LENGTH; c++) {
    const letter = guess[c];
    const status = colorClass(result[c]);
    const existing = keyStatus[letter];
    if (!existing || priority[status] > priority[existing]) {
      keyStatus[letter] = status;
      const keyEl = document.getElementById(`key-${letter}`);
      if (keyEl) {
        keyEl.classList.remove('correct', 'present', 'absent');
        keyEl.classList.add(status);
      }
    }
  }
}

function shakeRow(row) {
  const rowEl = document.getElementById(`row-${row}`);
  rowEl.style.animation = 'none';
  // Force reflow so the animation can restart
  void rowEl.offsetWidth;
  rowEl.style.animation = null;
}

function showMessage(msg) {
  messageEl.textContent = msg;
}

function finishGame(won, answer) {
  gameOver = true;
  showMessage('');

  resultIcon.textContent = won ? '🏆' : '🧵';
  resultTitle.textContent = won ? 'Solved it!' : 'Out of guesses';
  resultBody.textContent = won
    ? 'Nice work — come back in 7 days for another word and a fresh shot at the discount code.'
    : `The word was ${answer}. Come back in 7 days to try again.`;

  resultModal.show();
}

async function getJSON(url) {
  const res = await fetch(url);
  return res.json();
}

async function postJSON(url, body) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
