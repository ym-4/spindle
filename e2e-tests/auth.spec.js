const { test, expect } = require('@playwright/test');
const { BASE, registerViaUI, currentUser } = require('./helpers');

// Auth feature: login / register / session guard journeys.
// Each test starts from an empty storage state so authentication is exercised through the real UI.
test.use({ storageState: { cookies: [], origins: [] } });

test.describe('Auth journeys', () => {
  test('registering a new account lands on the feed logged in', async ({ page }) => {
    await registerViaUI(page);

    await expect(page).toHaveURL(/\/index\.html$/);
    const user = await currentUser(page);
    expect(user).not.toBeNull();
    expect(user.id).toBeGreaterThan(0);
  });

  test('a returning user (Alice) can log in and reach the dashboard', async ({ page }) => {
    await page.goto('http://localhost:3000/home.html?login=1');
    await expect(page.locator('#loginForm')).toBeVisible({ timeout: 15000 });
    await page.fill('#loginUsername', 'alice@example.com');
    await page.fill('#loginPassword', 'password123');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page.locator('#verifyForm')).toBeVisible({ timeout: 15000 });
    const text = await page.locator('#authMessage').innerText();
    const code = (text.match(/Code \(dev preview\):\s*(\d{6})/) || [])[1];
    expect(code, `preview code should be shown, got: ${text}`).toBeTruthy();
    await page.fill('#verifyCode', code);
    await page.locator('#verifyForm button[type="submit"]').click();

    await expect(page).toHaveURL(/\/index\.html$/, { timeout: 15000 });
  });

  test('wrong password shows an error and keeps the user logged out', async ({ page }) => {
    await page.goto('http://localhost:3000/home.html?login=1');
    await expect(page.locator('#loginForm')).toBeVisible({ timeout: 15000 });
    await page.fill('#loginUsername', 'alice@example.com');
    await page.fill('#loginPassword', 'wrong-password');
    await page.locator('#loginForm button[type="submit"]').click();

    await expect(page.locator('#authMessage')).toContainText('Invalid username or password', {
      timeout: 15000,
    });
    const stillLoggedOut = await page.evaluate(
      () => !localStorage.getItem('token') && !localStorage.getItem('pineappleToken'),
    );
    expect(stillLoggedOut).toBe(true);
  });
});