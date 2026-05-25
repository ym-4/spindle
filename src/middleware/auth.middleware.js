const createError = require('http-errors');
const { verifyToken } = require('../utils/jwt');

function authenticateJWT(req, res, next) {
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return next(createError(401, 'Authentication required.'));
  }

  try {
    const payload = verifyToken(authHeader.slice(7));
    req.user = {
      id: payload.id,
      name: payload.name,
      email: payload.email,
      role: payload.role,
      avatar: payload.avatar,
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
