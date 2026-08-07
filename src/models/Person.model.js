const pool = require('./db');

module.exports.getAllPersons = async function getAllPersons() {
  const { rows } = await pool.query('SELECT id, email, name, avatar FROM "Person"');
  return rows;
};

// GET PERSON BY ID
module.exports.getPersonByID = async function getPersonByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person" WHERE id = $1',
    VALUES,
  );
  return rows;
};

// GET PERSON BY NAME
module.exports.getPersonByName = async function getPersonByName(data) {
  const VALUES = [data.name];
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person" WHERE name = $1',
    VALUES,
  );
  return rows;
};

// GET PERSON BY EMAIL
module.exports.getPersonByEmail = async function getPersonByEmail(data) {
  const VALUES = [data.email];
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person" WHERE email = $1',
    VALUES,
  );
  return rows;
};

// INSERT PERSON (manual creation by admin?)
module.exports.insertPerson = async function insertPerson(data) {
  const VALUES = [data.name, data.email, data.bio, data.hashed_password];
  const { rows } = await pool.query(
    `INSERT INTO "Person" (name, email, bio, hashed_password) VALUES ($1, $2, $3, $4) RETURNING id, name, email, bio;`,
    VALUES,
  );
  return rows;
};

//////////////////////////////////////////////////////
// LOGIN
//////////////////////////////////////////////////////
module.exports.login = async function login(data) {
  const VALUES = [data.name];
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar, hashed_password FROM "Person" WHERE name = $1',
    VALUES,
  );
  return rows;
};

//////////////////////////////////////////////////////
// CHECK DUPLICATE USER
//////////////////////////////////////////////////////
module.exports.readUserByEmailAndUsername = async function readUserByEmailAndUsername(data) {
  const VALUES = [data.email, data.name];
  const { rows } = await pool.query(
    `SELECT id, email, name, avatar FROM "Person" WHERE email = $1 OR name = $2`,
    VALUES,
  );
  return rows;
};

//////////////////////////////////////////////////////
// REGISTER USER
//////////////////////////////////////////////////////
module.exports.register = async function register(data) {
  const VALUES = [data.name, data.email, data.hashed_password];
  const { rows } = await pool.query(
    `INSERT INTO "Person" (name, email, hashed_password) VALUES ($1, $2, $3) RETURNING id, name, email;`,
    VALUES,
  );
  return rows;
};
