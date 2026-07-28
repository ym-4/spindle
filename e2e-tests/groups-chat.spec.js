const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';

// Helpers
test.beforeEach(async ({ page }) => {
  await page.goto(url);
});

// ------------------------------------------
// View messages
// ------------------------------------------

test.describe('View Group Chat and members', () => {
  test.beforeEach(async ({ page }) => {
    // Change this URL to the actual URL for your group feed page.
    await page.goto('/groups_feed.html');

    // If your application requires login, handle authentication
    // using your existing Playwright storage state or login fixture.
    await expect(page.locator('#chatTab')).toBeVisible();
  });

  // User can see chat message
  test('CHAT-01: User can view existing chat messages', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    // Verify chat area is visible
    await expect(page.locator('#message-container')).toBeVisible();

    // Verify existing messages are displayed
    await expect(page.locator('#message-container .msg')).not.toHaveCount(0);

    // Verify at least one message has a sender
    await expect(page.locator('#message-container .msg .name').first()).toBeVisible();

    // Verify at least one message has message content
    await expect(page.locator('#message-container .msg .bubble').first()).toBeVisible();
  });

  // User can switch channels
  test('CHAT-02: User can switch from General to Resources channel', async ({ page }) => {
    // Verify General is initially selected
    await expect(page.locator('#generalChannel')).toHaveClass(/active/);

    // Click Assignment Help
    await page.locator('#resources').click();

    // Verify Assignment Help is now active
    await expect(page.locator('#resources')).toHaveClass(/active/);

    // Verify General is no longer active
    await expect(page.locator('#generalChannel')).not.toHaveClass(/active/);
  });

  // Header channels after switching channel
  test('CHAT-03: Chat header updates when switching channels', async ({ page }) => {
    // Click Assignment Help channel
    await page.locator('#assignmentChannel').click();

    // Verify the chat header changes
    await expect(page.locator('#channelHeader')).toHaveText('# assignment-help');
  });

  // Messages change depending on channel
  test('CHAT-04: Messages are displayed for the selected channel', async ({ page }) => {
    // Start on General
    await page.locator('#generalChannel').click();

    // Verify messages are visible
    await expect(page.locator('#message-container')).toBeVisible();

    const generalMessages = await page.locator('#message-container .msg').count();

    expect(generalMessages).toBeGreaterThan(0);

    // Switch channel
    await page.locator('#assignmentChannel').click();

    // Verify message container remains visible
    await expect(page.locator('#message-container')).toBeVisible();

    // Verify messages are displayed
    const assignmentMessages = await page.locator('#message-container .msg').count();

    expect(assignmentMessages).toBeGreaterThan(0);
  });

  // Can open group members panel
  test('CHAT-05: User can open the Group Members panel', async ({ page }) => {
    // Click Members button
    await page.locator('#membersButton').click();

    // Verify Members panel is visible
    await expect(page.locator('#membersOffcanvas')).toBeVisible();

    // Verify title
    await expect(page.locator('#membersOffcanvas .offcanvas-title')).toHaveText('Group Members');

    // Verify member search field is visible
    await expect(page.locator('#searchMemberInput')).toBeVisible();
  });

  // Can see group members
  test('CHAT-06: Group Members panel displays members', async ({ page }) => {
    // Open Members panel
    await page.locator('#membersButton').click();

    // Verify member lists are visible
    await expect(page.locator('#adminListOffcanvas')).toBeVisible();
    await expect(page.locator('#userListOffcanvas')).toBeVisible();

    // Verify at least one admin/member is displayed
    const admins = await page.locator('#adminListOffcanvas').locator(':scope > *').count();

    const members = await page.locator('#userListOffcanvas').locator(':scope > *').count();

    expect(admins + members).toBeGreaterThan(0);
  });

  // Can search for members
  test('CHAT-07: User can search for an existing member', async ({ page }) => {
    // Open Members panel
    await page.locator('#membersButton').click();

    // Search for Alex
    await page.locator('#searchMemberInput').fill('Alex');

    // Verify Alex is displayed
    await expect(page.locator('#adminListOffcanvas, #userListOffcanvas')).toContainText('Alex');
  });

  // Searching filters member list
  test('CHAT-08: Member search filters the member list', async ({ page }) => {
    // Open Members panel
    await page.locator('#membersButton').click();

    // Search for Alex
    await page.locator('#searchMemberInput').fill('Alex');

    // Check all visible member entries
    const visibleMembers = page.locator('#adminListOffcanvas > *, #userListOffcanvas > *');

    const count = await visibleMembers.count();

    expect(count).toBeGreaterThan(0);

    // Every visible result should contain Alex
    for (let i = 0; i < count; i++) {
      await expect(visibleMembers.nth(i)).toContainText('Alex');
    }
  });

  // Search for non existent member nothing shows up
  test('CHAT-09: Searching for a non-existent member returns no results', async ({ page }) => {
    // Open Members panel
    await page.locator('#membersButton').click();

    // Search for member who does not exist
    await page.locator('#searchMemberInput').fill('ThisMemberDoesNotExist123');

    // Verify no member entries are displayed
    await expect(page.locator('#adminListOffcanvas > *, #userListOffcanvas > *')).toHaveCount(0);
  });

  // Clearing search shows all members
  test('CHAT-10: Clearing member search restores the member list', async ({ page }) => {
    // Open Members panel
    await page.locator('#membersButton').click();

    // Count members before searching
    const initialCount = await page
      .locator('#adminListOffcanvas > *, #userListOffcanvas > *')
      .count();

    expect(initialCount).toBeGreaterThan(0);

    // Search for a specific member
    await page.locator('#searchMemberInput').fill('Alex');

    // Clear search
    await page.locator('#searchMemberInput').fill('');

    // Count members again
    const restoredCount = await page
      .locator('#adminListOffcanvas > *, #userListOffcanvas > *')
      .count();

    // Verify member list has been restored
    expect(restoredCount).toBe(initialCount);
  });
});

// ------------------------------------------
// Post message
// ------------------------------------------
test.describe('Send group message', () => {
  // user can send message
  test('User can send a chat message', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    // Locate the message input
    const messageInput = page.locator('#messageDiv input');

    // Enter a message
    const testMessage = 'Hello, this is an E2E test message';

    await messageInput.fill(testMessage);

    // Click Send
    await page.locator('#sendChatBtn').click();

    // Verify the sent message appears in the chat
    await expect(page.locator('#message-container')).toContainText(testMessage);
  });

  // message input is empty after sending
  test('Message input is cleared after sending a message', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    const messageInput = page.locator('#messageDiv input');

    // Enter message
    await messageInput.fill('Test message');

    // Send message
    await page.locator('#sendChatBtn').click();

    // Verify message was sent
    await expect(page.locator('#message-container')).toContainText('Test message');

    // Verify input is cleared
    await expect(messageInput).toHaveValue('');
  });

  // check that message is shown as user's message
  test('Sent message is displayed as the current user message', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    const testMessage = 'This message was sent by me';

    // Enter and send message
    await page.locator('#messageDiv input').fill(testMessage);

    await page.locator('#sendChatBtn').click();

    // Find the sent message
    const sentMessage = page
      .locator('#message-container .msg-right')
      .filter({ hasText: testMessage });

    // Verify it is displayed as a right-aligned/current-user message
    await expect(sentMessage).toBeVisible();

    // Verify sender is "You"
    await expect(sentMessage.locator('.name')).toHaveText('You');
  });
});

// ------------------------------------------
// Update posted message
// ------------------------------------------
test.describe('Update group message', () => {
  // Can edit message sent
  test('User can edit a posted chat message', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    // Find a message posted by the current user
    const postedMessage = page.locator('#message-container .msg-right').first();

    // Open message options
    await postedMessage.click();

    // Verify Message Options modal opens
    await expect(page.locator('#messageModal')).toBeVisible();

    // Enter updated message
    const updatedMessage = 'This chat message has been updated';

    await page.locator('#editMessageInput').fill(updatedMessage);

    // Save changes
    await page.locator('#saveMessageBtn').click();

    // Verify updated message is displayed
    await expect(page.locator('#message-container')).toContainText(updatedMessage);
  });

  // Check message is updated
  test('Updated chat message replaces the original message', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    // Find the current user's message
    const postedMessage = page.locator('#message-container .msg-right').first();

    // Get the original message text
    const originalMessage = await postedMessage.locator('.bubble').textContent();

    // Open message options
    await postedMessage.click();

    // Update message
    const updatedMessage = 'Updated message for E2E testing';

    await page.locator('#editMessageInput').fill(updatedMessage);

    // Save changes
    await page.locator('#saveMessageBtn').click();

    // Verify updated message is visible
    await expect(page.locator('#message-container')).toContainText(updatedMessage);

    // Verify original message is no longer visible
    if (originalMessage) {
      await expect(page.locator('#message-container')).not.toContainText(originalMessage);
    }
  });
});

// ------------------------------------------
// Delete posted message
// ------------------------------------------
test.describe('Delete group message', () => {
  // can delete message
  test('User can delete a posted chat message', async ({ page }) => {
    // Make sure Chat tab is active
    await page.locator('#chatBtn').click();

    // Find the current user's posted message
    const postedMessage = page.locator('#message-container .msg-right').first();

    // Get the message text before deleting
    const messageText = await postedMessage.locator('.bubble').textContent();

    // Open message options
    await postedMessage.click();

    // Verify Message Options modal is visible
    await expect(page.locator('#messageModal')).toBeVisible();

    // Click Delete
    await page.locator('#deleteMessageBtn').click();

    // Verify the message is no longer displayed
    if (messageText) {
      await expect(page.locator('#message-container')).not.toContainText(messageText);
    }
  });
});
