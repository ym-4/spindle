const pool = require('./db');

(async function migrateSnakeScores() {
  try {
    await pool.query(`
      CREATE TABLE IF NOT EXISTS "SnakeScores" (
        "user_id" INT PRIMARY KEY REFERENCES "Person"("id") ON DELETE CASCADE,
        "best_score" INT NOT NULL DEFAULT 0,
        "updated_at" TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      );
    `);
  } catch (e) {
    console.warn('[Snake.model] Migration skipped:', e.message);
  }
})();

// Insert user's best score.
module.exports.upsertSnakeScore = async function upsertSnakeScore(data) {
  const VALUES = [data.user_id, data.score];
  const { rows } = await pool.query(
    `
    INSERT INTO "SnakeScores" (user_id, best_score, updated_at)
    VALUES ($1, $2, CURRENT_TIMESTAMP)
    ON CONFLICT (user_id)
    DO UPDATE SET
      best_score = GREATEST("SnakeScores".best_score, EXCLUDED.best_score),
      updated_at = CASE
        WHEN EXCLUDED.best_score > "SnakeScores".best_score THEN CURRENT_TIMESTAMP
        ELSE "SnakeScores".updated_at
      END
    RETURNING best_score, (best_score = $2) AS is_new_best
    `,
    VALUES,
  );
  return rows[0];
};

// Top 10 users on leaderboard
module.exports.getTopSnakeScores = async function getTopSnakeScores(limit = 10) {
  const { rows } = await pool.query(
    `
    SELECT
      p.id AS user_id,
      p.name,
      p.display_name,
      p.profile_image,
      s.best_score
    FROM "SnakeScores" s
    JOIN "Person" p ON p.id = s.user_id
    ORDER BY s.best_score DESC, s.updated_at ASC
    LIMIT $1
    `,
    [limit],
  );
  return rows;
};

// Get user's high score
module.exports.getSnakeScoreByUserID = async function getSnakeScoreByUserID(user_id) {
  const VALUES = [user_id];
  const { rows } = await pool.query(
    `SELECT best_score FROM "SnakeScores" WHERE user_id = $1`,
    VALUES,
  );
  return rows[0]?.best_score ?? 0;
};
