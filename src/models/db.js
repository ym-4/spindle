const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.DATABASE_URL?.includes('sslmode=') ? { rejectUnauthorized: false } : undefined,
  max: 5,
});

pool.on('error', (err) => {
  console.error('Unexpected idle client error:', err.message);
});

module.exports = pool;
