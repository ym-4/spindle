const createError = require('http-errors');
const { verifyToken } = require('../utils/jwt');
const pool = require('../models/db');

async function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(createError(401, 'Authentication required.'));
  }

  try {
    const payload = verifyToken(authHeader.slice(7));
    if (payload.sessionId) {
      const { rows } = await pool.query(
        `SELECT id FROM "UserSessions" WHERE id = $1 AND user_id = $2`,
        [payload.sessionId, payload.id],
      );
      if (rows.length === 0) {
        return next(createError(401, 'Session revoked. Please log in again.'));
      }
      await pool.query(`UPDATE "UserSessions" SET last_active = NOW() WHERE id = $1`, [
        payload.sessionId,
      ]);
    }
    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      avatar: payload.avatar,
      sessionId: payload.sessionId ?? null,
    };
    next();
  } catch {
    return next(createError(401, 'Invalid or expired token.'));
  }
}

function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') {
    return next(createError(403, 'Admin access required.'));
  }
  next();
}

module.exports = { authenticateJWT, requireAdmin };
