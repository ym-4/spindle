const pool = require('./db');

module.exports.getAllPersons = async function getAllPersons() {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person"',
  );
  return rows;
};

module.exports.getPersonByID = async function getPersonByID(data) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person" WHERE id = $1',
    [data.id],
  );
  return rows;
};

module.exports.getPersonByName = async function getPersonByName(data) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person" WHERE name = $1',
    [data.name],
  );
  return rows;
};

module.exports.getPersonByEmail = async function getPersonByEmail(data) {
  const { rows } = await pool.query(
    'SELECT id, email, name, avatar FROM "Person" WHERE email = $1',
    [data.email],
  );
  return rows;
};
