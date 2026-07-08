const pool = require('./db');

async function ensureSettingsRow(userId) {
  await pool.query(
    `INSERT INTO "UserSettings" (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

async function ensurePaymentRow(userId) {
  await pool.query(
    `INSERT INTO "UserPaymentDetails" (user_id) VALUES ($1) ON CONFLICT (user_id) DO NOTHING`,
    [userId],
  );
}

module.exports.getAllSettings = async function getAllSettings(userId) {
  await ensureSettingsRow(userId);
  await ensurePaymentRow(userId);
  const { rows } = await pool.query(
    `SELECT p.id, p.name, p.email, p.display_name, p.avatar, p.profile_image, p.cover_image, p.bio,
            p.headline, p.location, p.skills, p.link_portfolio, p.link_github, p.link_linkedin,
            s.phone, s.campus, s.language, s.timezone,
            s.two_factor_enabled, s.login_notifications,
            s.notify_email, s.notify_product, s.notify_security, s.notify_frequency,
            s.theme, s.compact_mode, s.font_size,
            s.public_profile, s.activity_tracking, s.cookie_preferences,
            pay.billing_name, pay.payment_method, pay.card_last4
     FROM "Person" p
     LEFT JOIN "UserSettings" s ON s.user_id = p.id
     LEFT JOIN "UserPaymentDetails" pay ON pay.user_id = p.id
     WHERE p.id = $1`,
    [userId],
  );
  return rows[0] ?? null;
};

module.exports.getSettings = module.exports.getAllSettings;

module.exports.updateAccountSettings = async function updateAccountSettings(userId, data) {
  if (data.display_name !== undefined) {
    await pool.query(`UPDATE "Person" SET display_name = $1 WHERE id = $2`, [
      data.display_name?.trim() || null,
      userId,
    ]);
  }
  if (data.email?.trim()) {
    await pool.query(`UPDATE "Person" SET email = $1 WHERE id = $2`, [data.email.trim(), userId]);
  }
  if (data.bio !== undefined) {
    await pool.query(`UPDATE "Person" SET bio = $1 WHERE id = $2`, [data.bio, userId]);
  }
  await ensureSettingsRow(userId);
  await pool.query(
    `UPDATE "UserSettings"
     SET phone = COALESCE($1, phone), campus = COALESCE($2, campus),
         language = COALESCE($3, language), timezone = COALESCE($4, timezone)
     WHERE user_id = $5`,
    [data.phone ?? null, data.campus ?? null, data.language ?? null, data.timezone ?? null, userId],
  );
  return module.exports.getAllSettings(userId);
};

module.exports.updateSecuritySettings = async function updateSecuritySettings(userId, data) {
  await ensureSettingsRow(userId);
  await pool.query(
    `UPDATE "UserSettings"
     SET two_factor_enabled = COALESCE($1, two_factor_enabled),
         login_notifications = COALESCE($2, login_notifications)
     WHERE user_id = $3`,
    [data.two_factor_enabled ?? null, data.login_notifications ?? null, userId],
  );
  return module.exports.getAllSettings(userId);
};

module.exports.updateNotificationSettings = async function updateNotificationSettings(
  userId,
  data,
) {
  await ensureSettingsRow(userId);
  await pool.query(
    `UPDATE "UserSettings"
     SET notify_email = COALESCE($1, notify_email),
         notify_product = COALESCE($2, notify_product),
         notify_security = COALESCE($3, notify_security),
         notify_frequency = COALESCE($4, notify_frequency)
     WHERE user_id = $5`,
    [
      data.notify_email ?? null,
      data.notify_product ?? null,
      data.notify_security ?? null,
      data.notify_frequency ?? null,
      userId,
    ],
  );
  return module.exports.getAllSettings(userId);
};

module.exports.updateAppearanceSettings = async function updateAppearanceSettings(userId, data) {
  await ensureSettingsRow(userId);
  await pool.query(
    `UPDATE "UserSettings"
     SET theme = COALESCE($1, theme), compact_mode = COALESCE($2, compact_mode),
         font_size = COALESCE($3, font_size)
     WHERE user_id = $4`,
    [data.theme ?? null, data.compact_mode ?? null, data.font_size ?? null, userId],
  );
  return module.exports.getAllSettings(userId);
};

module.exports.updatePrivacySettings = async function updatePrivacySettings(userId, data) {
  await ensureSettingsRow(userId);
  await pool.query(
    `UPDATE "UserSettings"
     SET public_profile = COALESCE($1, public_profile),
         activity_tracking = COALESCE($2, activity_tracking),
         cookie_preferences = COALESCE($3, cookie_preferences)
     WHERE user_id = $4`,
    [
      data.public_profile ?? null,
      data.activity_tracking ?? null,
      data.cookie_preferences ?? null,
      userId,
    ],
  );
  return module.exports.getAllSettings(userId);
};

module.exports.updateSettings = module.exports.updateAccountSettings;

module.exports.getPaymentDetails = async function getPaymentDetails(userId) {
  await ensurePaymentRow(userId);
  const { rows } = await pool.query(
    `SELECT billing_name, payment_method, card_last4
     FROM "UserPaymentDetails" WHERE user_id = $1`,
    [userId],
  );
  return rows[0];
};

module.exports.updatePaymentDetails = async function updatePaymentDetails(
  userId,
  { billing_name, payment_method, card_last4 },
) {
  await ensurePaymentRow(userId);
  const { rows } = await pool.query(
    `UPDATE "UserPaymentDetails"
     SET billing_name = COALESCE($1, billing_name),
         payment_method = COALESCE($2, payment_method),
         card_last4 = COALESCE($3, card_last4)
     WHERE user_id = $4
     RETURNING billing_name, payment_method, card_last4`,
    [billing_name ?? null, payment_method ?? null, card_last4 ?? null, userId],
  );
  return rows[0];
};

module.exports.listSessions = async function listSessions(userId) {
  const { rows } = await pool.query(
    `SELECT id, device_label, user_agent, ip_address, created_at, last_active
     FROM "UserSessions" WHERE user_id = $1 ORDER BY last_active DESC`,
    [userId],
  );
  return rows;
};

module.exports.revokeSession = async function revokeSession(userId, sessionId) {
  const { rowCount } = await pool.query(
    `DELETE FROM "UserSessions" WHERE user_id = $1 AND id = $2`,
    [userId, sessionId],
  );
  return rowCount > 0;
};

module.exports.exportUserData = async function exportUserData(userId) {
  const profile = await module.exports.getAllSettings(userId);
  const { rows: posts } = await pool.query(`SELECT * FROM "Posts" WHERE user_id = $1`, [userId]);
  const { rows: friends } = await pool.query(
    `SELECT p.name, p.email FROM "UserFriends" uf JOIN "Person" p ON p.id = uf.friend_id WHERE uf.user_id = $1`,
    [userId],
  );
  return { exported_at: new Date().toISOString(), profile, posts, friends };
};

module.exports.listSavedPosts = async function listSavedPosts(userId) {
  const { rows } = await pool.query(
    `SELECT p.id, p.title, p.category, p.content, p.created_at, sp.created_at AS saved_at
     FROM "SavedPosts" sp
     JOIN "Posts" p ON p.id = sp.post_id
     WHERE sp.user_id = $1
     ORDER BY sp.created_at DESC`,
    [userId],
  );
  return rows;
};

module.exports.savePost = async function savePost(userId, postId) {
  const { rows } = await pool.query(
    `INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2)
     ON CONFLICT (user_id, post_id) DO NOTHING
     RETURNING id, post_id, created_at`,
    [userId, postId],
  );
  return rows[0] ?? null;
};

module.exports.unsavePost = async function unsavePost(userId, postId) {
  const { rowCount } = await pool.query(
    `DELETE FROM "SavedPosts" WHERE user_id = $1 AND post_id = $2`,
    [userId, postId],
  );
  return rowCount > 0;
};

module.exports.listPostHistory = async function listPostHistory(userId) {
  const { rows } = await pool.query(
    `SELECT id, title, category, content, created_at, updated_at
     FROM "Posts"
     WHERE user_id = $1
     ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
};

module.exports.listJoinedGroups = async function listJoinedGroups(userId) {
  const { rows } = await pool.query(
    `SELECT g.id, g.name, g.description, g.school, g.module, gm.role AS member_role
     FROM "GroupMembers" gm
     JOIN "Groups" g ON g.id = gm.group_id
     WHERE gm.user_id = $1
     ORDER BY g.name`,
    [userId],
  );
  return rows;
};

module.exports.findPersonById = async function findPersonById(userId) {
  const { rows } = await pool.query(`SELECT id, name, role FROM "Person" WHERE id = $1`, [userId]);
  return rows[0] ?? null;
};

module.exports.findPostById = async function findPostById(postId) {
  const { rows } = await pool.query(`SELECT id FROM "Posts" WHERE id = $1`, [postId]);
  return rows[0] ?? null;
};
