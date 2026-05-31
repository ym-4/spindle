const express = require('express');
const Calls = require('../models/Calls.model');
const { areFriends } = require('../models/Message.model');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateJWT);

router.get('/logs', async (req, res, next) => {
  try {
    const logs = await Calls.listForUser(req.user.id);
    res.status(200).json({ logs });
  } catch (err) {
    next(err);
  }
});

router.post('/logs', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.body?.peer_id, 10);
    const { call_type: callType, status, duration_sec: durationSec } = req.body ?? {};
    if (Number.isNaN(peerId)) {
      return res.status(400).json({ error: 'peer_id is required.' });
    }
    if (!(await areFriends(req.user.id, peerId))) {
      return res.status(403).json({ error: 'Can only log calls with friends.' });
    }
    const validStatus = ['completed', 'missed', 'declined', 'cancelled', 'busy'];
    if (!validStatus.includes(status)) {
      return res.status(400).json({ error: 'Invalid call status.' });
    }
    const callerId = req.body?.direction === 'incoming' ? peerId : req.user.id;
    const calleeId = req.body?.direction === 'incoming' ? req.user.id : peerId;
    const entry = await Calls.logCall({
      callerId,
      calleeId,
      callType: callType || 'voice',
      status,
      durationSec: Number(durationSec) || 0,
    });
    res.status(201).json({ log: entry });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
