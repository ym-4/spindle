const crypto = require('crypto');
const pool = require('./db');

const SCRYPT_KEYLEN = 64;
const ROLES = { USER: 'user', ADMIN: 'admin' };

function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex');
  const hash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  return `${salt}:${hash}`;
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false;
  const [salt, hash] = stored.split(':');
  const testHash = crypto.scryptSync(password, salt, SCRYPT_KEYLEN).toString('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(testHash, 'hex'));
  } catch {
    return false;
  }
}

function toPublicUser(row) {
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    display_name: row.display_name || row.name,
    avatar: row.avatar,
    profile_image: row.profile_image || null,
    role: row.role,
    email_verified: row.email_verified ?? true,
  };
}

function generateCode() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.ROLES = ROLES;
module.exports.generateCode = generateCode;

module.exports.findByUsername = async function findByUsername(username) {
  const { rows } = await pool.query(
    `SELECT id, email, name, display_name, avatar, profile_image, role,
            hashed_password, email_verified, is_active, deleted_at
     FROM "Person"
     WHERE (name = $1 OR email = $1) AND deleted_at IS NULL`,
    [username],
  );
  return rows[0] ?? null;
};

module.exports.findByName = async function findByName(name) {
  const { rows } = await pool.query(
    `SELECT id FROM "Person" WHERE name = $1 AND deleted_at IS NULL`,
    [name],
  );
  return rows[0] ?? null;
};

module.exports.findByEmail = async function findByEmail(email) {
  const { rows } = await pool.query(
    `SELECT id FROM "Person" WHERE email = $1 AND deleted_at IS NULL`,
    [email],
  );
  return rows[0] ?? null;
};

module.exports.createUser = async function createUser({ name, email, password, avatar }) {
  const hashedPassword = hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO "Person" (name, email, avatar, hashed_password, role, email_verified, display_name)
     VALUES ($1, $2, $3, $4, $5, FALSE, $1)
     RETURNING id, name, email, display_name, avatar, profile_image, role, email_verified`,
    [name, email, avatar ?? null, hashedPassword, ROLES.USER],
  );
  await pool.query(`INSERT INTO "UserSettings" (user_id) VALUES ($1) ON CONFLICT DO NOTHING`, [
    rows[0].id,
  ]);
  return toPublicUser(rows[0]);
};

const TRUST_DAYS = 30;

function hashTrustToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

module.exports.saveVerificationCode = async function saveVerificationCode(
  email,
  purpose = 'email_verify',
) {
  const code = generateCode();
  const expires = new Date(Date.now() + 15 * 60 * 1000);
  await pool.query(`DELETE FROM "EmailVerificationCodes" WHERE email = $1 AND purpose = $2`, [
    email,
    purpose,
  ]);
  await pool.query(
    `INSERT INTO "EmailVerificationCodes" (email, code, expires_at, purpose) VALUES ($1, $2, $3, $4)`,
    [email, code, expires, purpose],
  );
  return { code, expires_at: expires };
};

module.exports.verifyCode = async function verifyCode(email, code, purpose = 'email_verify') {
  const { rows } = await pool.query(
    `SELECT code, expires_at FROM "EmailVerificationCodes" WHERE email = $1 AND purpose = $2`,
    [email, purpose],
  );
  if (rows.length === 0) return false;
  const row = rows[0];
  if (row.code !== code.trim()) return false;
  if (new Date(row.expires_at) < new Date()) return false;

  if (purpose === 'email_verify') {
    await pool.query(`UPDATE "Person" SET email_verified = TRUE WHERE email = $1`, [email]);
  }
  await pool.query(`DELETE FROM "EmailVerificationCodes" WHERE email = $1 AND purpose = $2`, [
    email,
    purpose,
  ]);
  return true;
};

module.exports.verifyEmailCode = async function verifyEmailCode(email, code) {
  return module.exports.verifyCode(email, code, 'email_verify');
};

module.exports.createTrustedDevice = async function createTrustedDevice(userId) {
  const token = crypto.randomBytes(32).toString('hex');
  const expires = new Date(Date.now() + TRUST_DAYS * 24 * 60 * 60 * 1000);
  await pool.query(
    `INSERT INTO "TrustedDevices" (user_id, token_hash, expires_at) VALUES ($1, $2, $3)`,
    [userId, hashTrustToken(token), expires],
  );
  return token;
};

module.exports.findUserIdByTrustedToken = async function findUserIdByTrustedToken(token) {
  if (!token?.trim()) return null;
  const { rows } = await pool.query(
    `SELECT user_id FROM "TrustedDevices" WHERE token_hash = $1 AND expires_at > NOW()`,
    [hashTrustToken(token.trim())],
  );
  return rows[0]?.user_id ?? null;
};

module.exports.revokeTrustedDevices = async function revokeTrustedDevices(userId) {
  await pool.query(`DELETE FROM "TrustedDevices" WHERE user_id = $1`, [userId]);
};

module.exports.createSession = async function createSession(userId, meta = {}) {
  const { rows } = await pool.query(
    `INSERT INTO "UserSessions" (user_id, device_label, user_agent, ip_address)
     VALUES ($1, $2, $3, $4)
     RETURNING id`,
    [userId, meta.device_label || 'Web browser', meta.user_agent || '', meta.ip || ''],
  );
  return rows[0].id;
};

module.exports.authenticate = async function authenticate(username, password) {
  const user = await module.exports.findByUsername(username);
  if (!user) return null;
  if (user.is_active === false || user.deleted_at) return null;
  if (!verifyPassword(password, user.hashed_password)) return null;
  return toPublicUser(user);
};

module.exports.getUserProfile = async function getUserProfile(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, display_name, avatar, profile_image, bio, role, email_verified
     FROM "Person" WHERE id = $1 AND deleted_at IS NULL`,
    [userId],
  );
  if (rows.length === 0) return null;

  const statsResult = await pool.query(
    `SELECT
       (SELECT COUNT(*)::int FROM "Posts" WHERE user_id = $1) AS posts,
       (SELECT COUNT(*)::int FROM "PostComments" WHERE user_id = $1) AS comments,
       (SELECT COUNT(*)::int FROM "UserFriends" WHERE user_id = $1) AS friends,
       (SELECT COUNT(*)::int FROM "GroupMembers" WHERE user_id = $1) AS groups,
       (SELECT COUNT(*)::int FROM "MarketplaceItems" WHERE seller_id = $1) AS marketplace_items`,
    [userId],
  );

  return {
    ...toPublicUser(rows[0]),
    bio: rows[0].bio,
    stats: statsResult.rows[0],
  };
};

module.exports.getAllUsersForAdmin = async function getAllUsersForAdmin() {
  const { rows } = await pool.query(
    `SELECT id, name, email, display_name, avatar, profile_image, role, email_verified
     FROM "Person" WHERE deleted_at IS NULL ORDER BY id`,
  );
  return rows.map(toPublicUser);
};

module.exports.updatePassword = async function updatePassword(userId, currentPassword, newPassword) {
  const { rows } = await pool.query(`SELECT hashed_password FROM "Person" WHERE id = $1`, [userId]);
  if (rows.length === 0) return false;
  if (!verifyPassword(currentPassword, rows[0].hashed_password)) return false;
  await pool.query(`UPDATE "Person" SET hashed_password = $1 WHERE id = $2`, [
    hashPassword(newPassword),
    userId,
  ]);
  return true;
};

module.exports.deactivateAccount = async function deactivateAccount(userId) {
  await pool.query(`UPDATE "Person" SET is_active = FALSE WHERE id = $1`, [userId]);
};

module.exports.deleteAccount = async function deleteAccount(userId) {
  await pool.query(`UPDATE "Person" SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`, [
    userId,
  ]);
};

module.exports.updateProfileImage = async function updateProfileImage(userId, imagePath) {
  await pool.query(`UPDATE "Person" SET profile_image = $1 WHERE id = $2`, [imagePath, userId]);
};
