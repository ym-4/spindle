const express = require('express');
const createError = require('http-errors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Auth = require('../models/Auth.model');
const { signToken } = require('../utils/jwt');
const { authenticateJWT, requireAdmin } = require('../middleware/auth.middleware');

const router = express.Router();
const uploadDir = path.join(__dirname, '../public/uploads/avatars');
const coverDir = path.join(__dirname, '../public/uploads/covers');
fs.mkdirSync(uploadDir, { recursive: true });
fs.mkdirSync(coverDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `user-${req.user.id}${ext}`);
    },
  }),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed.'));
    }
    cb(null, true);
  },
});

const uploadCover = multer({
  storage: multer.diskStorage({
    destination: coverDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `cover-${req.user.id}${ext}`);
    },
  }),
  limits: { fileSize: 8 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) {
      return cb(new Error('Only image files allowed.'));
    }
    cb(null, true);
  },
});

function authResponse(user, sessionId, extra = {}) {
  const publicUser = { ...user, sessionId };
  return { user: publicUser, token: signToken({ ...user, sessionId }), ...extra };
}

async function completeLogin(user, req, rememberMe = false) {
  const sessionId = await Auth.createSession(user.id, {
    device_label: 'Web browser',
    user_agent: req.headers['user-agent'],
    ip: req.ip,
  });
  const full = await Auth.getUserProfile(user.id);
  const payload = authResponse(full ?? user, sessionId);
  if (rememberMe) {
    payload.remember_token = await Auth.createTrustedDevice(user.id);
  }
  return payload;
}

router.post('/register', async (req, res, next) => {
  try {
    const { name, email, password } = req.body ?? {};
    if (!name?.trim() || !email?.trim() || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required.' });
    }
    if (password.length < 4) {
      return res.status(400).json({ error: 'Password must be at least 4 characters.' });
    }
    if (await Auth.findByName(name.trim())) {
      return res.status(409).json({ error: 'Username is already taken.' });
    }
    if (await Auth.findByEmail(email.trim())) {
      return res.status(409).json({ error: 'Email is already registered.' });
    }

    await Auth.createUser({
      name: name.trim(),
      email: email.trim().toLowerCase(),
      password,
      avatar: null,
    });

    const { code } = await Auth.saveVerificationCode(email.trim().toLowerCase(), 'email_verify');
    console.log(`[Campus Hub] Register 2FA (Gmail) for ${email}: ${code}`);

    res.status(201).json({
      needsVerification: true,
      step: 'register',
      email: email.trim().toLowerCase(),
      message: 'We sent a 6-digit code to your Gmail. Enter it to finish registration.',
      previewCode: code,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/verify-email', async (req, res, next) => {
  try {
    const { email, code } = req.body ?? {};
    if (!email?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }
    const ok = await Auth.verifyEmailCode(email.trim().toLowerCase(), code.trim());
    if (!ok) {
      return res.status(400).json({ error: 'Invalid or expired verification code.' });
    }

    const row = await Auth.findByEmail(email.trim().toLowerCase());
    if (!row) return res.status(404).json({ error: 'Account not found.' });

    const payload = await completeLogin(
      await Auth.getUserProfile(row.id),
      req,
      false,
    );
    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/verify-login', async (req, res, next) => {
  try {
    const { email, code, remember_me: rememberMe } = req.body ?? {};
    if (!email?.trim() || !code?.trim()) {
      return res.status(400).json({ error: 'Email and verification code are required.' });
    }
    const ok = await Auth.verifyCode(email.trim().toLowerCase(), code.trim(), 'login_2fa');
    if (!ok) {
      return res.status(400).json({ error: 'Invalid or expired login code.' });
    }

    const row = await Auth.findByEmail(email.trim().toLowerCase());
    if (!row) return res.status(404).json({ error: 'Account not found.' });

    const profile = await Auth.getUserProfile(row.id);
    const payload = await completeLogin(profile, req, !!rememberMe);
    res.status(200).json(payload);
  } catch (err) {
    next(err);
  }
});

router.post('/resend-code', async (req, res, next) => {
  try {
    const { email, purpose = 'email_verify' } = req.body ?? {};
    if (!email?.trim()) return res.status(400).json({ error: 'Email is required.' });
    const p = purpose === 'login_2fa' ? 'login_2fa' : 'email_verify';
    const { code } = await Auth.saveVerificationCode(email.trim().toLowerCase(), p);
    console.log(`[Campus Hub] Resent ${p} code for ${email}: ${code}`);
    res.status(200).json({ message: 'Code resent.', previewCode: code, purpose: p });
  } catch (err) {
    next(err);
  }
});

router.post('/login', async (req, res, next) => {
  try {
    const { username, password, remember_token: rememberToken } = req.body ?? {};
    if (!username?.trim() || !password) {
      return res.status(400).json({ error: 'Username and password are required.' });
    }

    const user = await Auth.authenticate(username.trim(), password);
    if (!user) return res.status(401).json({ error: 'Invalid username or password.' });

    if (!user.email_verified && user.role !== 'admin') {
      const { code } = await Auth.saveVerificationCode(user.email, 'email_verify');
      console.log(`[Campus Hub] Register verify for ${user.email}: ${code}`);
      return res.status(403).json({
        needsVerification: true,
        step: 'register',
        email: user.email,
        message: 'Please verify your email first.',
        previewCode: code,
      });
    }

    if (rememberToken) {
      const trustedUserId = await Auth.findUserIdByTrustedToken(rememberToken);
      if (trustedUserId === user.id) {
        const payload = await completeLogin(user, req, false);
        return res.status(200).json(payload);
      }
    }

    if (user.role === 'admin') {
      const payload = await completeLogin(user, req, false);
      return res.status(200).json(payload);
    }

    const { code } = await Auth.saveVerificationCode(user.email, 'login_2fa');
    console.log(`[Campus Hub] Login 2FA (Gmail) for ${user.email}: ${code}`);

    return res.status(200).json({
      needs2FA: true,
      step: 'login',
      email: user.email,
      message: 'Enter the 6-digit code sent to your Gmail.',
      previewCode: code,
    });
  } catch (err) {
    next(err);
  }
});

router.post('/avatar', authenticateJWT, upload.single('avatar'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const imagePath = `/uploads/avatars/${req.file.filename}`;
    await Auth.updateProfileImage(req.user.id, imagePath);
    res.status(200).json({ profile_image: imagePath });
  } catch (err) {
    next(err);
  }
});

router.post('/cover', authenticateJWT, uploadCover.single('cover'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'No image uploaded.' });
    const imagePath = `/uploads/covers/${req.file.filename}`;
    await Auth.updateCoverImage(req.user.id, imagePath);
    res.status(200).json({ cover_image: imagePath });
  } catch (err) {
    next(err);
  }
});

router.put('/profile', authenticateJWT, async (req, res, next) => {
  try {
    const profile = await Auth.updatePublicProfile(req.user.id, req.body ?? {});
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/me', authenticateJWT, async (req, res, next) => {
  try {
    const profile = await Auth.getUserProfile(req.user.id);
    if (!profile) return next(createError(404, 'User not found.'));
    res.status(200).json(profile);
  } catch (err) {
    next(err);
  }
});

router.get('/admin/users', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    res.status(200).json({ users: await Auth.getAllUsersForAdmin() });
  } catch (err) {
    next(err);
  }
});

//////////////////////////////////////////////////////
// TOKEN PRE-GENERATION
//////////////////////////////////////////////////////
router.post('/pre-token', (req, res, next) => {
  if (req.body.id == undefined) {
    return res.status(400).json({
      message: "id is undefined"
    });
  }
  res.locals.userId = req.body.id;
  next();
});

//////////////////////////////////////////////////////
// SEND TOKEN
//////////////////////////////////////////////////////
router.post('/send-token', (req, res) => {
  res.status(200).json({
    token: res.locals.token,
    userId: res.locals.userId,
    message: "Token generated"
  });
});

//////////////////////////////////////////////////////
// VERIFY TOKEN
//////////////////////////////////////////////////////
router.get('/verify-token', (req, res) => {
  res.status(200).json({
    userId: res.locals.userId,
    message: "Token verified"
  });
});

//////////////////////////////////////////////////////
// BCRYPT PRE-COMPARE
//////////////////////////////////////////////////////
router.post('/pre-compare', (req, res, next) => {
  if (req.body.hash == undefined) {
    return res.status(400).json({
      message: "hash is undefined"
    });
  }
  res.locals.hash = req.body.hash;
  next();
});

//////////////////////////////////////////////////////
// COMPARE SUCCESS
//////////////////////////////////////////////////////
router.post('/compare-success', (req, res) => {
  res.status(200).json({
    message: "Compare successful"
  });
});

//////////////////////////////////////////////////////
// HASH RESULT
//////////////////////////////////////////////////////
router.post('/hash', (req, res) => {
  res.status(200).json({
    hash: res.locals.hash,
    message: "Hash successful"
    });
});

module.exports = router;
