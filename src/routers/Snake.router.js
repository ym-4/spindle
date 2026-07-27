const express = require('express');
const { authenticateJWT } = require('../middlewares/auth.middleware');

const {
  getTopSnakeScores,
  upsertSnakeScore,
  getSnakeScoreByUserID,
} = require('../models/Snake.model');

const router = express.Router();

// GET top 10 leaderboard players
router.get('/leaderboard', (req, res, next) => {
  getTopSnakeScores(10)
    .then((rows) => res.status(200).json(rows))
    .catch(next);
});

// Get user's best score
router.get('/score', authenticateJWT, (req, res, next) => {
  getSnakeScoreByUserID(req.user.id)
    .then((best_score) => res.status(200).json({ best_score }))
    .catch(next);
});

// Post a new score
router.post('/score', authenticateJWT, (req, res, next) => {
  const score = Number(req.body.score);

  if (!Number.isInteger(score) || score < 0) {
    return res.status(400).json({ message: 'A valid non-negative score is required.' });
  }

  upsertSnakeScore({ user_id: req.user.id, score })
    .then((result) => res.status(200).json(result))
    .catch(next);
});

module.exports = router;
