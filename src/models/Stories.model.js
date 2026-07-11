const pool = require('./db');

const STORY_HOURS = 24;

module.exports.create = async function create(userId, mediaUrl, caption, opts) {
  opts = opts || {};
  var type = opts.type || 'image';
  var bg = opts.background || null;
  var privacy = opts.privacy || 'public';
  var isDraft = opts.isDraft || false;
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'public'`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS story_type TEXT DEFAULT 'image'`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS background TEXT`);
  await pool.query(`ALTER TABLE "Stories" ALTER COLUMN media_url DROP NOT NULL`);
  await pool.query(`ALTER TABLE "Stories" ALTER COLUMN expires_at DROP NOT NULL`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false`);
  var expires = isDraft ? null : new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000);
  var { rows } = await pool.query(
    `INSERT INTO "Stories" (user_id, media_url, caption, description, expires_at, privacy, story_type, background, is_draft)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
     RETURNING id, user_id, media_url, caption, description, created_at, expires_at, privacy, story_type, background, is_draft`,
    [userId, mediaUrl || null, (caption || ''), (opts.description || ''), expires, privacy, type, bg, isDraft],
  );
  return rows[0];
};

module.exports.listFeed = async function listFeed(viewerId) {
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS privacy TEXT DEFAULT 'public'`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS story_type TEXT DEFAULT 'image'`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS background TEXT`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS description TEXT DEFAULT ''`);
  await pool.query(`ALTER TABLE "Stories" ALTER COLUMN expires_at DROP NOT NULL`);
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false`);
  var { rows } = await pool.query(
    `SELECT s.id, s.media_url, s.caption, s.description, s.created_at, s.expires_at, s.privacy, s.story_type, s.background, s.is_draft,
            p.id AS user_id, p.name, p.display_name, p.profile_image, p.avatar
     FROM "Stories" s
     JOIN "Person" p ON p.id = s.user_id
     WHERE (s.expires_at IS NULL OR s.expires_at > NOW()) AND s.is_draft = false
       AND (
         s.user_id = $1
         OR (s.privacy = 'public')
         OR (s.privacy = 'friends' AND s.user_id IN (SELECT friend_id FROM "UserFriends" WHERE user_id = $1))
       )
     ORDER BY s.user_id = $1 DESC, s.created_at DESC`,
    [viewerId],
  );
  return rows;
};

module.exports.deleteExpired = async function deleteExpired() {
  await pool.query(`DELETE FROM "Stories" WHERE expires_at IS NOT NULL AND expires_at <= NOW()`);
};

module.exports.updateStory = async function updateStory(id, userId, caption, description) {
  var { rows } = await pool.query(
    `UPDATE "Stories" SET caption = $1, description = $2 WHERE id = $3 AND user_id = $4 RETURNING id, user_id, media_url, caption, description, created_at, expires_at, privacy, story_type, background`,
    [caption || '', description || '', id, userId],
  );
  return rows[0] || null;
};

module.exports.deleteStory = async function deleteStory(id, userId) {
  var { rows } = await pool.query(
    `DELETE FROM "Stories" WHERE id = $1 AND user_id = $2 RETURNING media_url`,
    [id, userId],
  );
  return rows[0] || null;
};

module.exports.addView = async function addView(storyId, viewerId) {
  await pool.query(`CREATE TABLE IF NOT EXISTS "StoryViews" (
    id SERIAL PRIMARY KEY,
    story_id INTEGER NOT NULL REFERENCES "Stories"(id) ON DELETE CASCADE,
    viewer_id INTEGER NOT NULL REFERENCES "Person"(id),
    viewed_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(story_id, viewer_id)
  )`);
  var { rows } = await pool.query(
    `INSERT INTO "StoryViews" (story_id, viewer_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING id`,
    [storyId, viewerId],
  );
  return rows[0] || null;
};

module.exports.getViews = async function getViews(storyId, userId) {
  var { rows: countRows } = await pool.query(
    `SELECT COUNT(*)::int AS count FROM "StoryViews" WHERE story_id = $1`,
    [storyId],
  );
  var { rows: viewerRows } = await pool.query(
    `SELECT sv.viewer_id, sv.viewed_at, p.name, p.display_name, p.profile_image, p.avatar
     FROM "StoryViews" sv
     JOIN "Person" p ON p.id = sv.viewer_id
     WHERE sv.story_id = $1
     ORDER BY sv.viewed_at DESC`,
    [storyId],
  );
  return { count: countRows[0]?.count || 0, viewers: viewerRows };
};

/* ========================= DRAFTS ====================================== */

module.exports.listDrafts = async function listDrafts(userId) {
  await pool.query(`ALTER TABLE "Stories" ADD COLUMN IF NOT EXISTS is_draft BOOLEAN DEFAULT false`);
  var { rows } = await pool.query(
    `SELECT id, user_id, media_url, caption, description, created_at, story_type, background
     FROM "Stories" WHERE user_id = $1 AND is_draft = true ORDER BY created_at DESC`,
    [userId],
  );
  return rows;
};

module.exports.publishDraft = async function publishDraft(draftId, userId) {
  var expires = new Date(Date.now() + STORY_HOURS * 60 * 60 * 1000);
  var { rows } = await pool.query(
    `UPDATE "Stories" SET is_draft = false, expires_at = $1 WHERE id = $2 AND user_id = $3 AND is_draft = true
     RETURNING id, user_id, media_url, caption, description, created_at, expires_at, privacy, story_type, background, is_draft`,
    [expires, draftId, userId],
  );
  return rows[0] || null;
};

module.exports.deleteDraft = async function deleteDraft(draftId, userId) {
  var { rows } = await pool.query(
    `DELETE FROM "Stories" WHERE id = $1 AND user_id = $2 AND is_draft = true RETURNING media_url`,
    [draftId, userId],
  );
  return rows[0] || null;
};
