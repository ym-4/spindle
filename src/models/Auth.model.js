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
    avatar: row.avatar,
    role: row.role,
  };
}

module.exports.hashPassword = hashPassword;
module.exports.verifyPassword = verifyPassword;
module.exports.ROLES = ROLES;

module.exports.findByUsername = async function findByUsername(username) {
  const { rows } = await pool.query(
    `SELECT id, email, name, avatar, role, hashed_password
     FROM "Person"
     WHERE name = $1 OR email = $1`,
    [username],
  );
  return rows[0] ?? null;
};

module.exports.findByName = async function findByName(name) {
  const { rows } = await pool.query('SELECT id FROM "Person" WHERE name = $1', [name]);
  return rows[0] ?? null;
};

module.exports.findByEmail = async function findByEmail(email) {
  const { rows } = await pool.query('SELECT id FROM "Person" WHERE email = $1', [email]);
  return rows[0] ?? null;
};

module.exports.createUser = async function createUser({ name, email, password, avatar }) {
  const hashedPassword = hashPassword(password);
  const { rows } = await pool.query(
    `INSERT INTO "Person" (name, email, avatar, hashed_password, role)
     VALUES ($1, $2, $3, $4, $5)
     RETURNING id, name, email, avatar, role`,
    [name, email, avatar ?? null, hashedPassword, ROLES.USER],
  );
  return toPublicUser(rows[0]);
};

module.exports.authenticate = async function authenticate(username, password) {
  const user = await module.exports.findByUsername(username);
  if (!user) return null;
  if (!verifyPassword(password, user.hashed_password)) return null;
  return toPublicUser(user);
};

module.exports.getUserProfile = async function getUserProfile(userId) {
  const { rows } = await pool.query(
    `SELECT id, name, email, avatar, role FROM "Person" WHERE id = $1`,
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
    stats: statsResult.rows[0],
  };
};

module.exports.getAllUsersForAdmin = async function getAllUsersForAdmin() {
  const { rows } = await pool.query(
    `SELECT id, name, email, avatar, role FROM "Person" ORDER BY id`,
  );
  return rows.map(toPublicUser);
};
