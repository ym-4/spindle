const pool = require('./db');

// Get all Person
module.exports.getAllPersons = async function getAllPersons() {
  const { rows } = await pool.query('SELECT * FROM "Person"');
  return rows;
};

// GET person by id
module.exports.getPersonByID = async function getPersonByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE id = $1', VALUES);
  return rows;
};

// GET person by Name
module.exports.getPersonByName = async function getPersonByName(data) {
  const VALUES = [data.name];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE name = $1', VALUES);
  return rows;
}

// GET person by email
module.exports.getPersonByEmail = async function getPersonByEmail(data) {
  const VALUES = [data.email];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE email = $1', VALUES);
  return rows;
}

// Create new person
module.exports.insertPerson = async function insertPerson(data) {
  const VALUES = [data.name, data.email, data.bio, data.password];
  const { rows } = await pool.query('INSERT INTO "Person" (name, email, bio, hashed_password) VALUES ($1, $2, $3, $4) RETURNING id, name, email, bio', VALUES);
  return rows; 
}
