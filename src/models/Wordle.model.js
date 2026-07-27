const fs = require('fs');
const path = require('path');

const WORDLIST_PATH = path.join(__dirname, '..', 'data', 'wordlist.json');
const WORD_LENGTH = 5;

let cachedWordList = null;

/**
 * Loads and caches the word list from wordlist.json.
 * Re-reads from disk only on first call (or if you clear cachedWordList).
 */
function loadWordList() {
  if (cachedWordList) return cachedWordList;

  const raw = fs.readFileSync(WORDLIST_PATH, 'utf-8');
  const parsed = JSON.parse(raw);

  cachedWordList = parsed.words
    .map((w) => String(w).toUpperCase())
    .filter((w) => w.length === WORD_LENGTH);

  return cachedWordList;
}

/** Picks a random answer word. Never send this straight to the client. */
function pickRandomWord() {
  const words = loadWordList();
  return words[Math.floor(Math.random() * words.length)];
}

/** Checks a guess against the word list (used to reject nonsense guesses). */
function isValidWord(word) {
  const words = loadWordList();
  return words.includes(String(word).toUpperCase());
}

function countOccurrences(str, char) {
  return [...str].reduce(
    (count, currentChar) => (currentChar === char ? count + 1 : count),
    0
  );
}

/**
 * Same two-pass algorithm as the original CLI script:
 * Pass 1 marks greens and tallies leftover letters in the answer.
 * Pass 2 marks yellows/grays for everything that wasn't green.
 */
function wordleGuess(guess, answer) {
  guess = guess.toUpperCase();
  answer = answer.toUpperCase();

  let output = ['X', 'X', 'X', 'X', 'X'];
  let remaining = {};

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (guess[i] === answer[i]) {
      output[i] = 'G';
    } else {
      remaining[answer[i]] = (remaining[answer[i]] || 0) + 1;
    }
  }

  for (let i = 0; i < WORD_LENGTH; i++) {
    if (output[i] === 'G') continue;

    let letter = guess[i];
    if (remaining[letter] > 0) {
      output[i] = 'Y';
      remaining[letter]--;
    } else {
      output[i] = 'X';
    }
  }

  return output;
}

module.exports = {
  WORD_LENGTH,
  loadWordList,
  pickRandomWord,
  isValidWord,
  countOccurrences,
  wordleGuess,
};
