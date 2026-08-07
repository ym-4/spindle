const { test, expect } = require('@playwright/test');
const { BASE } = require('./helpers');

// Chats feature: send a message, see it in the thread + preview, persistence across reload.
// Global setup logs in Alice; seed creates an Alice<->Bob friendship and one message.
const CHAT_URL = `${BASE}/chat.html`;

async function goToChats(page) {
  await page.goto(CHAT_URL);
  await expect(page.locator('#chatContactList')).toBeVisible({ timeout: 15000 });
}

test.describe('Chats journeys', () => {
  test('opens an existing conversation and shows its message history', async ({ page }) => {
    await goToChats(page);

    // Seed includes Alice -> Bob "Hey Bob! Want to study together?"
    const bob = page.locator('#chatContactList li.wa-list-item').filter({ hasText: 'Bob' }).first();
    await expect(bob).toBeVisible({ timeout: 10000 });
    await bob.click();

    await expect(page.locator('#chatActive')).toBeVisible({ timeout: 10000 });
    await expect(page.locator('#chatMessages')).toContainText('Hey Bob! Want to study together?', {
      timeout: 10000,
    });
  });

  test('sending a message shows it in the thread and preview', async ({ page }) => {
    await goToChats(page);

    const bob = page.locator('#chatContactList li.wa-list-item').filter({ hasText: 'Bob' }).first();
    await bob.click();
    await expect(page.locator('#chatInput')).toBeVisible({ timeout: 10000 });

    const text = `E2E hello ${Date.now()}`;
    await page.fill('#chatInput', text);
    await page.locator('#btnSend').click();

    // Own bubble appears in the open thread.
    await expect(
      page.locator('#chatMessages .wa-bubble-row--out').filter({ hasText: text }),
    ).toContainText(text, { timeout: 10000 });
    // Sidebar preview updates to "You: <text>".
    await expect(
      page
        .locator('#chatContactList li.wa-list-item')
        .filter({ hasText: 'Bob' })
        .locator('.wa-chat-preview'),
    ).toContainText(`You: ${text}`, { timeout: 10000 });
  });

  test('message history persists after reloading the chat page', async ({ page }) => {
    await goToChats(page);

    const bob = page.locator('#chatContactList li.wa-list-item').filter({ hasText: 'Bob' }).first();
    await bob.click();
    await expect(page.locator('#chatInput')).toBeVisible({ timeout: 10000 });

    const text = `persist me ${Date.now()}`;
    await page.fill('#chatInput', text);
    await page.locator('#btnSend').click();
    await expect(
      page.locator('#chatMessages .wa-bubble-row--out').filter({ hasText: text }),
    ).toContainText(text, { timeout: 10000 });

    // Reload and reopen the conversation — the server history should contain the message.
    await page.reload();
    await expect(page.locator('#chatContactList')).toBeVisible({ timeout: 15000 });
    await page
      .locator('#chatContactList li.wa-list-item')
      .filter({ hasText: 'Bob' })
      .first()
      .click();
    await expect(page.locator('#chatMessages')).toContainText(text, { timeout: 10000 });
  });
});