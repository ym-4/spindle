const pool = require('./db');

<<<<<<< HEAD
// Get all Person
=======
>>>>>>> 89177896b8afb5d8353af503dfd1b131ec4c0fbc
module.exports.getAllPersons = async function getAllPersons() {
  const { rows } = await pool.query('SELECT * FROM "Person"');
  return rows;
};
<<<<<<< HEAD

// GET person by id
module.exports.getPersonByID = async function getPersonByID(data) {
  const VALUES = [data.id];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE id = ?', VALUES);
  return rows;
};

// GET person by Name
module.exports.getPersonByName = async function getPersonByName(data) {
  const VALUES = [data.name];
  const { rows } = await pool.query('SELECT * FROM "Person" WHERE name = ?', VALUES);
  return rows;
};

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
=======
>>>>>>> 89177896b8afb5d8353af503dfd1b131ec4c0fbc
