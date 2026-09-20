const { test, expect } = require('@playwright/test');
const { BASE } = require('./helpers');

// Study Sessions feature: schedule a session, see it in the list, add a task.
// Global setup logs in Alice (id 2) and stores her session.
const SESSIONS_URL = `${BASE}/study-sessions.html`;

async function goToSessions(page) {
  await page.goto(SESSIONS_URL);
  await expect(page.locator('#btnNewSession')).toBeVisible({ timeout: 15000 });
}

async function scheduleSession(page, { title, desc = '' }) {
  await page.locator('#btnNewSession').click();
  await expect(page.locator('#ssNewSessionModal')).toBeVisible({ timeout: 10000 });
  await page.fill('#ssFormTitle', title);
  await page.fill('#ssFormDesc', desc);
  // "Now + 1 day" local datetime string, e.g. "2026-08-08T14:30".
  const dt = new Date(Date.now() + 24 * 60 * 60 * 1000);
  const pad = (n) => String(n).padStart(2, '0');
  const value = `${dt.getFullYear()}-${pad(dt.getMonth() + 1)}-${pad(dt.getDate())}T${pad(
    dt.getHours(),
  )}:${pad(dt.getMinutes())}`;
  await page.fill('#ssFormDatetime', value);
  await page.locator('#btnCreateSession').click();
  await expect(page.locator('#ssSessionList')).toContainText(title, { timeout: 10000 });
}

test.describe('Study Session journeys', () => {
  test('scheduling a session adds it to the upcoming list', async ({ page }) => {
    await goToSessions(page);
    const title = `CS1010 revision ${Date.now()}`;
    await scheduleSession(page, { title });
    await expect(page.locator('.ss-list-item').filter({ hasText: title })).toHaveCount(1);
  });

  test('opens a session detail and adds a task to its checklist', async ({ page }) => {
    await goToSessions(page);
    const title = `Task drill ${Date.now()}`;
    await scheduleSession(page, { title });

    const item = page.locator('#ssSessionList .ss-list-item').filter({ hasText: title }).first();
    await item.click();
    await expect(page.locator('#ssActive')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#ssDetailTitle')).toHaveText(title);

    // Add a task to the checklist.
    await page.locator('#btnAddTask').click();
    await expect(page.locator('#ssTaskInput')).toBeVisible();
    const taskText = `Finish chapter ${Date.now() % 1000}`;
    await page.fill('#ssTaskInput', taskText);
    await page.locator('#ssTaskSubmit').click();
    await expect(page.locator('#ssTaskList')).toContainText(taskText, { timeout: 10000 });
    await expect(page.locator('#ssTaskCount')).not.toHaveText('0');
  });

  test('persists a newly created session across a page reload', async ({ page }) => {
    await goToSessions(page);
    const title = `PersistSession ${Date.now()}`;
    await scheduleSession(page, { title });

    await page.reload();
    await expect(page.locator('#btnNewSession')).toBeVisible({ timeout: 15000 });
    await expect(page.locator('#ssSessionList')).toContainText(title, { timeout: 10000 });
  });
});
