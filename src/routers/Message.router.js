const express = require('express');
const createError = require('http-errors');
const upload = require('../middlewares/upload');
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
  muteConversation,
  unmuteConversation,
  isMuted,
  pinChat,
  unpinChat,
  getConversationReadState,
} = require('../models/Message.model');
const Friends = require('../models/Friends.model');
const { authenticateJWT } = require('../middlewares/auth.middleware');

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
    const readState = await getConversationReadState(req.user.id, otherUserId);
    res.status(200).json({
      otherUser: {
        id: otherUser.id,
        name: otherUser.name,
        avatar: otherUser.avatar,
      },
      messages,
      readState,
    });
  } catch (err) {
    next(err);
  }
});

router.get('/with/:userId/search', async (req, res, next) => {
  try {
    const otherUserId = Number.parseInt(req.params.userId, 10);
    const q = req.query.q?.trim()?.toLowerCase();
    if (Number.isNaN(otherUserId) || !q) {
      return res.status(400).json({ error: 'Invalid user id or query.' });
    }
    const pool = require('../models/db');
    const { rows } = await pool.query(
      `SELECT m.id, m.body, m.created_at
       FROM "PersonalMessages" m
       WHERE ((m.sender_id = $1 AND m.recipient_id = $2) OR (m.sender_id = $2 AND m.recipient_id = $1))
         AND m.deleted_at IS NULL
         AND LOWER(m.body) LIKE $3
       ORDER BY m.created_at ASC`,
      [req.user.id, otherUserId, `%${q}%`],
    );
    res.status(200).json({ results: rows });
  } catch (err) {
    next(err);
  }
});

router.get('/read-state/:userId', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.params.userId, 10);
    if (Number.isNaN(peerId)) return res.status(400).json({ error: 'Invalid user id.' });
    const readState = await getConversationReadState(req.user.id, peerId);
    res.status(200).json({ readState });
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('image'), async (req, res, next) => {
  try {
    const recipientId = Number.parseInt(req.body?.recipientId, 10);
    const body = req.body?.body?.trim() || '';
    const replyToId = req.body?.replyToId ? Number.parseInt(req.body.replyToId, 10) : null;
    const imageUrl = req.file ? `/uploads/${req.file.filename}` : null;

    if (Number.isNaN(recipientId)) {
      return res.status(400).json({ error: 'Recipient id is required.' });
    }

    if (!body && !imageUrl) {
      return res.status(400).json({ error: 'Message body or image is required.' });
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

    const message = await sendMessage(req.user.id, recipientId, body, imageUrl, replyToId);
    try {
      const { sendToUser } = require('../realtime/wsHub');
      sendToUser(recipientId, { type: 'message', message });
      if (body) {
        const Notification = require('../models/Notification.model');
        const sender = await Friends.getPublicProfile(recipientId, req.user.id);
        await Notification.create(recipientId, {
          type: 'message',
          title: `New message from ${sender?.display_name || sender?.name}`,
          body: body.slice(0, 120),
          ref_id: req.user.id,
        });
      }
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
    const peerId = updated.sender_id === req.user.id ? updated.recipient_id : updated.sender_id;
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
    const peerId = existing.sender_id === req.user.id ? existing.recipient_id : existing.sender_id;
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

router.get('/mute/:peerId', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.params.peerId, 10);
    if (Number.isNaN(peerId)) return res.status(400).json({ error: 'Invalid peer id.' });
    const muted = await isMuted(req.user.id, peerId);
    res.status(200).json({ muted });
  } catch (err) {
    next(err);
  }
});

router.post('/mute/:peerId', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.params.peerId, 10);
    if (Number.isNaN(peerId)) return res.status(400).json({ error: 'Invalid peer id.' });
    await muteConversation(req.user.id, peerId);
    res.status(200).json({ muted: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/mute/:peerId', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.params.peerId, 10);
    if (Number.isNaN(peerId)) return res.status(400).json({ error: 'Invalid peer id.' });
    await unmuteConversation(req.user.id, peerId);
    res.status(200).json({ muted: false });
  } catch (err) {
    next(err);
  }
});

router.post('/pin/:peerId', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.params.peerId, 10);
    if (Number.isNaN(peerId)) return res.status(400).json({ error: 'Invalid peer id.' });
    await pinChat(req.user.id, peerId);
    res.status(200).json({ pinned: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/pin/:peerId', async (req, res, next) => {
  try {
    const peerId = Number.parseInt(req.params.peerId, 10);
    if (Number.isNaN(peerId)) return res.status(400).json({ error: 'Invalid peer id.' });
    await unpinChat(req.user.id, peerId);
    res.status(200).json({ pinned: false });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
