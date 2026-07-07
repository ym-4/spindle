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

module.exports.createUser = async function createUser({ name, email, password, avatar, country, role }) {
  try {
    await pool.query(`ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS country TEXT DEFAULT ''`);
  } catch {}
  const hashedPassword = hashPassword(password);
  const userRole = role || ROLES.USER;
  const emailVerified = role === 'admin';
  const { rows } = await pool.query(
    `INSERT INTO "Person" (name, email, avatar, hashed_password, role, email_verified, display_name, country)
     VALUES ($1, $2, $3, $4, $5, $6, $1, $7)
     RETURNING id, name, email, display_name, avatar, profile_image, role, email_verified`,
    [name, email, avatar ?? null, hashedPassword, userRole, emailVerified, country || ''],
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
    `SELECT id, name, email, display_name, avatar, profile_image, cover_image, bio,
            headline, location, skills, link_portfolio, link_github, link_linkedin,
            role, email_verified, created_at
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

  const row = rows[0];
  let skills = row.skills;
  if (typeof skills === 'string') {
    try {
      skills = JSON.parse(skills);
    } catch {
      skills = [];
    }
  }
  if (!Array.isArray(skills)) skills = [];

  return {
    ...toPublicUser(row),
    bio: row.bio || '',
    cover_image: row.cover_image || null,
    headline: row.headline || '',
    location: row.location || '',
    skills,
    link_portfolio: row.link_portfolio || '',
    link_github: row.link_github || '',
    link_linkedin: row.link_linkedin || '',
    member_since: row.created_at,
    stats: statsResult.rows[0],
  };
};

module.exports.getAllUsersForAdmin = async function getAllUsersForAdmin() {
  const { rows } = await pool.query(
    `SELECT id, name, email, display_name, avatar, profile_image, role, email_verified, suspended_until
     FROM "Person" WHERE deleted_at IS NULL ORDER BY id`,
  );
  return rows; // return raw rows so admin sees suspended_until
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

module.exports.updateCoverImage = async function updateCoverImage(userId, imagePath) {
  await pool.query(`UPDATE "Person" SET cover_image = $1 WHERE id = $2`, [imagePath, userId]);
};

module.exports.updatePublicProfile = async function updatePublicProfile(userId, data) {
  const fields = [];
  const values = [];
  let i = 1;

  const setField = (col, val) => {
    if (val === undefined) return;
    fields.push(`"${col}" = $${i++}`);
    values.push(val);
  };

  setField('display_name', data.display_name?.trim() || null);
  setField('bio', data.bio ?? '');
  setField('headline', data.headline?.trim() ?? '');
  setField('location', data.location?.trim() ?? '');
  setField('link_portfolio', data.link_portfolio?.trim() ?? '');
  setField('link_github', data.link_github?.trim() ?? '');
  setField('link_linkedin', data.link_linkedin?.trim() ?? '');

  if (data.skills !== undefined) {
    const skills = Array.isArray(data.skills)
      ? data.skills.map((s) => String(s).trim()).filter(Boolean).slice(0, 20)
      : [];
    fields.push(`"skills" = $${i++}::jsonb`);
    values.push(JSON.stringify(skills));
  }

  if (fields.length === 0) return module.exports.getUserProfile(userId);

  values.push(userId);
  await pool.query(`UPDATE "Person" SET ${fields.join(', ')} WHERE id = $${i}`, values);
  return module.exports.getUserProfile(userId);
};

module.exports.deleteUser = async function deleteUser(userId) {
  await pool.query(`UPDATE "Person" SET deleted_at = NOW(), is_active = FALSE WHERE id = $1`, [userId]);
};

module.exports.updateUserRole = async function updateUserRole(userId, role) {
  const { rows } = await pool.query(
    `UPDATE "Person" SET role = $1 WHERE id = $2 AND deleted_at IS NULL RETURNING id`,
    [role, userId]
  );
  return rows.length > 0;
};

module.exports.suspendUser = async function suspendUser(userId, until) {
  try {
    await pool.query(`ALTER TABLE "Person" ADD COLUMN IF NOT EXISTS suspended_until TIMESTAMPTZ`);
  } catch {}
  await pool.query(`UPDATE "Person" SET suspended_until = $1 WHERE id = $2`, [until, userId]);
};

module.exports.unsuspendUser = async function unsuspendUser(userId) {
  await pool.query(`UPDATE "Person" SET suspended_until = NULL WHERE id = $1`, [userId]);
};

module.exports.getAdminStats = async function getAdminStats() {
  const { rows: userRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "Person" WHERE deleted_at IS NULL`);
  const { rows: postRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "Posts"`);
  const { rows: reportRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "Reports"`);
  const { rows: suspendedRows } = await pool.query(`SELECT COUNT(*)::int AS count FROM "Person" WHERE suspended_until IS NOT NULL AND suspended_until > NOW()`);
  return {
    users: userRows[0].count,
    posts: postRows[0].count,
    reports: reportRows[0].count,
    suspended: suspendedRows[0].count,
  };
};
