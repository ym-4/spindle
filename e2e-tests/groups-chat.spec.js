const { test, expect } = require('@playwright/test');

// ============================================================
// Configuration
// ============================================================

const BASE_URL = 'http://localhost:3000';

const PAGES = {
  schoolSelection: `${BASE_URL}/groups.html`,
  groups: `${BASE_URL}/groups_page.html`,
  feed: `${BASE_URL}/groups_feed.html`,
  admin: `${BASE_URL}/groups_admin.html`,
};

// ============================================================
// Helpers
// ============================================================

async function openGroupsPage(page) {
  await page.goto(PAGES.schoolSelection);

  await page.locator('#soc').click();

  await expect(page).toHaveURL(/groups_page\.html/);
  // await expect(page.locator('#school-name')).toHaveText('School of Computing');

  // Wait until groups have been rendered.
  await expect(page.locator('#popularGroupsContainer .group-card').first()).toBeVisible();
}

async function openGroupFeed(page) {
  // Open groups page and select the school
  await openGroupsPage(page);

  // Wait for joined groups to load
  await expect(page.locator('#joinedGroupsContainer .group-card').first()).toBeVisible();

  // Open first joined group
  const joinedGroup = page.locator('#joinedGroupsContainer .group-card').first();

  await joinedGroup.click();

  // User should be redirected to group feed
  await expect(page).toHaveURL(/groups_feed\.html/);

  // Wait for group feed
  await expect(page.locator('#content-area')).toBeVisible();
}

test.describe('Group Chat', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupFeed(page);
  });

  test('View chat', async ({ page }) => {
    await expect(page.locator('#channelHeader')).toHaveText('# general');

    await expect(page.locator('#message-container')).toBeVisible();

    await expect(page.locator('#sendChatBtn')).toBeVisible();
  });

  //   test('Can type a message', async ({ page }) => {
  //     const input = page.locator('#messageInput');

  //     await input.fill('Hello everyone!');

  //     await expect(input).toHaveValue('Hello everyone!');
  //   });

  //   test('send button exists', async ({ page }) => {
  //     await expect(page.locator('#sendChatBtn')).toBeVisible();
  //     await expect(page.locator('#sendChatBtn')).toBeEnabled();
  //   });

  test('Can send message', async ({ page }) => {
    const input = page.locator('#messageInput');

    await input.fill('Playwright test message');

    await page.locator('#sendChatBtn').click();

    await expect(input).toHaveValue('');

    await expect(page.locator('#message-container')).toContainText('Playwright test message');
  });

  //   test('message input clears after sending', async ({ page }) => {
  //     const input = page.locator('#messageDiv input');

  //     await input.fill('Testing clear');

  //     await page.locator('#sendChatBtn').click();

  //     await expect(input).toHaveValue('');
  //   });

  //   test('cannot send an empty message', async ({ page }) => {
  //     const messagesBefore = await page.locator('.msg').count();

  //     await page.locator('#sendChatBtn').click();

  //     const messagesAfter = await page.locator('.msg').count();

  //     expect(messagesAfter).toBe(messagesBefore);
  //   });

  //   test('channel list is visible', async ({ page }) => {
  //     await expect(page.locator('#generalChannel')).toBeVisible();
  //     await expect(page.locator('#resources')).toBeVisible();
  //   });

  test('switching channels changes active class', async ({ page }) => {
    await page.locator('#resources').click();

    await expect(page.locator('#resources')).toHaveClass(/active/);
  });

  //   test('message container scrolls', async ({ page }) => {
  //     const container = page.locator('#message-container');

  //     await expect(container).toBeVisible();

  //     const overflow = await container.evaluate((el) => window.getComputedStyle(el).overflowY);

  //     expect(['auto', 'scroll']).toContain(overflow);
  //   });
});

// ============================================================
// EDIT AND DELETE MESSAGE TESTS
// ============================================================

test.describe('Edit and Delete Messages', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupFeed(page);
  });

  test('user can edit a message', async ({ page }) => {
    const originalMessage = 'Original Playwright message';
    const updatedMessage = 'Updated Playwright message';

    const input = page.locator('#messageInput');

    await input.fill('Original Playwright message');

    await page.locator('#sendChatBtn').click();

    await expect(input).toHaveValue('');

    await expect(page.locator('#message-container')).toContainText('Original Playwright message');

    // Find the message
    const message = page.locator('.msg').filter({
      hasText: originalMessage,
    });

    await expect(message).toBeVisible();

    // Click edit button
    await message.click();

    // Edit input/modal
    await expect(page.locator('#messageModal')).toBeVisible();

    await page.locator('#editMessageInput').fill(updatedMessage);

    await page.locator('#saveMessageBtn').click();

    // Close modal
    await page.mouse.click(100, 100);

    // Modal closes
    await expect(page.locator('#messageModal')).toBeHidden();

    // Updated message appears
    await expect(
      page.locator('.msg').filter({
        hasText: updatedMessage,
      }),
    ).toBeVisible();

    // Original text no longer exists
    await expect(
      page.locator('.msg').filter({
        hasText: originalMessage,
      }),
    ).toHaveCount(0);
  });

  test('user can delete a message', async ({ page }) => {
    const input = page.locator('#messageInput');

    await input.fill('Delete this Playwright message');
    await page.locator('#sendChatBtn').click();

    const message = page.locator('.msg').filter({
      hasText: 'Delete this Playwright message',
    });

    await message.click();

    // Click delete
    await page.locator('#deleteMessageBtn').click();

    // Confirmation dialog
    // await expect(page.locator('#confirmDeleteModal')).toBeVisible();

    // await page.locator('#confirmDeleteBtn').click();

    // await expect(page.locator('#confirmDeleteModal')).toBeHidden();

    // Message should disappear
    await expect(
      page.locator('.msg').filter({
        hasText: 'Delete this Playwright message',
      }),
    ).toHaveCount(0);
  });
});
