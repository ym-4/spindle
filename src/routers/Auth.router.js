const express = require('express');
const createError = require('http-errors');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Auth = require('../models/Auth.model');
const { signToken } = require('../utils/jwt');
const { authenticateJWT, requireAdmin } = require('../middlewares/auth.middleware');

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
    const { name, email, country, password, role } = req.body ?? {};
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

    const isAdminCreate = role === 'admin';
    if (isAdminCreate) {
      const newUser = await Auth.createUser({
        name: name.trim(),
        email: email.trim().toLowerCase(),
        country: (country || '').trim(),
        password,
        avatar: null,
        role,
      });
      return res.status(201).json({ message: 'User created.', user: newUser });
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

    const payload = await completeLogin(await Auth.getUserProfile(row.id), req, false);
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

    // Check if user is banned
    try {
      const db = require('../models/db');
      await db.query(`ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ`);
      await db.query(`ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS banned_reason TEXT`);
    } catch {}
    const { rows: banCheck } = await require('../models/db').query(
      `SELECT suspended_until, banned_reason FROM "Person" WHERE id = $1`,
      [user.id],
    );
    if (
      banCheck.length > 0 &&
      banCheck[0].suspended_until &&
      new Date(banCheck[0].suspended_until) > new Date()
    ) {
      return res.status(403).json({
        banned: true,
        user_id: user.id,
        name: user.display_name || user.name,
        suspended_until: banCheck[0].suspended_until,
        reason: banCheck[0].banned_reason || 'No reason provided',
      });
    }

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
      message: 'id is undefined',
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
    message: 'Token generated',
  });
});

//////////////////////////////////////////////////////
// VERIFY TOKEN
//////////////////////////////////////////////////////
router.get('/verify-token', (req, res) => {
  res.status(200).json({
    userId: res.locals.userId,
    message: 'Token verified',
  });
});

//////////////////////////////////////////////////////
// BCRYPT PRE-COMPARE
//////////////////////////////////////////////////////
router.post('/pre-compare', (req, res, next) => {
  if (req.body.hash == undefined) {
    return res.status(400).json({
      message: 'hash is undefined',
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
    message: 'Compare successful',
  });
});

//////////////////////////////////////////////////////
// HASH RESULT
//////////////////////////////////////////////////////
router.post('/hash', (req, res) => {
  res.status(200).json({
    hash: res.locals.hash,
    message: 'Hash successful',
  });
});

// Admin: Stats
router.get('/admin/stats', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const stats = await Auth.getAdminStats();
    res.status(200).json(stats);
  } catch (err) {
    next(err);
  }
});

// Admin: Delete user
router.delete('/admin/users/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    if (userId === req.user.id) {
      return res.status(400).json({ error: 'Cannot delete yourself.' });
    }
    await Auth.deleteUser(userId);
    res.status(200).json({ message: 'User deleted.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Update user role
router.put('/admin/users/:id', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const { role } = req.body;
    if (!role || !['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Invalid role.' });
    }
    if (userId === req.user.id && role !== 'admin') {
      return res.status(400).json({ error: 'Cannot demote yourself.' });
    }
    const result = await Auth.updateUserRole(userId, role);
    if (!result) return res.status(404).json({ error: 'User not found.' });
    res.status(200).json({ message: 'Role updated.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Ban/suspend user
router.post('/admin/ban', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { user_id, duration_hours } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required.' });
    if (parseInt(user_id, 10) === req.user.id)
      return res.status(400).json({ error: 'Cannot ban yourself.' });

    let until = null;
    if (duration_hours && duration_hours > 0) {
      until = new Date(Date.now() + duration_hours * 3600000).toISOString();
    } else {
      // Permanent ban
      until = new Date('2999-12-31').toISOString();
    }

    await Auth.suspendUser(user_id, until);
    const durStr = duration_hours ? `${duration_hours} hours` : 'permanently';
    res.status(200).json({ message: `User suspended for ${durStr}.`, suspended_until: until });
  } catch (err) {
    next(err);
  }
});

// Admin: Unsuspend user
router.post('/admin/unsuspend', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { user_id } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required.' });
    await Auth.unsuspendUser(user_id);
    res.status(200).json({ message: 'User unsuspended.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Ban user with reason
router.post('/admin/ban-with-reason', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const { user_id, duration_hours, reason } = req.body;
    if (!user_id) return res.status(400).json({ error: 'user_id is required.' });
    if (!reason) return res.status(400).json({ error: 'Ban reason is required.' });
    if (parseInt(user_id, 10) === req.user.id)
      return res.status(400).json({ error: 'Cannot ban yourself.' });
    let until = null;
    if (duration_hours && duration_hours > 0) {
      until = new Date(Date.now() + duration_hours * 3600000).toISOString();
    } else {
      until = new Date('2999-12-31').toISOString();
    }
    await Auth.banUserWithReason(user_id, until, reason, req.user.id);
    await Auth.addAuditLog(
      req.user.id,
      'ban',
      'user',
      user_id,
      `Banned for ${duration_hours ? duration_hours + ' hours' : 'permanent'}. Reason: ${reason}`,
    );
    const durStr = duration_hours ? `${duration_hours} hours` : 'permanently';
    res.status(200).json({ message: `User suspended ${durStr}.`, suspended_until: until });
  } catch (err) {
    next(err);
  }
});

// Admin: Get banned users list
router.get('/admin/banned-users', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const users = await Auth.getBannedUsers();
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

// Admin: Submit appeal (no auth required - banned user can't log in)
router.post('/appeal', async (req, res, next) => {
  try {
    const { user_id, message } = req.body;
    if (!user_id || !message)
      return res.status(400).json({ error: 'user_id and message required.' });
    const appeal = await Auth.createAppeal(user_id, message);
    res.status(200).json({ message: 'Appeal submitted.', appeal });
  } catch (err) {
    next(err);
  }
});

// Admin: Get pending appeals
router.get('/admin/appeals', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const appeals = await Auth.getPendingAppeals();
    res.status(200).json({ appeals });
  } catch (err) {
    next(err);
  }
});

// Admin: Dismiss appeal (mark as done, ban stays)
router.post('/admin/appeals/:id/dismiss', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const appealId = parseInt(req.params.id, 10);
    await Auth.resolveAppeal(appealId, 'dismissed', req.user.id);
    await Auth.addAuditLog(
      req.user.id,
      'dismiss_appeal',
      'appeal',
      appealId,
      'Appeal dismissed - ban remains',
    );
    res.status(200).json({ message: 'Appeal dismissed.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Appeal approve (approve + unsuspend)
router.post('/admin/appeals/:id/approve', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const pool = require('../models/db');
    const appealId = parseInt(req.params.id, 10);
    const { rows } = await pool.query(`SELECT user_id FROM "BanAppeals" WHERE id = $1`, [appealId]);
    if (rows.length === 0) return res.status(404).json({ error: 'Appeal not found.' });
    await Auth.unsuspendUser(rows[0].user_id);
    await Auth.resolveAppeal(appealId, 'approved', req.user.id);
    await Auth.addAuditLog(
      req.user.id,
      'approve_appeal',
      'appeal',
      appealId,
      'Appeal approved - user unsuspended',
    );
    res.status(200).json({ message: 'Appeal approved. User unsuspended.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Get audit log
router.get('/admin/audit-log', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const log = await Auth.getAuditLog();
    res.status(200).json({ log });
  } catch (err) {
    next(err);
  }
});

// Admin: Dismiss report
router.post('/admin/reports/:id/dismiss', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const reportId = parseInt(req.params.id, 10);
    await Auth.dismissReport(reportId);
    await Auth.addAuditLog(req.user.id, 'dismiss_report', 'report', reportId, 'Report dismissed');
    res.status(200).json({ message: 'Report dismissed.' });
  } catch (err) {
    next(err);
  }
});

// Admin: Search users
router.get('/admin/search-users', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const term = req.query.q || '';
    const users = await Auth.searchUsers(term);
    res.status(200).json({ users });
  } catch (err) {
    next(err);
  }
});

// Admin: Trend stats
router.get('/admin/trend-stats', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const trends = await Auth.getTrendStats();
    res.status(200).json(trends);
  } catch (err) {
    next(err);
  }
});

// Admin: Check ban status (for login page check - no auth)
router.post('/check-ban', async (req, res, next) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ error: 'Email required.' });
    const db = require('../models/db');
    await db.query(`ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ`);
    await db.query(`ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS banned_reason TEXT`);
    const { rows } = await db.query(
      `SELECT id, display_name, name, suspended_until, banned_reason FROM "Person" WHERE email = $1`,
      [email],
    );
    if (rows.length === 0) return res.status(200).json({ banned: false });
    const user = rows[0];
    if (user.suspended_until && new Date(user.suspended_until) > new Date()) {
      return res.status(200).json({
        banned: true,
        user_id: user.id,
        name: user.display_name || user.name,
        suspended_until: user.suspended_until,
        reason: user.banned_reason || 'No reason provided',
      });
    }
    res.status(200).json({ banned: false });
  } catch (err) {
    next(err);
  }
});

// Admin: Global search
router.get('/admin/global-search', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const term = req.query.q || '';
    const results = await Auth.globalSearch(term);
    res.status(200).json(results);
  } catch (err) {
    next(err);
  }
});

// Admin: User activity drill-down
router.get('/admin/users/:id/activity', authenticateJWT, requireAdmin, async (req, res, next) => {
  try {
    const userId = parseInt(req.params.id, 10);
    const activity = await Auth.getUserActivity(userId);
    res.status(200).json(activity);
  } catch (err) {
    next(err);
  }
});

// Report a user/profile
router.post('/report-user', authenticateJWT, async (req, res, next) => {
  try {
    const { reported_id, reason, description } = req.body;
    if (!reported_id || !reason) {
      return res.status(400).json({ error: 'reported_id and reason are required.' });
    }
    if (parseInt(reported_id, 10) === req.user.id) {
      return res.status(400).json({ error: 'Cannot report yourself.' });
    }
    await Auth.reportUser(req.user.id, parseInt(reported_id, 10), reason, description || '');
    res.status(201).json({ message: 'Report submitted.' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
