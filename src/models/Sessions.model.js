const pool = require('./db');

(async function migrateSessions() {
  try {
    await pool.query(`CREATE TABLE IF NOT EXISTS "StudySessions" (
      "id" SERIAL NOT NULL,
      "host_id" INT NOT NULL,
      "title" TEXT NOT NULL DEFAULT '',
      "description" TEXT DEFAULT '',
      "scheduled_at" TIMESTAMP NOT NULL,
      "status" VARCHAR(20) NOT NULL DEFAULT 'scheduled',
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "StudySessions_pkey" PRIMARY KEY ("id"),
      FOREIGN KEY ("host_id") REFERENCES "Person"("id") ON DELETE CASCADE
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "SessionParticipants" (
      "id" SERIAL NOT NULL,
      "session_id" INT NOT NULL,
      "user_id" INT NOT NULL,
      "status" VARCHAR(20) NOT NULL DEFAULT 'invited',
      "joined_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SessionParticipants_pkey" PRIMARY KEY ("id"),
      UNIQUE ("session_id", "user_id"),
      FOREIGN KEY ("session_id") REFERENCES "StudySessions"("id") ON DELETE CASCADE,
      FOREIGN KEY ("user_id") REFERENCES "Person"("id") ON DELETE CASCADE
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "SessionTasks" (
      "id" SERIAL NOT NULL,
      "session_id" INT NOT NULL,
      "text" TEXT NOT NULL DEFAULT '',
      "is_done" BOOLEAN NOT NULL DEFAULT FALSE,
      "created_by" INT NOT NULL,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SessionTasks_pkey" PRIMARY KEY ("id"),
      FOREIGN KEY ("session_id") REFERENCES "StudySessions"("id") ON DELETE CASCADE,
      FOREIGN KEY ("created_by") REFERENCES "Person"("id") ON DELETE CASCADE
    )`);
    await pool.query(`CREATE TABLE IF NOT EXISTS "SessionRecordings" (
      "id" SERIAL NOT NULL,
      "session_id" INT NOT NULL,
      "uploaded_by" INT NOT NULL,
      "file_path" TEXT NOT NULL DEFAULT '',
      "duration_sec" INT DEFAULT 0,
      "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      CONSTRAINT "SessionRecordings_pkey" PRIMARY KEY ("id"),
      FOREIGN KEY ("session_id") REFERENCES "StudySessions"("id") ON DELETE CASCADE,
      FOREIGN KEY ("uploaded_by") REFERENCES "Person"("id") ON DELETE CASCADE
    )`);
  } catch {
    /* migrations may already exist */
  }
})();

module.exports.createSession = async function createSession(
  hostId,
  title,
  description,
  scheduledAt,
  inviteeIds,
) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const { rows } = await client.query(
      `INSERT INTO "StudySessions" ("host_id", "title", "description", "scheduled_at", "status")
       VALUES ($1, $2, $3, $4, 'scheduled')
       RETURNING *`,
      [hostId, title, description, scheduledAt],
    );
    const session = rows[0];
    await client.query(
      `INSERT INTO "SessionParticipants" ("session_id", "user_id", "status")
       VALUES ($1, $2, 'accepted')`,
      [session.id, hostId],
    );
    if (inviteeIds && inviteeIds.length > 0) {
      const placeholders = inviteeIds.map((_, i) => `($1, $${i + 2}, 'invited')`);
      const vals = [session.id, ...inviteeIds];
      await client.query(
        `INSERT INTO "SessionParticipants" ("session_id", "user_id", "status") VALUES ${placeholders.join(', ')} ON CONFLICT DO NOTHING`,
        vals,
      );
    }
    await client.query('COMMIT');
    return session;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
};

module.exports.listUpcoming = async function listUpcoming(userId) {
  const { rows } = await pool.query(
    `SELECT s.*, p."name" AS host_name, p."email" AS host_email
     FROM "StudySessions" s
     JOIN "Person" p ON p."id" = s."host_id"
     WHERE s."id" IN (
       SELECT sp."session_id" FROM "SessionParticipants" sp WHERE sp."user_id" = $1
     )
     ORDER BY s."scheduled_at" ASC`,
    [userId],
  );
  return rows;
};

module.exports.getSession = async function getSession(sessionId) {
  const { rows } = await pool.query(
    `SELECT s.*, p."name" AS host_name, p."email" AS host_email
     FROM "StudySessions" s
     JOIN "Person" p ON p."id" = s."host_id"
     WHERE s."id" = $1`,
    [sessionId],
  );
  return rows[0] || null;
};

module.exports.updateSessionStatus = async function updateSessionStatus(sessionId, status) {
  const { rows } = await pool.query(
    `UPDATE "StudySessions" SET "status" = $2 WHERE "id" = $1 RETURNING *`,
    [sessionId, status],
  );
  return rows[0] || null;
};

module.exports.deleteSession = async function deleteSession(sessionId) {
  const { rows } = await pool.query(`DELETE FROM "StudySessions" WHERE "id" = $1 RETURNING *`, [
    sessionId,
  ]);
  return rows[0] || null;
};

module.exports.addParticipant = async function addParticipant(sessionId, userId) {
  const { rows } = await pool.query(
    `INSERT INTO "SessionParticipants" ("session_id", "user_id", "status")
     VALUES ($1, $2, 'accepted')
     ON CONFLICT ("session_id", "user_id") DO UPDATE SET "status" = 'accepted'
     RETURNING *`,
    [sessionId, userId],
  );
  return rows[0];
};

module.exports.removeParticipant = async function removeParticipant(sessionId, userId) {
  const { rows } = await pool.query(
    `DELETE FROM "SessionParticipants" WHERE "session_id" = $1 AND "user_id" = $2 RETURNING *`,
    [sessionId, userId],
  );
  return rows[0] || null;
};

module.exports.listParticipants = async function listParticipants(sessionId) {
  const { rows } = await pool.query(
    `SELECT sp.*, p."name", p."email"
     FROM "SessionParticipants" sp
     JOIN "Person" p ON p."id" = sp."user_id"
     WHERE sp."session_id" = $1
     ORDER BY sp."joined_at" ASC`,
    [sessionId],
  );
  return rows;
};

module.exports.addTask = async function addTask(sessionId, userId, text) {
  const { rows } = await pool.query(
    `INSERT INTO "SessionTasks" ("session_id", "text", "created_by")
     VALUES ($1, $2, $3) RETURNING *`,
    [sessionId, text, userId],
  );
  return rows[0];
};

module.exports.toggleTask = async function toggleTask(taskId) {
  const { rows } = await pool.query(
    `UPDATE "SessionTasks" SET "is_done" = NOT "is_done" WHERE "id" = $1 RETURNING *`,
    [taskId],
  );
  return rows[0] || null;
};

module.exports.deleteTask = async function deleteTask(taskId) {
  const { rows } = await pool.query(`DELETE FROM "SessionTasks" WHERE "id" = $1 RETURNING *`, [
    taskId,
  ]);
  return rows[0] || null;
};

module.exports.listTasks = async function listTasks(sessionId) {
  const { rows } = await pool.query(
    `SELECT st.*, p."name" AS created_by_name
     FROM "SessionTasks" st
     JOIN "Person" p ON p."id" = st."created_by"
     WHERE st."session_id" = $1
     ORDER BY st."id" ASC`,
    [sessionId],
  );
  return rows;
};

module.exports.saveRecording = async function saveRecording(
  sessionId,
  userId,
  filePath,
  durationSec,
) {
  const { rows } = await pool.query(
    `INSERT INTO "SessionRecordings" ("session_id", "uploaded_by", "file_path", "duration_sec")
     VALUES ($1, $2, $3, $4) RETURNING *`,
    [sessionId, userId, filePath, durationSec || 0],
  );
  return rows[0];
};

module.exports.listRecordings = async function listRecordings(sessionId) {
  const { rows } = await pool.query(
    `SELECT sr.*, p."name" AS uploaded_by_name
     FROM "SessionRecordings" sr
     JOIN "Person" p ON p."id" = sr."uploaded_by"
     WHERE sr."session_id" = $1
     ORDER BY sr."created_at" DESC`,
    [sessionId],
  );
  return rows;
};
