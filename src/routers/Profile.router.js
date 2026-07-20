const express = require('express');
const createError = require('http-errors');
const Profile = require('../models/Profile.model');
const Auth = require('../models/Auth.model');
const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();
router.use(authenticateJWT);

router.get('/settings', async (req, res, next) => {
  try {
    const settings = await Profile.getAllSettings(req.user.id);
    if (!settings) return next(createError(404, 'User not found.'));
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings/account', async (req, res, next) => {
  try {
    const { current_password, email, phone, display_name } = req.body ?? {};
    if (email !== undefined || phone !== undefined || display_name !== undefined) {
      if (!current_password) {
        return res.status(400).json({ error: 'Current password is required to change account settings.' });
      }
    }
    const settings = await Profile.updateAccountSettings(req.user.id, req.body ?? {});
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings/security', async (req, res, next) => {
  try {
    const settings = await Profile.updateSecuritySettings(req.user.id, req.body ?? {});
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings/notifications', async (req, res, next) => {
  try {
    const settings = await Profile.updateNotificationSettings(req.user.id, req.body ?? {});
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings/appearance', async (req, res, next) => {
  try {
    const settings = await Profile.updateAppearanceSettings(req.user.id, req.body ?? {});
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.put('/settings/privacy', async (req, res, next) => {
  try {
    const settings = await Profile.updatePrivacySettings(req.user.id, req.body ?? {});
    res.status(200).json({ settings });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/password/request-code', async (req, res, next) => {
  try {
    const profile = await Auth.getUserProfile(req.user.id);
    if (!profile?.email) return next(createError(404, 'User not found.'));
    const { code } = await Auth.saveVerificationCode(profile.email, 'password_change');
    console.log(`[Campus Hub] Password change 2FA for ${profile.email}: ${code}`);
    res.status(200).json({
      message: 'Verification code sent to your email.',
      previewCode: code,
    });
  } catch (err) {
    next(err);
  }
});

router.put('/settings/password', async (req, res, next) => {
  try {
    const { current_password, new_password, new_password_confirm, code } = req.body ?? {};
    if (!current_password || !new_password || !code?.trim()) {
      return res
        .status(400)
        .json({ error: 'Current password, new password, and 2FA code required.' });
    }
    if (new_password.length < 4) {
      return res.status(400).json({ error: 'New password must be at least 4 characters.' });
    }
    if (new_password !== new_password_confirm) {
      return res.status(400).json({ error: 'New passwords do not match.' });
    }
    const profile = await Auth.getUserProfile(req.user.id);
    const okCode = await Auth.verifyCode(profile.email, code.trim(), 'password_change');
    if (!okCode) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }
    const ok = await Auth.updatePassword(req.user.id, current_password, new_password);
    if (!ok) return res.status(401).json({ error: 'Current password is incorrect.' });
    res.status(200).json({ message: 'Password updated.' });
  } catch (err) {
    next(err);
  }
});

router.get('/settings/sessions', async (req, res, next) => {
  try {
    const sessions = await Profile.listSessions(req.user.id);
    res.status(200).json({ sessions });
  } catch (err) {
    next(err);
  }
});

router.delete('/settings/sessions/:sessionId', async (req, res, next) => {
  try {
    const sessionId = Number.parseInt(req.params.sessionId, 10);
    const removed = await Profile.revokeSession(req.user.id, sessionId);
    if (!removed) return next(createError(404, 'Session not found.'));
    res.status(200).json({ message: 'Session revoked.' });
  } catch (err) {
    next(err);
  }
});

router.get('/settings/export', async (req, res, next) => {
  try {
    const data = await Profile.exportUserData(req.user.id);
    res.status(200).json(data);
  } catch (err) {
    next(err);
  }
});

router.post('/settings/deactivate', async (req, res, next) => {
  try {
    await Auth.deactivateAccount(req.user.id);
    res.status(200).json({ message: 'Account deactivated.' });
  } catch (err) {
    next(err);
  }
});

router.post('/settings/delete', async (req, res, next) => {
  try {
    if (req.body?.confirm !== 'DELETE') {
      return res.status(400).json({ error: 'Type DELETE to confirm permanent deletion.' });
    }
    await Auth.deleteAccount(req.user.id);
    res.status(200).json({ message: 'Account scheduled for deletion.' });
  } catch (err) {
    next(err);
  }
});

router.get('/payment', async (req, res, next) => {
  try {
    const payment = await Profile.getPaymentDetails(req.user.id);
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
    const payment = await Profile.updatePaymentDetails(req.user.id, {
      billing_name: billing_name?.trim(),
      payment_method: payment_method?.trim(),
      card_last4: card_last4?.trim(),
    });
    res.status(200).json({ payment });
  } catch (err) {
    next(err);
  }
});

router.get('/saved-posts', async (req, res, next) => {
  try {
    res.status(200).json({ posts: await Profile.listSavedPosts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.post('/saved-posts/:postId', async (req, res, next) => {
  try {
    const postId = Number.parseInt(req.params.postId, 10);
    if (Number.isNaN(postId)) return next(createError(400, 'Invalid post id.'));
    const post = await Profile.findPostById(postId);
    if (!post) return next(createError(404, 'Post not found.'));
    await Profile.savePost(req.user.id, postId);
    res.status(201).json({ posts: await Profile.listSavedPosts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.delete('/saved-posts/:postId', async (req, res, next) => {
  try {
    const postId = Number.parseInt(req.params.postId, 10);
    if (Number.isNaN(postId)) return next(createError(400, 'Invalid post id.'));
    const removed = await Profile.unsavePost(req.user.id, postId);
    if (!removed) return next(createError(404, 'Saved post not found.'));
    res.status(200).json({ posts: await Profile.listSavedPosts(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/posts', async (req, res, next) => {
  try {
    res.status(200).json({ posts: await Profile.listPostHistory(req.user.id) });
  } catch (err) {
    next(err);
  }
});

router.get('/groups', async (req, res, next) => {
  try {
    res.status(200).json({ groups: await Profile.listJoinedGroups(req.user.id) });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
