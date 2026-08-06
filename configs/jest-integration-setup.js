const { execSync } = require('child_process');

module.exports = async () => {
  console.log('Running database reset for integration tests...');
  execSync('dotenv -e .env.test -- node scripts/reset.js', { stdio: 'inherit' });
  //  execSync('node scripts/reset.js', { stdio: 'inherit', env: process.env });
};
