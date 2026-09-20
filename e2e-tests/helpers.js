// Shared helpers for PineapplePizza E2E specs.
// @ts-check
const { expect } = require('@playwright/test');

const BASE = 'http://localhost:3000';

/** Extract the 6-digit dev-preview code from the auth message element. */
async function readPreviewCode(page) {
  const text = await page.locator('#authMessage').innerText();
  const match = text.match(/Code \(dev preview\):\s*(\d{6})/);
  if (!match) throw new Error(`No preview code found in message: ${JSON.stringify(text)}`);
  return match[1];
}

/**
 * Log a user in through the real UI (login form + 2FA code step).
 * Starts from a clean, unauthenticated state.
 */
async function loginViaUI(page, { username, password }) {
  await page.goto(`${BASE}/home.html?login=1`);
  await expect(page.locator('#loginForm')).toBeVisible({ timeout: 15000 });
  await page.fill('#loginUsername', username);
  await page.fill('#loginPassword', password);
  await page.locator('#loginForm button[type="submit"]').click();

  await expect(page.locator('#verifyForm')).toBeVisible({ timeout: 15000 });
  const code = await readPreviewCode(page);
  await page.fill('#verifyCode', code);
  await page.locator('#verifyForm button[type="submit"]').click();

  await page.waitForURL(/\/index\.html$/, { timeout: 15000 });
}

/**
 * Register a brand-new user through the UI (register form + verify step).
 * Returns a unique username/email used, for later reference.
 */
async function registerViaUI(page) {
  const stamp = Date.now();
  const name = `e2e_user_${stamp}`;
  const email = `e2e_user_${stamp}@gmail.com`;
  const password = 'password123';

  await page.goto(`${BASE}/home.html?login=1&tab=register`);
  await expect(page.locator('#registerForm')).toBeVisible({ timeout: 15000 });
  await page.fill('#registerName', name);
  await page.fill('#registerEmail', email);
  await page.selectOption('#registerCountry', 'Singapore');
  await page.fill('#registerPassword', password);
  await page.locator('#registerForm button[type="submit"]').click();

  await expect(page.locator('#verifyForm')).toBeVisible({ timeout: 15000 });
  const code = await readPreviewCode(page);
  await page.fill('#verifyCode', code);
  await page.locator('#verifyForm button[type="submit"]').click();

  await page.waitForURL('**/index.html', { timeout: 15000 });

  const token = await page.evaluate(() => localStorage.getItem('token'));
  expect(token).toBeTruthy();
  const id = await page.evaluate(() => Number(localStorage.getItem('loggedInUserId')));
  expect(id).toBeGreaterThan(0);
  return { name, email, id, token };
}

/** Assert whether or not the current page has a stored session. */
async function currentUser(page) {
  return page.evaluate(() => {
    const token =
      localStorage.getItem('token') ||
      localStorage.getItem('pineappleToken') ||
      sessionStorage.getItem('token');
    const id = localStorage.getItem('loggedInUserId') || sessionStorage.getItem('loggedInUserId');
    return token && id ? { id: Number(id), token } : null;
  });
}

/** Register a brand-new user through the API and return { id, token }. */
async function registerViaAPI(request) {
  const stamp = Date.now();
  const name = `api_user_${stamp}`;
  const email = `api_user_${stamp}@gmail.com`;

  const reg = await request.post(`${BASE}/auth/register`, {
    data: { name, email, password: 'password123' },
  });
  expect(reg.status()).toBe(201);
  const regData = await reg.json();
  expect(regData.needsVerification).toBe(true);

  const verify = await request.post(`${BASE}/auth/verify-email`, {
    data: { email: regData.email, code: regData.previewCode },
  });
  expect(verify.status()).toBe(200);
  const { user, token } = await verify.json();
  return { id: user.id, token, email, name };
}

/** Register then log in a brand-new user through the API, returning { id, token }. */
async function loginViaAPI(request, { email }) {
  const login = await request.post(`${BASE}/auth/login`, {
    data: { username: email, password: 'password123' },
  });
  const loginData = await login.json();
  expect(loginData.needs2FA).toBe(true);
  const verify = await request.post(`${BASE}/auth/verify-login`, {
    data: { email: loginData.email, code: loginData.previewCode },
  });
  expect(verify.status()).toBe(200);
  const { user, token } = await verify.json();
  return { id: user.id, token };
}

module.exports = {
  BASE,
  loginViaUI,
  readPreviewCode,
  registerViaUI,
  registerViaAPI,
  loginViaAPI,
  currentUser,
};
