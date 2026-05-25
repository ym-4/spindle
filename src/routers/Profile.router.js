const express = require('express');
const createError = require('http-errors');
const {
  getSettings,
  updateSettings,
  getPaymentDetails,
  updatePaymentDetails,
  listFriends,
  listFriendCandidates,
  addFriend,
  removeFriend,
  listSavedPosts,
  savePost,
  unsavePost,
  listPostHistory,
  listJoinedGroups,
  listChatroomMessages,
  postChatroomMessage,
  findPersonById,
  findPostById,
} = require('../models/Profile.model');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();

router.use(authenticateJWT);

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await getSettings(req.user.id);
    if (!settings) return next(createError(404, 'User not found.'));
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings', async (req, res, next) => {
  try {
    const settings = await updateSettings(req.user.id, req.body ?? {});
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.get('/payment', async (req, res, next) => {
  try {
    const payment = await getPaymentDetails(req.user.id);
    res.status(200).json({ payment });
  } catch (err) {
    next(err);
  }
});

router.put('/payment', async (req, res, next) => {
  try {
    const { billing_name, payment_method, card_last4 } = req.body ?? {};
    if (card_last4 && !/^\d{4}$/.test(card_last4)) {
      return res.status(400).json({ error: 'Card last 4 digits must be exactly 4 numbers.' });
    }
    const payment = await updatePaymentDetails(req.user.id, {
      billing_name: billing_name?.trim(),
      payment_method: payment_method?.trim(),
      card_last4: card_last4?.trim(),
    });
    res.status(200).json({ payment });
  } catch (err) {
    next(err);
  }
});

router.get('/friends', async (req, res, next) => {
  try {
    const friends = await listFriends(req.user.id);
    res.status(200).json({ friends });
  } catch (err) {
    next(err);
  }
});

router.get('/friends/candidates', async (req, res, next) => {
  try {
    const candidates = await listFriendCandidates(req.user.id);
    res.status(200).json({ candidates });
  } catch (err) {
    next(err);
  }
});

router.post('/friends', async (req, res, next) => {
  try {
    const friendId = Number.parseInt(req.body?.friendId, 10);
    if (Number.isNaN(friendId)) {
      return res.status(400).json({ error: 'Friend id is required.' });
    }
    if (friendId === req.user.id) {
      return res.status(400).json({ error: 'You cannot add yourself as a friend.' });
    }

    const friend = await findPersonById(friendId);
    if (!friend || friend.role !== 'user') {
      return next(createError(404, 'User not found.'));
    }

    await addFriend(req.user.id, friendId);
    const friends = await listFriends(req.user.id);
    res.status(201).json({ friends });
  } catch (err) {
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Already friends with this user.' });
    }
    next(err);
  }
});

router.delete('/friends/:friendId', async (req, res, next) => {
  try {
    const friendId = Number.parseInt(req.params.friendId, 10);
    if (Number.isNaN(friendId)) {
      return next(createError(400, 'Invalid friend id.'));
    }

    const removed = await removeFriend(req.user.id, friendId);
    if (!removed) {
      return next(createError(404, 'Friend not found.'));
    }

    res.status(200).json({ friends: await listFriends(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/saved-posts', async (req, res, next) => {
  try {
    const posts = await listSavedPosts(req.user.id);
    res.status(200).json({ posts });
  } catch (err) {
    next(err);
  }
});

router.post('/saved-posts/:postId', async (req, res, next) => {
  try {
    const postId = Number.parseInt(req.params.postId, 10);
    if (Number.isNaN(postId)) return next(createError(400, 'Invalid post id.'));

    const post = await findPostById(postId);
    if (!post) return next(createError(404, 'Post not found.'));

    await savePost(req.user.id, postId);
    const posts = await listSavedPosts(req.user.id);
    res.status(201).json({ posts });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-posts/:postId', async (req, res, next) => {
  try {
    const postId = Number.parseInt(req.params.postId, 10);
    if (Number.isNaN(postId)) return next(createError(400, 'Invalid post id.'));

    const removed = await unsavePost(req.user.id, postId);
    if (!removed) return next(createError(404, 'Saved post not found.'));

    res.status(200).json({ posts: await listSavedPosts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/posts', async (req, res, next) => {
  try {
    const posts = await listPostHistory(req.user.id);
    res.status(200).json({ posts });
  } catch (err) {
    next(err);
  }
});

router.get('/groups', async (req, res, next) => {
  try {
    const groups = await listJoinedGroups(req.user.id);
    res.status(200).json({ groups });
  } catch (err) {
    next(err);
  }
});

router.get('/chatroom', async (req, res, next) => {
  try {
    const messages = await listChatroomMessages();
    res.status(200).json({ messages });
  } catch (err) {
    next(err);
  }
});

router.post('/chatroom', async (req, res, next) => {
  try {
    const message = req.body?.message?.trim();
    if (!message) {
      return res.status(400).json({ error: 'Message cannot be empty.' });
    }

    const posted = await postChatroomMessage(req.user.id, message);
    res.status(201).json({ message: posted });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
