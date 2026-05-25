const express = require('express');
const createError = require('http-errors');
const {
  listContacts,
  findPersonById,
  getConversation,
  sendMessage,
} = require('../models/Message.model');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateJWT);

router.get('/contacts', async (req, res, next) => {
  try {
    const contacts = await listContacts(req.user.id);
    res.status(200).json({ contacts });
  } catch (err) {
    next(err);
  }
});

router.get('/with/:userId', async (req, res, next) => {
  try {
    const otherUserId = Number.parseInt(req.params.userId, 10);
    if (Number.isNaN(otherUserId)) {
      return next(createError(400, 'Invalid user id.'));
    }

    if (otherUserId === req.user.id) {
      return next(createError(400, 'You cannot message yourself.'));
    }

    const otherUser = await findPersonById(otherUserId);
    if (!otherUser || otherUser.role !== 'user') {
      return next(createError(404, 'User not found.'));
    }

    const messages = await getConversation(req.user.id, otherUserId);
    res.status(200).json({
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        avatar: otherUser.avatar,
      },
      messages,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/', async (req, res, next) => {
  try {
    const recipientId = Number.parseInt(req.body?.recipientId, 10);
    const body = req.body?.body?.trim();

    if (Number.isNaN(recipientId)) {
      return res.status(400).json({ error: 'Recipient id is required.' });
    }

    if (!body) {
      return res.status(400).json({ error: 'Message body cannot be empty.' });
    }

    if (recipientId === req.user.id) {
      return res.status(400).json({ error: 'You cannot message yourself.' });
    }

    const recipient = await findPersonById(recipientId);
    if (!recipient || recipient.role !== 'user') {
      return next(createError(404, 'Recipient not found.'));
    }

    const message = await sendMessage(req.user.id, recipientId, body);
    res.status(201).json({ message });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
