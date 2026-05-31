const express = require('express');
const Notification = require('../models/Notification.model');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();
router.use(authenticateJWT);

router.get('/', async (req, res, next) => {
  try {
    const notifications = await Notification.listForUser(req.user.id);
    const unread = await Notification.unreadCount(req.user.id);
    res.status(200).json({ notifications, unread });
  } catch (err) {
    next(err);
  }
});

router.patch('/read-all', async (req, res, next) => {
  try {
    await Notification.markAllRead(req.user.id);
    res.status(200).json({ message: 'All marked read.' });
  } catch (err) {
    next(err);
  }
});

router.patch('/:id/read', async (req, res, next) => {
  try {
    const id = Number.parseInt(req.params.id, 10);
    await Notification.markRead(req.user.id, id);
    res.status(200).json({ message: 'Marked read.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
