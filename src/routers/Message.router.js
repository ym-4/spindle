const express = require('express');
const createError = require('http-errors');
const {
  listContacts,
  markConversationRead,
  findPersonById,
  getConversation,
  sendMessage,
  areFriends,
  getMessageById,
  editMessage,
  deleteMessage,
  setReaction,
  removeReaction,
  getMessageReactions,
} = require('../models/Message.model');
const Friends = require('../models/Friends.model');
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

    const since = req.query.since || null;
    const messages = await getConversation(req.user.id, otherUserId, since);
    await markConversationRead(req.user.id, otherUserId);
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

    if (!(await areFriends(req.user.id, recipientId))) {
      return res.status(403).json({ error: 'Add them as a friend before messaging.' });
    }

    const message = await sendMessage(req.user.id, recipientId, body);
    try {
      const { sendToUser } = require('../realtime/wsHub');
      sendToUser(recipientId, { type: 'message', message });
      const Notification = require('../models/Notification.model');
      const sender = await Friends.getPublicProfile(recipientId, req.user.id);
      await Notification.create(recipientId, {
        type: 'message',
        title: `New message from ${sender?.display_name || sender?.name}`,
        body: body.slice(0, 120),
        ref_id: req.user.id,
      });
    } catch {
      /* ws optional */
    }
    res.status(201).json({ message });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    next(err);
  }
});

router.patch('/:messageId', async (req, res, next) => {
  try {
    const messageId = Number.parseInt(req.params.messageId, 10);
    const body = req.body?.body?.trim();
    if (Number.isNaN(messageId) || !body) {
      return res.status(400).json({ error: 'Message id and body required.' });
    }
    const updated = await editMessage(messageId, req.user.id, body);
    if (!updated) return res.status(404).json({ error: 'Message not found or not editable.' });
    const peerId =
      updated.sender_id === req.user.id ? updated.recipient_id : updated.sender_id;
    try {
      const { sendToUser } = require('../realtime/wsHub');
      const reactions = await getMessageReactions(messageId);
      const payload = {
        type: 'message:update',
        message: { ...updated, reactions },
      };
      sendToUser(peerId, payload);
      res.status(200).json({ message: updated });
    } catch {
      res.status(200).json({ message: updated });
    }
  } catch (err) {
    next(err);
  }
});

router.delete('/:messageId', async (req, res, next) => {
  try {
    const messageId = Number.parseInt(req.params.messageId, 10);
    if (Number.isNaN(messageId)) return res.status(400).json({ error: 'Invalid message id.' });
    const existing = await getMessageById(messageId);
    const updated = await deleteMessage(messageId, req.user.id);
    if (!updated) return res.status(404).json({ error: 'Message not found.' });
    const peerId =
      existing.sender_id === req.user.id ? existing.recipient_id : existing.sender_id;
    try {
      const { sendToUser } = require('../realtime/wsHub');
      sendToUser(peerId, { type: 'message:update', message: updated });
    } catch {
      /* optional */
    }
    res.status(200).json({ message: updated });
  } catch (err) {
    next(err);
  }
});

router.post('/:messageId/reactions', async (req, res, next) => {
  try {
    const messageId = Number.parseInt(req.params.messageId, 10);
    const emoji = req.body?.emoji?.trim();
    if (Number.isNaN(messageId) || !emoji) {
      return res.status(400).json({ error: 'Message id and emoji required.' });
    }
    const reactions = await setReaction(messageId, req.user.id, emoji);
    if (!reactions) return res.status(404).json({ error: 'Message not found.' });
    const msg = await getMessageById(messageId);
    const peerId = msg.sender_id === req.user.id ? msg.recipient_id : msg.sender_id;
    try {
      const { sendToUser } = require('../realtime/wsHub');
      sendToUser(peerId, {
        type: 'message:reaction',
        messageId,
        reactions,
      });
      sendToUser(req.user.id, { type: 'message:reaction', messageId, reactions });
    } catch {
      /* optional */
    }
    res.status(200).json({ messageId, reactions });
  } catch (err) {
    next(err);
  }
});

router.delete('/:messageId/reactions', async (req, res, next) => {
  try {
    const messageId = Number.parseInt(req.params.messageId, 10);
    if (Number.isNaN(messageId)) return res.status(400).json({ error: 'Invalid message id.' });
    await removeReaction(messageId, req.user.id);
    res.status(200).json({ message: 'Reaction removed.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
