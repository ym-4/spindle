const express = require('express');
const createError = require('http-errors');
const {
  authenticate,
  createUser,
  findByName,
  findByEmail,
  getUserProfile,
  getAllUsersForAdmin,
} = require('../models/Auth.model');
const { signToken } = require('../utils/jwt');
const { authenticateJWT, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();

function authResponse(user) {
  return { user, token: signToken(user) };
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password, avatar } = req.body ?? {};

    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }

    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }

    if (await findByName(name.trim())) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }

    if (await findByEmail(email.trim())) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    const user = await createUser({
      name: name.trim(),
      email: email.trim(),
      password,
      avatar: avatar?.trim() || null,
    });

    res.status(201).json(authResponse(user));
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body ?? {};

    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await authenticate(username.trim(), password);
    if (!user) {
      return res.status(401).json({ error: 'Invalid username or password.' });
    }

    res.status(200).json(authResponse(user));
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    const profile = await getUserProfile(req.user.id);
    if (!profile) {
      return next(createError(404, 'User not found.'));
    }
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/profile/:userId', authenticateJWT, async (req, res, next) => {
  try {
    const userId = Number.parseInt(req.params.userId, 10);
    if (Number.isNaN(userId)) {
      return next(createError(400, 'Invalid user id.'));
    }

    const isSelf = req.user.id === userId;
    const isAdmin = req.user.role === 'admin';
    if (!isSelf && !isAdmin) {
      return next(createError(403, 'You can only view your own profile.'));
    }

    const profile = await getUserProfile(userId);
    if (!profile) {
      return next(createError(404, 'User not found.'));
    }

    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const users = await getAllUsersForAdmin();
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
