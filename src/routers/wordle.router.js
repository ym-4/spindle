const express = require('express');
const router = express.Router();
const { WORD_LENGTH, pickRandomWord, isValidWord, wordleGuess } = require('../models/Wordle.model');

const MAX_GUESSES = 6;

// NOTE: requires `req.session` — mount express-session on the app
// before this router. See README-wordle-integration.md.

/**
 * Starts a fresh game. Stores the answer server-side in the session —
 * the response never contains the word itself.
 */
router.post('/new', (req, res) => {
  req.session.wordle = {
    answer: pickRandomWord(),
    guesses: [], // [{ guess: "RIGHT", result: ["G","X","Y","X","X"] }, ...]
    gameOver: false,
    won: false,
  };

  res.json({
    started: true,
    maxGuesses: MAX_GUESSES,
    wordLength: WORD_LENGTH,
  });
});

/**
 * Returns the current game's progress so a page refresh can rebuild
 * the board without losing guesses. Still never returns the answer
 * unless the game is already over.
 */
router.get('/state', (req, res) => {
  const game = req.session.wordle;

  if (!game) {
    return res.json({ active: false });
  }

  res.json({
    active: true,
    guesses: game.guesses,
    gameOver: game.gameOver,
    won: game.won,
    maxGuesses: MAX_GUESSES,
    wordLength: WORD_LENGTH,
    answer: game.gameOver ? game.answer : undefined,
  });
});

/** Submits one guess and returns the G/Y/X feedback for it. */
router.post('/guess', (req, res) => {
  const game = req.session.wordle;

  if (!game) {
    return res.status(400).json({ error: 'No active game. Start a new one first.' });
  }
  if (game.gameOver) {
    return res.status(400).json({ error: 'This game is already finished.' });
  }

  const guess = String(req.body.guess || '')
    .trim()
    .toUpperCase();

  if (guess.length !== WORD_LENGTH || !/^[A-Z]+$/.test(guess)) {
    return res.status(400).json({ error: `Guess must be ${WORD_LENGTH} letters.` });
  }
  if (!isValidWord(guess)) {
    return res.status(400).json({ error: 'Not in the word list.' });
  }

  const result = wordleGuess(guess, game.answer);
  const won = result.every((cell) => cell === 'G');

  game.guesses.push({ guess, result });

  if (won) {
    game.gameOver = true;
    game.won = true;
  } else if (game.guesses.length >= MAX_GUESSES) {
    game.gameOver = true;
    game.won = false;
  }

  res.json({
    result,
    gameOver: game.gameOver,
    won: game.won,
    guessesUsed: game.guesses.length,
    maxGuesses: MAX_GUESSES,
    // Only reveal the answer once the game has actually ended.
    answer: game.gameOver ? game.answer : undefined,
  });
});

module.exports = router;
