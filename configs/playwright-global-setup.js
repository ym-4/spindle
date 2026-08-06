const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const BASE_URL = 'http://localhost:3000';
const STORAGE_STATE_PATH = path.join(__dirname, '../e2e-tests/storageState.json');

const TEST_USER = { username: 'alice@example.com', password: 'password123' };

module.exports = async () => {
  console.log('Setting environment to test');
  console.log('Running migrations for test environment...');
  execSync('dotenv -e .env.test -- node scripts/reset.js', { stdio: 'inherit' });
  // execSync('node scripts/reset.js', { stdio: 'inherit', env: process.env });

  console.log('Logging in test user...');
  const loginRes = await fetch(`${BASE_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(TEST_USER),
  });

  if (!loginRes.ok) {
    throw new Error(`Global setup login failed: ${loginRes.status} ${await loginRes.text()}`);
  }

  const loginData = await loginRes.json();
  let user, token;

  if (loginData.needs2FA) {
    // 2fa step verification
    const verifyRes = await fetch(`${BASE_URL}/auth/verify-login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: loginData.email, code: loginData.previewCode }),
    });

    if (!verifyRes.ok) {
      throw new Error(
        `Global setup 2FA verify failed: ${verifyRes.status} ${await verifyRes.text()}`,
      );
    }

    ({ user, token } = await verifyRes.json());
  } else {
    ({ user, token } = loginData);
  }

  const storageState = {
    cookies: [],
    origins: [
      {
        origin: BASE_URL,
        localStorage: [
          { name: 'token', value: token },
          { name: 'loggedInUserId', value: String(user.id) },
        ],
      },
    ],
  };

  fs.writeFileSync(STORAGE_STATE_PATH, JSON.stringify(storageState, null, 2));
  console.log('Saved authenticated storageState for', user.email || TEST_USER.username);
};
