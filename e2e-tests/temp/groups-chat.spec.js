const { test, expect } = require('@playwright/test');

// ──────────────────────────────────────────────
// Test Configuration
// ──────────────────────────────────────────────

const BASE_URL = 'http://localhost:3000';

// These must exist in your E2E/test database, and the authenticated
// test user (alice@example.com, per your seed script) MUST already
// be a member of TEST_GROUPS.joined.
const TEST_GROUPS = {
  public: 'Design Studio',
  joined: 'SOC Study Buddies',
  private: 'Applied Science Hub',
};

const PAGES = {
  schoolSelection: `${BASE_URL}/groups.html`,
  groups: `${BASE_URL}/groups_page.html`,
  feed: `${BASE_URL}/groups_feed.html`,
  admin: `${BASE_URL}/groups_admin.html`,
};

// ──────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────

// Open the Groups page for School of Computing
async function openGroupsPage(page) {
  await page.goto(PAGES.schoolSelection);

  await page.locator('#soc').click();

  await expect(page).toHaveURL(/groups_page\.html/);
  // await expect(page.locator('#school-name')).toHaveText('School of Computing');

  // Wait until groups have been rendered.
  await expect(page.locator('#popularGroupsContainer .group-card').first()).toBeVisible();
}

// Open the dedicated E2E Joined Group
async function openJoinedTestGroup(page) {
  await openGroupsPage(page);

  // Find the dedicated test group by name
  const groupCard = page.locator('.group-card').filter({ hasText: TEST_GROUPS.joined });

  await expect(groupCard).toBeVisible();

  // Open the group
  await groupCard.click();

  // Wait for the group chat page to load
  await expect(page.locator('#chatTab')).toBeVisible();
}

// ──────────────────────────────────────────────
// View messages and members
// ──────────────────────────────────────────────

test.describe('View Group Chat and members', () => {
  // Every test in this describe block uses:
  // E2E Joined Group
  //
  // The test user MUST already be a member of this group.

  test.beforeEach(async ({ page }) => {
    await openJoinedTestGroup(page);
  });

  // ──────────────────────────────────────────────
  // CHAT-01
  // ──────────────────────────────────────────────

  test('CHAT-01: User can view existing chat messages', async ({ page }) => {
    await page.locator('#chatBtn').click();

    await expect(page.locator('#message-container')).toBeVisible();

    await expect(page.locator('#message-container .msg')).not.toHaveCount(0);

    await expect(page.locator('#message-container .msg .name').first()).toBeVisible();

    await expect(page.locator('#message-container .msg .bubble').first()).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // CHAT-02
  // ──────────────────────────────────────────────

  test('CHAT-02: User can switch from General to Other Channel', async ({ page }) => {
    await expect(page.locator('#general')).toHaveClass(/active/);

    await page.locator('#resources').click();

    await expect(page.locator('#resources')).toHaveClass(/active/);

    await expect(page.locator('#general')).not.toHaveClass(/active/);
  });

  // ──────────────────────────────────────────────
  // CHAT-03
  // ──────────────────────────────────────────────

  test('CHAT-03: Chat header updates when switching channels', async ({ page }) => {
    await page.locator('#resources').click();

    await expect(page.locator('#channelHeader')).toHaveText('# resources');
  });

  // ──────────────────────────────────────────────
  // CHAT-04
  // ──────────────────────────────────────────────

  test('CHAT-04: Messages are displayed for the selected channel', async ({ page }) => {
    await page.locator('#generalChannel').click();

    await expect(page.locator('#message-container')).toBeVisible();

    const generalMessages = await page.locator('#message-container .msg').count();

    expect(generalMessages).toBeGreaterThan(0);

    await page.locator('#resources').click();

    await expect(page.locator('#message-container')).toBeVisible();

    const resourcesMessages = await page.locator('#message-container .msg').count();

    expect(resourcesMessages).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // CHAT-05
  // ──────────────────────────────────────────────

  test('CHAT-05: User can open the Group Members panel', async ({ page }) => {
    await page.locator('#membersButton').click();

    await expect(page.locator('#membersOffcanvas')).toBeVisible();

    await expect(page.locator('#membersOffcanvas .offcanvas-title')).toHaveText('Group Members');

    await expect(page.locator('#searchMemberInput')).toBeVisible();
  });

  // ──────────────────────────────────────────────
  // CHAT-06
  // ──────────────────────────────────────────────

  test('CHAT-06: Group Members panel displays members', async ({ page }) => {
    await page.locator('#membersButton').click();

    await expect(page.locator('#adminListOffcanvas')).toBeVisible();

    await expect(page.locator('#userListOffcanvas')).toBeVisible();

    const admins = await page.locator('#adminListOffcanvas').locator(':scope > *').count();

    const members = await page.locator('#userListOffcanvas').locator(':scope > *').count();

    expect(admins + members).toBeGreaterThan(0);
  });

  // ──────────────────────────────────────────────
  // CHAT-07
  // ──────────────────────────────────────────────

  test('CHAT-07: User can search for an existing member', async ({ page }) => {
    await page.locator('#membersButton').click();

    await page.locator('#searchMemberInput').fill('Beni');

    await expect(page.locator('#adminListOffcanvas, #userListOffcanvas')).toContainText('Beni');
  });

  // ──────────────────────────────────────────────
  // CHAT-08
  // ──────────────────────────────────────────────

  test('CHAT-08: Member search filters the member list', async ({ page }) => {
    await page.locator('#membersButton').click();

    await page.locator('#searchMemberInput').fill('Beni');

    const visibleMembers = page.locator('#adminListOffcanvas > *, #userListOffcanvas > *');

    const count = await visibleMembers.count();

    expect(count).toBeGreaterThan(0);

    for (let i = 0; i < count; i++) {
      await expect(visibleMembers.nth(i)).toContainText('Beni');
    }
  });

  // ──────────────────────────────────────────────
  // CHAT-09
  // ──────────────────────────────────────────────

  test('CHAT-09: Searching for a non-existent member returns no results', async ({ page }) => {
    await page.locator('#membersButton').click();

    await page.locator('#searchMemberInput').fill('ThisMemberDoesNotExist123');

    await expect(page.locator('#adminListOffcanvas > *, #userListOffcanvas > *')).toHaveCount(0);
  });

  // ──────────────────────────────────────────────
  // CHAT-10
  // ──────────────────────────────────────────────

  test('CHAT-10: Clearing member search restores the member list', async ({ page }) => {
    await page.locator('#membersButton').click();

    const memberEntries = page.locator('#adminListOffcanvas > *, #userListOffcanvas > *');

    const initialCount = await memberEntries.count();

    expect(initialCount).toBeGreaterThan(0);

    await page.locator('#searchMemberInput').fill('Beni');

    await page.locator('#searchMemberInput').fill('');

    const restoredCount = await memberEntries.count();

    expect(restoredCount).toBe(initialCount);
  });
});

// ──────────────────────────────────────────────
// Send group message
// ──────────────────────────────────────────────

test.describe('Send group message', () => {
  test.beforeEach(async ({ page }) => {
    await openJoinedTestGroup(page);

    await page.locator('#chatBtn').click();
  });

  test('User can send a chat message', async ({ page }) => {
    const messageInput = page.locator('#messageDiv input');

    const testMessage = `E2E send test ${Date.now()}`;

    await messageInput.fill(testMessage);

    await page.locator('#sendChatBtn').click();

    await expect(page.locator('#message-container')).toContainText(testMessage);
  });

  test('Message input is cleared after sending a message', async ({ page }) => {
    const messageInput = page.locator('#messageDiv input');

    const testMessage = `E2E clear test ${Date.now()}`;

    await messageInput.fill(testMessage);

    await page.locator('#sendChatBtn').click();

    await expect(page.locator('#message-container')).toContainText(testMessage);

    await expect(messageInput).toHaveValue('');
  });

  test('Sent message is displayed as the current user message', async ({ page }) => {
    const testMessage = `E2E current user test ${Date.now()}`;

    await page.locator('#messageDiv input').fill(testMessage);

    await page.locator('#sendChatBtn').click();

    const sentMessage = page
      .locator('#message-container .msg-right')
      .filter({ hasText: testMessage });

    await expect(sentMessage).toBeVisible();

    await expect(sentMessage.locator('.name')).toHaveText('You');
  });
});

// ──────────────────────────────────────────────
// Update group message
// ──────────────────────────────────────────────

test.describe('Update group message', () => {
  test.beforeEach(async ({ page }) => {
    await openJoinedTestGroup(page);

    await page.locator('#chatBtn').click();
  });

  test('User can edit a posted chat message', async ({ page }) => {
    const postedMessage = page.locator('#message-container .msg-right').first();

    await expect(postedMessage).toBeVisible();

    await postedMessage.click();

    await expect(page.locator('#messageModal')).toBeVisible();

    const updatedMessage = `E2E updated message ${Date.now()}`;

    await page.locator('#editMessageInput').fill(updatedMessage);

    await page.locator('#saveMessageBtn').click();

    await expect(page.locator('#message-container')).toContainText(updatedMessage);
  });

  test('Updated chat message replaces the original message', async ({ page }) => {
    const postedMessage = page.locator('#message-container .msg-right').first();

    await expect(postedMessage).toBeVisible();

    const originalMessage = await postedMessage.locator('.bubble').textContent();

    await postedMessage.click();

    const updatedMessage = `E2E replacement message ${Date.now()}`;

    await page.locator('#editMessageInput').fill(updatedMessage);

    await page.locator('#saveMessageBtn').click();

    await expect(page.locator('#message-container')).toContainText(updatedMessage);

    if (originalMessage) {
      await expect(page.locator('#message-container')).not.toContainText(originalMessage);
    }
  });
});

// ──────────────────────────────────────────────
// Delete group message
// ──────────────────────────────────────────────

test.describe('Delete group message', () => {
  test.beforeEach(async ({ page }) => {
    await openJoinedTestGroup(page);

    await page.locator('#chatBtn').click();
  });

  test('User can delete a posted chat message', async ({ page }) => {
    const postedMessage = page.locator('#message-container .msg-right').first();

    await expect(postedMessage).toBeVisible();

    const messageText = await postedMessage.locator('.bubble').textContent();

    await postedMessage.click();

    await expect(page.locator('#messageModal')).toBeVisible();

    await page.locator('#deleteMessageBtn').click();

    if (messageText) {
      await expect(page.locator('#message-container')).not.toContainText(messageText);
    }
  });
});
