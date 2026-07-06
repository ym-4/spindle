const express = require('express');
const createError = require('http-errors');
const Friends = require('../models/Friends.model');
const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(authenticateJWT);

router.get('/search', async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 1) {
      return res.status(200).json({ users: [] });
    }
    const users = await Friends.searchUsers(req.user.id, q);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

/** @deprecated use GET /friends/search */
router.get('/users/search', async (req, res, next) => {
  try {
    const q = req.query.q?.trim();
    if (!q || q.length < 1) {
      return res.status(200).json({ users: [] });
    }
    const users = await Friends.searchUsers(req.user.id, q);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

router.get('/users/:userId/profile', async (req, res, next) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) return next(createError(400, 'Invalid user id.'));
    const profile = await Friends.getPublicProfile(req.user.id, userId);
    if (!profile) return next(createError(404, 'User not found.'));
    res.status(200).json({ profile });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const friends = await Friends.listFriends(req.user.id);
    res.status(200).json({ friends });
  } catch (err) {
    next(err);
  }
});

router.get('/requests', async (req, res, next) => {
  try {
    const tab = req.query.tab === 'sent' ? 'sent' : 'received';
    const requests = await Friends.listRequests(req.user.id, tab);
    res.status(200).json({ requests });
  } catch (err) {
    next(err);
  }
});

router.post('/request', async (req, res, next) => {
  try {
    const receiverId = Number.parseInt(req.body?.receiver_id ?? req.body?.receiverId, 10);
    if (Number.isNaN(receiverId)) {
      return res.status(400).json({ error: 'receiver_id is required.' });
    }
    await Friends.sendRequest(req.user.id, receiverId);
    try {
      const { sendToUser } = require('../realtime/wsHub');
      sendToUser(receiverId, { type: 'friend:refresh' });
    } catch {
      /* optional */
    }
    res.status(201).json({ message: 'Friend request sent.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/accept', async (req, res, next) => {
  try {
    const requestId = Number.parseInt(req.body?.request_id ?? req.body?.requestId, 10);
    if (Number.isNaN(requestId)) {
      return res.status(400).json({ error: 'request_id is required.' });
    }
    const reqRow = await Friends.acceptRequest(req.user.id, requestId);
    try {
      const { sendToUser } = require('../realtime/wsHub');
      sendToUser(reqRow.sender_id, { type: 'friend:refresh' });
      sendToUser(reqRow.receiver_id, { type: 'friend:refresh' });
    } catch {
      /* optional */
    }
    res.status(200).json({ message: 'Friend request accepted.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.post('/decline', async (req, res, next) => {
  try {
    const requestId = Number.parseInt(req.body?.request_id ?? req.body?.requestId, 10);
    if (Number.isNaN(requestId)) {
      return res.status(400).json({ error: 'request_id is required.' });
    }
    await Friends.declineRequest(req.user.id, requestId);
    res.status(200).json({ message: 'Request declined.' });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.delete('/:friendId', async (req, res, next) => {
  try {
    const friendId = Number.parseInt(req.params.friendId, 10);
    if (Number.isNaN(friendId)) return next(createError(400, 'Invalid friend id.'));
    await Friends.unfriend(req.user.id, friendId);
    res.status(200).json({ message: 'Unfriended.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
