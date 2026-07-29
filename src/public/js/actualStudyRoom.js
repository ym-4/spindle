/* global fetchMethod, currentUrl, displayToast */

const locationPath = 'images/study-room-sprites/';

let token = null;
let currentCharacter = null;
let selectedParts = {};

/* =================================
TIMER SETTINGS
================================= */

const DEFAULT_SESSION_MINUTES = 25;

let timerInterval = null;

let remainingSeconds = DEFAULT_SESSION_MINUTES * 60;

let currentSessionMinutes = DEFAULT_SESSION_MINUTES;

let isTimerRunning = false;

/* =================================
STUDY GOALS
================================= */

let studyGoals = {
  minutes: 60,
  sessions: 3,
};

let studyProgress = {
  minutes: 0,
  sessions: 0,
};

/* =================================
START
================================= */

window.addEventListener('DOMContentLoaded', async () => {
  loadStudyData();

  setupStudyControls();

  updateGoalDisplay();

  updateTimerDisplay();

  updateCurrentSessionDisplay();

  try {
    token = localStorage.getItem('token');

    if (!token) {
      window.location.href = './home.html';
      return;
    }

    await loadSavedCharacter();

    renderCharacter();
  } catch (error) {
    console.error('Failed to load character in Study Room:', error);

    if (typeof displayToast === 'function') {
      displayToast('error', 'Failed to load your character.');
    }
  }
});

/* =================================
SETUP STUDY CONTROLS
================================= */

function setupStudyControls() {
  const startButton = document.getElementById('start-timer-btn');

  const pauseButton = document.getElementById('pause-timer-btn');

  const resetButton = document.getElementById('reset-timer-btn');

  const saveGoalsButton = document.getElementById('save-goals-btn');

  const confirmTimerButton = document.getElementById('confirm-start-timer-btn');

  /*
  IMPORTANT:

  Do NOT add a click event to startButton here.

  The button already has:

  data-bs-toggle="modal"
  data-bs-target="#timerModal"

  Bootstrap will open the popup automatically.
  */

  if (pauseButton) {
    pauseButton.addEventListener('click', pauseTimer);
  }

  if (resetButton) {
    resetButton.addEventListener('click', resetTimer);
  }

  if (saveGoalsButton) {
    saveGoalsButton.addEventListener('click', saveGoalsFromModal);
  }

  if (confirmTimerButton) {
    confirmTimerButton.addEventListener('click', startTimerFromModal);
  }

  /*
  GOAL MINUTE PRESETS
  */

  document.querySelectorAll('[data-minutes]').forEach((button) => {
    button.addEventListener('click', () => {
      const minutes = Number(button.dataset.minutes);

      const input = document.getElementById('goal-minutes-input');

      if (input) {
        input.value = minutes;
      }

      document.querySelectorAll('[data-minutes]').forEach((btn) => btn.classList.remove('active'));

      button.classList.add('active');
    });
  });

  /*
  GOAL SESSION PRESETS
  */

  document.querySelectorAll('[data-sessions]').forEach((button) => {
    button.addEventListener('click', () => {
      const sessions = Number(button.dataset.sessions);

      const input = document.getElementById('goal-sessions-input');

      if (input) {
        input.value = sessions;
      }

      document.querySelectorAll('[data-sessions]').forEach((btn) => btn.classList.remove('active'));

      button.classList.add('active');
    });
  });

  /*
  TIMER PRESETS
  */

  document.querySelectorAll('[data-duration]').forEach((button) => {
    button.addEventListener('click', () => {
      const duration = Number(button.dataset.duration);

      const input = document.getElementById('custom-timer-input');

      if (input) {
        input.value = '';
      }

      document.querySelectorAll('[data-duration]').forEach((btn) => btn.classList.remove('active'));

      button.classList.add('active');

      // Store selected duration on the modal button
      document
        .getElementById('confirm-start-timer-btn')
        ?.setAttribute('data-selected-duration', duration);
    });
  });

  /*
  CUSTOM TIMER INPUT

  When the user types a custom value,
  remove the active preset.
  */

  const customTimerInput = document.getElementById('custom-timer-input');

  if (customTimerInput) {
    customTimerInput.addEventListener('input', () => {
      document.querySelectorAll('[data-duration]').forEach((btn) => btn.classList.remove('active'));

      document.getElementById('confirm-start-timer-btn')?.removeAttribute('data-selected-duration');
    });
  }

  setupQuickActions();
}

/* =================================
START TIMER FROM MODAL
================================= */

function startTimerFromModal() {
  const confirmButton = document.getElementById('confirm-start-timer-btn');

  const customInput = document.getElementById('custom-timer-input');

  let selectedDuration = null;

  /*
  Check if a preset was selected
  */

  if (confirmButton) {
    selectedDuration = Number(confirmButton.getAttribute('data-selected-duration'));
  }

  /*
  If no preset was selected,
  check custom input.
  */

  if (!selectedDuration && customInput && customInput.value) {
    selectedDuration = Number(customInput.value);
  }

  /*
  Default to 25 minutes
  */

  if (!selectedDuration) {
    selectedDuration = DEFAULT_SESSION_MINUTES;
  }

  /*
  Validate duration
  */

  if (!Number.isFinite(selectedDuration) || selectedDuration < 1 || selectedDuration > 180) {
    alert('Please choose a study duration between 1 and 180 minutes.');

    return;
  }

  /*
  Set current session
  */

  currentSessionMinutes = Math.round(selectedDuration);

  remainingSeconds = currentSessionMinutes * 60;

  /*
  Update display
  */

  updateTimerDisplay();

  updateCurrentSessionDisplay();

  /*
  Close modal
  */

  const timerModalElement = document.getElementById('timerModal');

  const timerModal = bootstrap.Modal.getInstance(timerModalElement);

  if (timerModal) {
    timerModal.hide();
  }

  /*
  Start timer
  */

  startTimer();
}

/* =================================
TIMER
================================= */

function startTimer() {
  if (isTimerRunning) {
    return;
  }

  isTimerRunning = true;

  const startButton = document.getElementById('start-timer-btn');

  const pauseButton = document.getElementById('pause-timer-btn');

  const timerMode = document.getElementById('timer-mode');

  const characterStatus = document.getElementById('character-status-text');

  if (startButton) {
    startButton.disabled = true;

    startButton.innerHTML = `
      <i class="fas fa-hourglass-half"></i>
      Studying...
    `;
  }

  if (pauseButton) {
    pauseButton.disabled = false;
  }

  if (timerMode) {
    timerMode.textContent = 'Focus Time';
  }

  if (characterStatus) {
    characterStatus.textContent = 'Studying... 📚';
  }

  timerInterval = setInterval(tickTimer, 1000);
}

/* =================================
TIMER TICK
================================= */

function tickTimer() {
  if (remainingSeconds <= 0) {
    completeStudySession();

    return;
  }

  remainingSeconds--;

  updateTimerDisplay();
}

/* =================================
PAUSE TIMER
================================= */

function pauseTimer() {
  if (!isTimerRunning) {
    return;
  }

  clearInterval(timerInterval);

  timerInterval = null;

  isTimerRunning = false;

  const startButton = document.getElementById('start-timer-btn');

  const pauseButton = document.getElementById('pause-timer-btn');

  const timerMode = document.getElementById('timer-mode');

  const characterStatus = document.getElementById('character-status-text');

  if (startButton) {
    startButton.disabled = false;

    startButton.innerHTML = `
      <i class="fas fa-play"></i>
      Resume Studying
    `;
  }

  if (pauseButton) {
    pauseButton.disabled = true;
  }

  if (timerMode) {
    timerMode.textContent = 'Paused';
  }

  if (characterStatus) {
    characterStatus.textContent = 'Taking a short pause... ☕';
  }
}

/* =================================
RESET TIMER
================================= */

function resetTimer() {
  clearInterval(timerInterval);

  timerInterval = null;

  isTimerRunning = false;

  currentSessionMinutes = DEFAULT_SESSION_MINUTES;

  remainingSeconds = DEFAULT_SESSION_MINUTES * 60;

  const startButton = document.getElementById('start-timer-btn');

  const pauseButton = document.getElementById('pause-timer-btn');

  const timerMode = document.getElementById('timer-mode');

  const characterStatus = document.getElementById('character-status-text');

  if (startButton) {
    startButton.disabled = false;

    startButton.innerHTML = `
      <i class="fas fa-play"></i>
      Start Studying
    `;
  }

  if (pauseButton) {
    pauseButton.disabled = true;
  }

  if (timerMode) {
    timerMode.textContent = 'Ready';
  }

  if (characterStatus) {
    characterStatus.textContent = 'Ready to study';
  }

  updateTimerDisplay();

  updateCurrentSessionDisplay();
}

/* =================================
SESSION COMPLETE
================================= */

function completeStudySession() {
  clearInterval(timerInterval);

  timerInterval = null;

  isTimerRunning = false;

  /*
  Save the completed session duration BEFORE
  resetting the timer back to the default.

  Example:

  25 minute session
  = +25 minutes

  45 minute session
  = +45 minutes
  */

  const completedMinutes = currentSessionMinutes;

  studyProgress.sessions++;

  studyProgress.minutes += completedMinutes;

  saveStudyData();

  updateGoalDisplay();

  /*
  Reset timer for next session
  */

  remainingSeconds = DEFAULT_SESSION_MINUTES * 60;

  currentSessionMinutes = DEFAULT_SESSION_MINUTES;

  updateTimerDisplay();

  updateCurrentSessionDisplay();

  const startButton = document.getElementById('start-timer-btn');

  const pauseButton = document.getElementById('pause-timer-btn');

  const timerMode = document.getElementById('timer-mode');

  const characterStatus = document.getElementById('character-status-text');

  if (startButton) {
    startButton.disabled = false;

    startButton.innerHTML = `
      <i class="fas fa-play"></i>
      Start Studying
    `;
  }

  if (pauseButton) {
    pauseButton.disabled = true;
  }

  if (timerMode) {
    timerMode.textContent = 'Session Complete!';
  }

  if (characterStatus) {
    characterStatus.textContent = 'Great job! Session complete 🎉';
  }

  if (typeof displayToast === 'function') {
    displayToast(
      'success',
      `Study session completed! You studied for ${completedMinutes} minutes.`,
    );
  }
}

/* =================================
UPDATE TIMER DISPLAY
================================= */

function updateTimerDisplay() {
  const timer = document.getElementById('timer-time');

  if (!timer) {
    return;
  }

  const minutes = Math.floor(remainingSeconds / 60);

  const seconds = remainingSeconds % 60;

  timer.textContent =
    `${String(minutes).padStart(2, '0')}:` + `${String(seconds).padStart(2, '0')}`;
}

/* =================================
UPDATE CURRENT SESSION DISPLAY
================================= */

function updateCurrentSessionDisplay() {
  const currentSession = document.getElementById('current-session');

  if (currentSession) {
    currentSession.textContent = `${currentSessionMinutes} min`;
  }
}

/* =================================
SAVE GOALS FROM MODAL
================================= */

function saveGoalsFromModal() {
  const minutesInput = document.getElementById('goal-minutes-input');

  const sessionsInput = document.getElementById('goal-sessions-input');

  if (!minutesInput || !sessionsInput) {
    return;
  }

  const minutes = Number(minutesInput.value);

  const sessions = Number(sessionsInput.value);

  /*
  Validate values
  */

  if (!Number.isFinite(minutes) || minutes <= 0 || !Number.isFinite(sessions) || sessions <= 0) {
    alert('Please enter valid numbers greater than 0.');

    return;
  }

  /*
  Save values
  */

  studyGoals.minutes = Math.round(minutes);

  studyGoals.sessions = Math.round(sessions);

  saveStudyData();

  updateGoalDisplay();

  /*
  Close modal
  */

  const goalsModalElement = document.getElementById('goalsModal');

  const goalsModal = bootstrap.Modal.getInstance(goalsModalElement);

  if (goalsModal) {
    goalsModal.hide();
  }

  /*
  Show success message
  */

  if (typeof displayToast === 'function') {
    displayToast('success', 'Your study goals have been updated!');
  }
}

/* =================================
UPDATE GOALS
================================= */

function updateGoalDisplay() {
  const minutesText = document.getElementById('minutes-progress-text');

  const minutesProgress = document.getElementById('minutes-progress');

  const sessionsText = document.getElementById('sessions-progress-text');

  const sessionsProgress = document.getElementById('sessions-progress');

  /*
  MINUTES
  */

  if (minutesText) {
    minutesText.textContent = `${studyProgress.minutes} / ${studyGoals.minutes} min`;
  }

  if (minutesProgress) {
    const percentage = Math.min((studyProgress.minutes / studyGoals.minutes) * 100, 100);

    minutesProgress.style.width = `${percentage}%`;
  }

  /*
  SESSIONS
  */

  if (sessionsText) {
    sessionsText.textContent = `${studyProgress.sessions} / ${studyGoals.sessions}`;
  }

  if (sessionsProgress) {
    const percentage = Math.min((studyProgress.sessions / studyGoals.sessions) * 100, 100);

    sessionsProgress.style.width = `${percentage}%`;
  }

  /*
  COMPLETED TODAY
  */

  const completedToday = document.getElementById('completed-today');

  if (completedToday) {
    completedToday.textContent = `${studyProgress.sessions} sessions`;
  }
}

/* =================================
SAVE STUDY DATA
================================= */

function saveStudyData() {
  localStorage.setItem('studyGoals', JSON.stringify(studyGoals));

  localStorage.setItem('studyProgress', JSON.stringify(studyProgress));
}

/* =================================
LOAD STUDY DATA
================================= */

function loadStudyData() {
  const savedGoals = localStorage.getItem('studyGoals');

  const savedProgress = localStorage.getItem('studyProgress');

  if (savedGoals) {
    try {
      studyGoals = JSON.parse(savedGoals);
    } catch (error) {
      console.error('Could not load study goals:', error);
    }
  }

  if (savedProgress) {
    try {
      studyProgress = JSON.parse(savedProgress);
    } catch (error) {
      console.error('Could not load study progress:', error);
    }
  }
}

/* =================================
CHARACTER
================================= */

async function loadSavedCharacter() {
  const characters = await fetchAvailableCharacters();

  const userCharacter = await fetchUserCharacter();

  if (!userCharacter) {
    console.error('No saved character found.');

    currentCharacter = characters[0];

    if (currentCharacter) {
      selectedParts = getDefaultParts(currentCharacter);
    }

    return;
  }

  currentCharacter = characters.find((character) => character.id === userCharacter.character_id);

  if (!currentCharacter) {
    console.error('Could not find character with ID:', userCharacter.character_id);

    return;
  }

  selectedParts = getDefaultParts(currentCharacter);

  const userCharacterParts = await fetchUserCharacterParts();

  userCharacterParts.forEach((row) => {
    if (!row.part) {
      return;
    }

    const availableOptions = currentCharacter.parts[row.part];

    if (!availableOptions) {
      console.warn(`Ignoring unsupported part: ${row.part}`);

      return;
    }

    if (row.option !== null && !availableOptions.includes(row.option)) {
      console.warn(`Ignoring unsupported option: ${row.part} = ${row.option}`);

      return;
    }

    selectedParts[row.part] = row.option;
  });

  console.log('Loaded character:', currentCharacter);

  console.log('Loaded character parts:', selectedParts);
}

/* =================================
RENDER CHARACTER
================================= */

function renderCharacter() {
  const container = document.getElementById('actual-character-container');

  if (!container) {
    console.error('Character container not found.');

    return;
  }

  if (!currentCharacter) {
    console.error('No current character.');

    return;
  }

  container.innerHTML = '';

  Object.entries(selectedParts).forEach(([part, option]) => {
    if (!option) {
      return;
    }

    const img = document.createElement('img');

    img.classList.add('character-layer');

    img.id = `actual-${part}`;

    img.src = `${locationPath}${currentCharacter.character_key}/${part}_${option}.png`;

    img.alt = `${formatPartName(part)} ${option}`;

    img.onerror = () => {
      console.error('Could not load character image:', img.src);

      img.style.display = 'none';
    };

    container.appendChild(img);
  });

  console.log('Character rendered successfully.');
}

/* =================================
DEFAULT PARTS
================================= */

function getDefaultParts(character) {
  const defaultParts = {};

  Object.entries(character.parts).forEach(([part, options]) => {
    if (options.includes('default')) {
      defaultParts[part] = 'default';
    } else {
      defaultParts[part] = null;
    }
  });

  return defaultParts;
}

/* =================================
FORMAT PART NAME
================================= */

function formatPartName(part) {
  const names = {
    eye: 'Eyes',

    face: 'Face',

    mouth: 'Mouth',

    hat: 'Hat',

    arm: 'Arms',

    hand: 'Hands',

    leg: 'Legs',

    accessories: 'Accessories',

    blush: 'Blush',

    effect: 'Effect',

    body: 'Body',
  };

  return names[part] || part.charAt(0).toUpperCase() + part.slice(1);
}

/* =================================
API: CHARACTERS
================================= */

function fetchAvailableCharacters() {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/study-room/characters`;

    fetchMethod(
      url,

      (responseStatus, responseData) => {
        console.log('fetchAvailableCharacters:', responseStatus, responseData);

        if (responseStatus === 200) {
          resolve(responseData);
        } else if (responseStatus === 401) {
          window.location.href = './home.html';
        } else {
          reject(responseData);
        }
      },

      'GET',

      null,

      token,
    );
  });
}

/* =================================
API: USER CHARACTER
================================= */

function fetchUserCharacter() {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/study-room/my-character`;

    fetchMethod(
      url,

      (responseStatus, responseData) => {
        console.log('fetchUserCharacter:', responseStatus, responseData);

        if (responseStatus === 200) {
          resolve(responseData);
        } else if (responseStatus === 401) {
          window.location.href = './home.html';
        } else if (responseStatus === 404) {
          resolve(null);
        } else {
          reject(responseData);
        }
      },

      'GET',

      null,

      token,
    );
  });
}

/* =================================
API: CHARACTER PARTS
================================= */

function fetchUserCharacterParts() {
  return new Promise((resolve, reject) => {
    const url = `${currentUrl}/study-room/my-character/parts`;

    fetchMethod(
      url,

      (responseStatus, responseData) => {
        console.log('fetchUserCharacterParts:', responseStatus, responseData);

        if (responseStatus === 200) {
          resolve(responseData);
        } else if (responseStatus === 401) {
          window.location.href = './home.html';
        } else {
          reject(responseData);
        }
      },

      'GET',

      null,

      token,
    );
  });
}

/* =================================
QUICK ACTION BUTTONS
================================= */

const focusTips = [
  {
    title: 'One thing at a time',
    text: 'Try focusing on just one task until your timer ends. You can always move on to something else afterwards.',
  },
  {
    title: 'Put your phone away',
    text: 'Keep your phone out of reach or turn on Do Not Disturb to reduce distractions.',
  },
  {
    title: 'Take small breaks',
    text: 'Short breaks can help you recharge and return to your work with better focus.',
  },
  {
    title: 'Set a tiny goal',
    text: 'Instead of thinking about everything you need to finish, choose one small task to complete first.',
  },
  {
    title: 'Stay hydrated',
    text: 'Keep some water nearby while studying. Looking after yourself helps you stay focused.',
  },
];

let currentFocusTip = 0;

/* =================================
SETUP QUICK ACTIONS
================================= */

function setupQuickActions() {
  const notesButton = document.getElementById('notes-btn');

  const breakButton = document.getElementById('break-btn');

  const focusTipsButton = document.getElementById('focus-tips-btn');

  const saveNotesButton = document.getElementById('save-notes-btn');

  const nextTipButton = document.getElementById('next-focus-tip-btn');

  /*
  NOTES
  */

  if (notesButton) {
    notesButton.addEventListener('click', openNotesModal);
  }

  /*
  BREAK
  */

  if (breakButton) {
    breakButton.addEventListener('click', openBreakModal);
  }

  /*
  FOCUS TIPS
  */

  if (focusTipsButton) {
    focusTipsButton.addEventListener('click', openFocusTipsModal);
  }

  /*
  SAVE NOTES
  */

  if (saveNotesButton) {
    saveNotesButton.addEventListener('click', saveStudyNotes);
  }

  /*
  NEXT TIP
  */

  if (nextTipButton) {
    nextTipButton.addEventListener('click', showNextFocusTip);
  }

  setupBreakControls();
}

/* =================================
NOTES
================================= */

function openNotesModal() {
  const savedNotes = localStorage.getItem('studyNotes');

  const notesInput = document.getElementById('study-notes-input');

  if (notesInput && savedNotes) {
    notesInput.value = savedNotes;
  }

  const modalElement = document.getElementById('notesModal');

  if (modalElement) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.show();
  }
}

function saveStudyNotes() {
  const notesInput = document.getElementById('study-notes-input');

  if (!notesInput) {
    return;
  }

  localStorage.setItem('studyNotes', notesInput.value);

  const modalElement = document.getElementById('notesModal');

  if (modalElement) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.hide();
  }

  if (typeof displayToast === 'function') {
    displayToast('success', 'Your study notes have been saved!');
  }
}

/* =================================
FOCUS TIPS
================================= */

function openFocusTipsModal() {
  currentFocusTip = 0;

  showFocusTip();

  const modalElement = document.getElementById('focusTipsModal');

  if (modalElement) {
    const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

    modal.show();
  }
}

function showFocusTip() {
  const tip = focusTips[currentFocusTip];

  const title = document.getElementById('focus-tip-title');

  const text = document.getElementById('focus-tip-text');

  if (title) {
    title.textContent = tip.title;
  }

  if (text) {
    text.textContent = tip.text;
  }
}

function showNextFocusTip() {
  currentFocusTip++;

  if (currentFocusTip >= focusTips.length) {
    currentFocusTip = 0;
  }

  showFocusTip();
}
// ==========================================
// BREAK TIMER
// ==========================================

let breakTimerInterval = null;
let breakDurationSeconds = 5 * 60;
let breakRemainingSeconds = breakDurationSeconds;
let breakRunning = false;

const breakTimeDisplay = document.getElementById('break-time');
const startBreakBtn = document.getElementById('start-break-btn');
const stopBreakBtn = document.getElementById('stop-break-btn');
const resetBreakBtn = document.getElementById('reset-break-btn');

const breakPresets = document.querySelectorAll('.break-preset');
const customBreakInput = document.getElementById('custom-break-input');

// ==========================================
// SETUP BREAK CONTROLS
// ==========================================

function setupBreakControls() {
  if (startBreakBtn) {
    startBreakBtn.addEventListener('click', startBreakTimer);
  }

  if (stopBreakBtn) {
    stopBreakBtn.addEventListener('click', stopBreakTimer);
  }

  if (resetBreakBtn) {
    resetBreakBtn.addEventListener('click', resetBreakTimer);
  }

  breakPresets.forEach((preset) => {
    preset.addEventListener('click', () => {
      const duration = Number(preset.dataset.breakDuration);

      if (!duration) {
        return;
      }

      stopBreakTimer();

      breakDurationSeconds = duration * 60;
      breakRemainingSeconds = breakDurationSeconds;

      breakPresets.forEach((button) => {
        button.classList.remove('active');
      });

      preset.classList.add('active');

      if (customBreakInput) {
        customBreakInput.value = '';
      }

      updateBreakDisplay();
      updateBreakButtons();

      if (startBreakBtn) {
        startBreakBtn.innerHTML = `
          <i class="fas fa-play"></i>
          Start ${duration} Minute Break
        `;
      }
    });
  });

  if (customBreakInput) {
    customBreakInput.addEventListener('input', () => {
      const duration = Number(customBreakInput.value);

      if (!Number.isFinite(duration) || duration < 1 || duration > 60) {
        return;
      }

      stopBreakTimer();

      breakDurationSeconds = Math.round(duration) * 60;
      breakRemainingSeconds = breakDurationSeconds;

      breakPresets.forEach((button) => {
        button.classList.remove('active');
      });

      updateBreakDisplay();
      updateBreakButtons();

      if (startBreakBtn) {
        startBreakBtn.innerHTML = `
          <i class="fas fa-play"></i>
          Start ${Math.round(duration)} Minute Break
        `;
      }
    });
  }
}

// ==========================================
// FORMAT BREAK TIME
// ==========================================

function formatBreakTime(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${String(minutes).padStart(2, '0')}:${String(remainingSeconds).padStart(2, '0')}`;
}

// ==========================================
// UPDATE BREAK DISPLAY
// ==========================================

function updateBreakDisplay() {
  if (breakTimeDisplay) {
    breakTimeDisplay.textContent = formatBreakTime(breakRemainingSeconds);
  }
}

// ==========================================
// UPDATE BREAK BUTTONS
// ==========================================

function updateBreakButtons() {
  if (!startBreakBtn || !stopBreakBtn) {
    return;
  }

  startBreakBtn.disabled = breakRunning;
  stopBreakBtn.disabled = !breakRunning;
}

// ==========================================
// START BREAK TIMER
// ==========================================

function startBreakTimer() {
  if (breakRunning) {
    return;
  }

  if (breakRemainingSeconds <= 0) {
    breakRemainingSeconds = breakDurationSeconds;
    updateBreakDisplay();
  }

  breakRunning = true;

  updateBreakButtons();

  const statusText = document.getElementById('character-status-text');

  if (statusText) {
    statusText.textContent = 'Taking a break ☕';
  }

  breakTimerInterval = setInterval(() => {
    if (breakRemainingSeconds > 0) {
      breakRemainingSeconds--;

      updateBreakDisplay();
    }

    if (breakRemainingSeconds <= 0) {
      stopBreakTimer();

      if (typeof displayToast === 'function') {
        displayToast('success', '☕ Break finished! Ready to get back to studying.');
      }

      if (statusText) {
        statusText.textContent = 'Ready to study';
      }
    }
  }, 1000);
}

// ==========================================
// STOP BREAK TIMER
// ==========================================

function stopBreakTimer() {
  clearInterval(breakTimerInterval);

  breakTimerInterval = null;
  breakRunning = false;

  updateBreakButtons();
}

// ==========================================
// RESET BREAK TIMER
// ==========================================

function resetBreakTimer() {
  stopBreakTimer();

  breakRemainingSeconds = breakDurationSeconds;

  updateBreakDisplay();

  const statusText = document.getElementById('character-status-text');

  if (statusText) {
    statusText.textContent = 'Ready to study';
  }
}

function openBreakModal() {
  const modalElement = document.getElementById('breakModal');

  if (!modalElement) {
    console.error('Break modal not found: #breakModal');
    return;
  }

  const modal = bootstrap.Modal.getOrCreateInstance(modalElement);

  modal.show();

  updateBreakDisplay();
  updateBreakButtons();
}

// ==========================================
// INITIALISE BREAK TIMER
// ==========================================

updateBreakDisplay();
updateBreakButtons();
