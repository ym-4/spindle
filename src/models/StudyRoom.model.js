const pool = require('./db');

// -----------------------------------------
// Study room characters
// -----------------------------------------

// Get all available characters
module.exports.getAllStudyRoomCharacters = async function getAllStudyRoomCharacters() {
  const { rows } = await pool.query(`
      SELECT *
      FROM "StudyRoomCharacters"
      ORDER BY "id"
    `);

  return rows;
};

// Get one available character
module.exports.getStudyRoomCharacter = async function getStudyRoomCharacter(data) {
  const VALUES = [data.character_id];

  const { rows } = await pool.query(
    `
      SELECT *
      FROM "StudyRoomCharacters"
      WHERE "id" = $1
      `,
    VALUES,
  );

  return rows[0];
};

// -----------------------------------------
// User's selected study room character
// -----------------------------------------

// Get the user's current character
module.exports.getUserCharacter = async function getUserCharacter(data) {
  const VALUES = [data.user_id];

  const { rows } = await pool.query(
    `
      SELECT *
      FROM "UserCharacters"
      WHERE "user_id" = $1
      `,
    VALUES,
  );

  return rows[0];
};

// Set or change the user's character
module.exports.updateUserCharacter = async function updateUserCharacter(data) {
  const VALUES = [data.user_id, data.character_id];

  const { rows } = await pool.query(
    `
      INSERT INTO "UserCharacters" ("user_id", "character_id")
      VALUES ($1, $2)
      ON CONFLICT ("user_id")
      DO UPDATE SET
        "character_id" = EXCLUDED."character_id"
      RETURNING *
      `,
    VALUES,
  );

  return rows[0];
};

// -----------------------------------------
// User's character parts
// -----------------------------------------

// Get all customisation parts for a user
module.exports.getUserCharacterParts = async function getUserCharacterParts(data) {
  const VALUES = [data.user_id];

  const { rows } = await pool.query(
    `
      SELECT * 
      FROM "UserCharacterParts"
      WHERE "user_id" = $1
      `,
    VALUES,
  );

  return rows;
};

// Set or update one character part
module.exports.updateUserCharacterPart = async function updateUserCharacterPart(data) {
  const VALUES = [data.user_id, data.part, data.option];

  const { rows } = await pool.query(
    `
      INSERT INTO "UserCharacterParts" (
        "user_id",
        "part",
        "option"
      )
      VALUES ($1, $2, $3)
      ON CONFLICT ("user_id", "part")
      DO UPDATE SET
        "option" = EXCLUDED."option"
      RETURNING *
      `,
    VALUES,
  );

  return rows[0];
};

// Remove a character part
module.exports.deleteUserCharacterPart = async function deleteUserCharacterPart(data) {
  const VALUES = [data.user_id, data.part];

  const { rows } = await pool.query(
    `
      DELETE FROM "UserCharacterParts"
      WHERE "user_id" = $1
        AND "part" = $2
      RETURNING *
      `,
    VALUES,
  );

  return rows[0];
};

// Remove all saved character parts for a user
module.exports.deleteAllUserCharacterParts = async function deleteAllUserCharacterParts(data) {
  const VALUES = [data.user_id];

  const { rows } = await pool.query(
    `
      DELETE FROM "UserCharacterParts"
      WHERE "user_id" = $1
      RETURNING *
    `,
    VALUES,
  );

  return rows;
};
