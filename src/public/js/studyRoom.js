/* global fetchMethod, displayToast */

// Get stored user
userId = null;
// Get stored group
groupId = null;
// Get stored token
token = null;

const locationPath = 'images/study-room-sprites/';
let currentCharacter = null;
let characters = [];
let selectedParts = {};

// Start
window.addEventListener('DOMContentLoaded', async () => {
  initializeStudyRoom();
});

// --------------------------------------
// Change character / part
// --------------------------------------
function change(part, option) {
  const layer = document.getElementById(part);

  if (!layer) {
    console.log(`Layer "${part}" does not exist.`);
    return;
  }

  if (!option) {
    layer.style.display = 'none';
    return;
  }

  const path = `${locationPath}${currentCharacter.character_key}/${part}_${option}.png`;

  console.log(path);

  layer.src = path;
  layer.style.display = 'block';
}

function selectCharacter(button, characterKey) {
  const character = characters.find((character) => character.character_key === characterKey);

  if (!character) {
    console.error('Character not found:', characterKey);
    return;
  }

  // Change current character
  currentCharacter = character;

  // Reset selected parts to this character's defaults
  selectedParts = getDefaultParts(currentCharacter);

  console.log('Selected character:', currentCharacter);
  console.log('Selected parts:', selectedParts);

  // Update selected character card
  updateSelectedCard(button.parentElement, button);

  // Rebuild only the customization options
  renderCustomizationOptions();

  // Update preview
  loadCharacter();
}

function selectOption(button, part, option = null) {
  // Save selected option locally
  selectedParts[part] = option;

  // Update character preview
  change(part, option);

  // Find current section
  const section = button.closest('.customizer-section');

  // Find all cards
  const buttons = section.querySelectorAll('.option-card');

  // Remove selected state
  buttons.forEach(function (card) {
    card.classList.remove('selected');
  });

  // Select clicked card
  button.classList.add('selected');
}

// --------------------------------------
// Initialize room
// --------------------------------------
async function initializeStudyRoom() {
  try {
    token = localStorage.getItem('token');
    userId = localStorage.getItem('user_id');
    groupId = localStorage.getItem('groupId');

    await fetchAvailableCharacters();

    const userCharacter = await fetchUserCharacter();

    if (userCharacter) {
      const userCharacterParts = await fetchUserCharacterParts();

      loadSavedUserCharacter(userCharacter, userCharacterParts);
    } else {
      setupDefaultCharacter();
    }

    // Render character cards
    renderCharacterOptions();

    // Render options belonging to current character
    renderCustomizationOptions();

    // Render current character
    loadCharacter();
  } catch (error) {
    console.error('Failed to initialise Study Room:', error);

    displayToast('error', 'Failed to load Study Room.');
  }
}

// Display characters / options
function loadCharacter() {
  if (!currentCharacter) {
    console.error('No current character.');
    return;
  }

  // Hide every possible layer
  document.querySelectorAll('.character-layer').forEach(function (layer) {
    layer.style.display = 'none';
  });

  // Load selected parts
  Object.entries(selectedParts).forEach(function ([part, option]) {
    change(part, option);
  });
}

function renderCharacterOptions() {
  const characterGrid = document.getElementById('character-options');

  if (!characterGrid) {
    console.error('Character options container not found.');
    return;
  }

  characterGrid.innerHTML = '';

  characters.forEach((character) => {
    const button = document.createElement('button');

    button.classList.add('option-card');

    if (currentCharacter && currentCharacter.character_key === character.character_key) {
      button.classList.add('selected');
    }

    button.onclick = () => {
      selectCharacter(button, character.character_key);
    };

    button.innerHTML = `
      <div class="option-preview">
        <img
          src="${getPreviewPath(character)}"
          alt="${character.name}"
        />
      </div>

      <span>${character.name}</span>
    `;

    characterGrid.appendChild(button);
  });
}

function renderCustomizationOptions() {
  const controls = document.getElementById('customization-options');

  if (!controls || !currentCharacter) {
    console.error('Customization container or current character not found.');
    return;
  }

  controls.innerHTML = '';

  if (!currentCharacter.parts) {
    console.error('Current character has no parts:', currentCharacter);
    return;
  }

  Object.entries(currentCharacter.parts).forEach(([part, options]) => {
    const section = document.createElement('section');
    section.classList.add('customizer-section');

    const title = document.createElement('h2');
    title.textContent = `Choose ${formatPartName(part)}`;

    const optionGrid = document.createElement('div');
    optionGrid.classList.add('option-grid');

    // --------------------------------------
    // NONE OPTION
    // Do NOT show None for body
    // --------------------------------------
    if (part !== 'body') {
      const noneButton = document.createElement('button');

      noneButton.type = 'button';
      noneButton.classList.add('option-card');

      // Selected if current value is null
      if (selectedParts[part] === null || selectedParts[part] === undefined) {
        noneButton.classList.add('selected');
      }

      noneButton.onclick = () => {
        selectOption(noneButton, part, null);
      };

      const nonePreview = document.createElement('div');
      nonePreview.classList.add('option-preview');

      const noneText = document.createElement('span');
      noneText.classList.add('remove-icon');
      noneText.textContent = 'None';

      nonePreview.appendChild(noneText);

      const noneLabel = document.createElement('span');
      noneLabel.textContent = 'None';

      noneButton.appendChild(nonePreview);
      noneButton.appendChild(noneLabel);

      optionGrid.appendChild(noneButton);
    }

    // --------------------------------------
    // NORMAL OPTIONS
    // --------------------------------------
    options.forEach((option) => {
      const button = document.createElement('button');

      button.type = 'button';
      button.classList.add('option-card');

      // Mark selected option
      if (selectedParts[part] === option) {
        button.classList.add('selected');
      }

      button.onclick = () => {
        selectOption(button, part, option);
      };

      const preview = document.createElement('div');
      preview.classList.add('option-preview');

      const img = document.createElement('img');

      img.src = `${locationPath}${currentCharacter.character_key}/${part}_${option}.png`;
      img.alt = `${formatPartName(part)} ${option}`;

      img.onerror = () => {
        img.remove();

        const fallback = document.createElement('span');
        fallback.classList.add('remove-icon');
        fallback.textContent = formatOptionName(option);

        preview.appendChild(fallback);
      };

      preview.appendChild(img);

      const label = document.createElement('span');
      label.textContent = formatOptionName(option);

      button.appendChild(preview);
      button.appendChild(label);

      optionGrid.appendChild(button);
    });

    section.appendChild(title);
    section.appendChild(optionGrid);

    controls.appendChild(section);
  });
}
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
  };

  return names[part] || part.charAt(0).toUpperCase() + part.slice(1);
}

function formatOptionName(option) {
  if (!option) {
    return 'None';
  }

  return option.replace(/_/g, ' ').replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function loadSavedUserCharacter(userCharacterData, userCharacterParts) {
  if (!userCharacterData) {
    setupDefaultCharacter();
    return;
  }

  currentCharacter = characters.find(
    (character) => character.id === userCharacterData.character_id,
  );

  if (!currentCharacter) {
    console.error('Could not find character:', userCharacterData.character_id);

    setupDefaultCharacter();
    return;
  }

  selectedParts = getDefaultParts(currentCharacter);

  userCharacterParts.forEach((row) => {
    if (!row.part) return;

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
  console.log('Loaded selected parts:', selectedParts);
}

function updateSelectedCard(container, selectedCard) {
  if (!container) return;

  container.querySelectorAll('.option-card').forEach((card) => {
    card.classList.remove('selected');
  });

  if (selectedCard) {
    selectedCard.classList.add('selected');
  }
}

function getPreviewPath(character) {
  const previewNumber = character.character_key.match(/^char(\d+)/)?.[1];

  return `${locationPath}${character.character_key}/char${previewNumber}_preview.png`;
}

// --------------------------------------
// Setup default
// --------------------------------------
function setupDefaultCharacter() {
  if (characters.length === 0) {
    console.error('No characters available.');
    return;
  }

  currentCharacter = characters[0];

  selectedParts = getDefaultParts(currentCharacter);

  console.log('Default character:', currentCharacter);
  console.log('Default parts:', selectedParts);
}

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
// --------------------------------------
// Enter actual study room
// --------------------------------------
async function enterStudyRoom() {
  try {
    await saveUserCharacter();

    displayToast('success', 'Character saved successfully!');

    console.log('Entering Study Room...');

    window.location.href = './actual_study_room.html';
  } catch (error) {
    console.error('Failed to enter Study Room:', error);

    displayToast('error', 'Failed to save character.');
  }
}

// -----------------------------------------
// Fetch functions
// -----------------------------------------

// Get all characters
async function fetchAvailableCharacters() {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/study-room/characters`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchAvailableCharacters', responseData);

      if (responseStatus == 200) {
        characters = responseData;

        console.log('Available characters:', characters);

        resolve(responseData);
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// Get user's character
async function fetchUserCharacter() {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/study-room/my-character`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchUserCharacter', responseData);

      if (responseStatus == 200) {
        console.log('User character data:', responseData);

        resolve(responseData);
      } else if (responseStatus == 401) {
        window.location.href = './home.html';
      } else if (responseStatus == 404) {
        // User has not selected a character yet
        console.log('User does not have a saved character');

        resolve(null);
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

async function fetchUserCharacterParts() {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/study-room/my-character/parts`;

    const callback = (responseStatus, responseData) => {
      console.log('fetchUserCharacterParts', responseData);

      if (responseStatus === 200) {
        resolve(responseData);
      } else if (responseStatus === 401) {
        window.location.href = './home.html';
      } else {
        reject(responseData);
      }
    };

    fetchMethod(url, callback, 'GET', null, token);
  });
}

// -----------------------------------------
// Update functions
// -----------------------------------------
async function saveUserCharacter() {
  // Save character
  await saveCharacter();

  // Save each selected part
  for (const [part, option] of Object.entries(selectedParts)) {
    await saveCharacterPart(part, option);
  }
}

function saveCharacter() {
  return new Promise((resolve, reject) => {
    const url = `${getCurrentUrl}/study-room/my-character`;

    const data = {
      character_id: currentCharacter.id,
    };

    fetchMethod(
      url,
      (responseStatus, responseData) => {
        if (responseStatus === 200) {
          resolve(responseData);
        } else if (responseStatus === 401) {
          window.location.href = './home.html';
        } else {
          reject(responseData);
        }
      },
      'PUT',
      data,
      token,
    );
  });
}

function saveCharacterPart(part, option) {
  return new Promise((resolve, reject) => {
    const isNone = option === null;

    const url = `${getCurrentUrl}/study-room/my-character/parts/${part}`;

    const data = isNone
      ? null
      : {
          option: option,
        };

    const method = isNone ? 'DELETE' : 'PUT';

    console.log('Saving character part:', {
      part,
      option,
      method,
      url,
    });

    fetchMethod(
      url,
      (responseStatus, responseData) => {
        console.log('saveCharacterPart:', responseStatus, responseData);

        if (responseStatus === 200 || responseStatus === 201 || responseStatus === 204) {
          resolve(responseData);
        } else if (responseStatus === 401) {
          window.location.href = './home.html';
        } else {
          reject(responseData);
        }
      },
      method,
      data,
      token,
    );
  });
}
