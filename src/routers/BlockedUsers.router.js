const express = require('express');
const { insertBlock, isBlocked } = require('../models/BlockedUsers.model');
const router = express.Router();

// POST /block — Block a user
router.post('/', (req, res, next) => {
  const { blocker_id, blocked_id } = req.body;
  if (!blocker_id || !blocked_id) {
    return res.status(400).json({ message: 'blocker_id and blocked_id are required.' });
  }
  if (parseInt(blocker_id, 10) === parseInt(blocked_id, 10)) {
    return res.status(400).json({ message: 'Cannot block yourself.' });
  }
  insertBlock({ blocker_id, blocked_id })
    .then((result) => {
      if (!result) {
        return res.status(200).json({ message: 'Already blocked.' });
      }
      res.status(201).json(result);
    })
    .catch(next);
});

// GET /block/check/:blocker_id/:blocked_id — Check if blocked
router.get('/check/:blocker_id/:blocked_id', (req, res, next) => {
  isBlocked(req.params.blocker_id, req.params.blocked_id)
    .then((blocked) => res.status(200).json({ blocked }))
    .catch(next);
});

module.exports = router;
