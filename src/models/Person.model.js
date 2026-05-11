const pool = require('./db');

module.exports.getAllPersons = async function getAllPersons() {
  const { rows } = await pool.query('SELECT * FROM "Person"');
  return rows;
};

// GET person by id
module.exports.getPersonByID = async function getPersonByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE id = ?', VALUES);
  return rows;
};

// GET person by name 
module.exports.getPersonByName = async function getPersonByName(data) {
  const VALUES = [data.name];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE name = ?', VALUES);
  return rows;
}

// GET person by email
module.exports.getPersonByEmail = async function getPersonByEmail(data) {
  const VALUES = [data.email];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE email = ?', VALUES);
  return rows;
}

// Create new person
module.exports.insertPerson = async function insertPerson(data) {
  const VALUES = [data.name, data.email, data.avatar, data.password];
  const { rows } = await pool.query('INSERT INTO "Person" (name, email, avatar, password) VALUES (?, ?, ?, ?)', VALUES);
  return rows; 
}

