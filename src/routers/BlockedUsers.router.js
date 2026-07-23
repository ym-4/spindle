const express = require('express');
const { insertBlock, isBlocked, listBlocked, unblock } = require('../models/BlockedUsers.model');
const { authenticateJWT } = require('../middlewares/auth.middleware');
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

// GET /list — List users blocked by the authenticated user
router.get('/list', authenticateJWT, (req, res, next) => {
  listBlocked(req.user.id)
    .then((users) => res.status(200).json(users))
    .catch(next);
});

// DELETE /:blocked_id — Unblock a user
router.delete('/:blocked_id', authenticateJWT, (req, res, next) => {
  unblock(req.user.id, req.params.blocked_id)
    .then((removed) => {
      if (!removed) return res.status(404).json({ message: 'Not blocked.' });
      res.status(200).json({ message: 'Unblocked.' });
    })
    .catch(next);
});

module.exports = router;
