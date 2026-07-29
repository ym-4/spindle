const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';
const API_BASE = 'http://localhost:3000';

let currentPostId;

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  currentPostId = await createTestPost(page);
  await goToPost(page, currentPostId);
});

// ── Helpers ──────────────────────────────────────────────

async function createTestPost(page, overrides = {}) {
  const userId = await page.evaluate(() => localStorage.getItem('loggedInUserId'));

  const res = await page.request.post(`${API_BASE}/posts`, {
    multipart: {
      user_id: String(userId),
      title: overrides.title || `PC E2E Seed Post ${Date.now()}`,
      category: overrides.category || 'confession',
      content: overrides.content || 'Seed post for comment e2e tests.',
    },
  });
  const body = await res.json();
  return body.id;
}

async function goToPost(page, postId) {
  await page.goto(`${API_BASE}/posts.html?id=${postId}`);
  await waitForCommentsLoaded(page);
}

// Waits for the comments fetch to finish
async function waitForCommentsLoaded(page) {
  await expect(page.locator('#commentsContainer .spinner-border')).toHaveCount(0, {
    timeout: 15000,
  });
}

function allComments(page) {
  return page.locator('.comment-item');
}

function topLevelComments(page) {
  return page.locator('.comment-item:not(.comment-reply)');
}

function replyComments(page) {
  return page.locator('.comment-item.comment-reply');
}

// Submit a new comment and wait for it to render
async function addComment(page, content) {
  await page.locator('#commentInput').fill(content);
  await page.locator('#submitCommentBtn').click();
  await expect(topLevelComments(page).filter({ hasText: content })).toBeVisible();
}

// Reply to a comment  and wait for the reply to render
async function replyToComment(page, parentLocator, content) {
  await parentLocator.locator('.reply-btn').click();
  const replyBox = parentLocator.locator('.reply-input-box');
  await expect(replyBox).toBeVisible();
  await replyBox.locator('textarea').fill(content);
  await replyBox.locator('.submit-reply-btn').click();
  await expect(replyComments(page).filter({ hasText: content })).toBeVisible();
}

// Open a comment's dropdown menu (report/edit/delete options)
async function openCommentMenu(commentLocator) {
  await commentLocator.locator('.comment-menu-btn').click();
}

// Delete a comment via its dropdown + confirm dialog
async function deleteComment(page, commentLocator) {
  await openCommentMenu(commentLocator);
  await commentLocator.locator('.delete-comment-btn').click();
  await expect(page.locator('#confirmOverlay')).toBeVisible();
  await page.locator('#confirmOkBtn').click();
}

// ── Load Comments ────────────────────────────────────────
test.describe('Load Comments', () => {
  // Valid partition: a post with no comments shows the empty state
  test('should show the empty state when a post has no comments', async ({ page }) => {
    await expect(page.locator('#commentsPlaceholder')).toBeVisible();
    await expect(page.locator('#commentsPlaceholder')).toContainText('No comments yet');
  });

  // Valid partition: existing comments render in the thread on load
  test('should show existing comments in the thread on page load', async ({ page }) => {
    await addComment(page, 'E2E Seed Comment For Load Test');

    // Re-navigate fresh to confirm the comment persisted server-side and
    // renders correctly on a brand new page load, not just optimistically in-memory
    await goToPost(page, currentPostId);

    await expect(
      topLevelComments(page).filter({ hasText: 'E2E Seed Comment For Load Test' }),
    ).toBeVisible();
  });

  // Valid partition: each comment displays author, content, and action buttons
  test('each comment should display author, content, and action buttons', async ({ page }) => {
    await addComment(page, 'E2E Comment Structure Check');

    const comment = topLevelComments(page).filter({ hasText: 'E2E Comment Structure Check' });
    await expect(comment.locator('.comment-author')).not.toHaveText('');
    await expect(comment.locator('.comment-text-display')).toContainText(
      'E2E Comment Structure Check',
    );
    await expect(comment.locator('.comment-like-btn')).toBeVisible();
    await expect(comment.locator('.comment-dislike-btn')).toBeVisible();
    await expect(comment.locator('.reply-btn')).toBeVisible();
  });
});

// ── New Comment ──────────────────────────────────────────
test.describe('New Comment', () => {
  // Valid partition: submitting a comment adds it to the thread
  test('should allow me to post a new comment', async ({ page }) => {
    await addComment(page, 'E2E New Comment Post');
  });

  // Boundary: an empty comment box keeps the submit button disabled
  test('should keep the submit button disabled until content is entered', async ({ page }) => {
    await expect(page.locator('#submitCommentBtn')).toBeDisabled();

    await page.locator('#commentInput').fill('   ');
    // whitespace-only content: updateCommentSubmitState() checks trimmed length
    await page.locator('#commentInput').fill('');
    await expect(page.locator('#submitCommentBtn')).toBeDisabled();

    await page.locator('#commentInput').fill('Real content');
    await expect(page.locator('#submitCommentBtn')).toBeEnabled();
  });

  // Boundary: special characters in a comment render as escaped text, not executed HTML
  test('should escape special characters in comment content (XSS boundary)', async ({ page }) => {
    const payload = '<b>bold</b> & "quotes"';
    await addComment(page, payload);

    const comment = topLevelComments(page).filter({ hasText: 'bold' });
    // Escaped output should show the literal tag text, not a real <b> element
    await expect(comment.locator('.comment-text-display')).toContainText('<b>bold</b>');
    await expect(comment.locator('.comment-text-display b')).toHaveCount(0);
  });
});

// ── Reply to Comment ─────────────────────────────────────
test.describe('Reply to Comment', () => {
  // Valid partition: replying to a comment nests it under the parent
  test('should allow me to reply to a comment', async ({ page }) => {
    await addComment(page, 'E2E Reply Parent Comment');
    const parent = topLevelComments(page).filter({ hasText: 'E2E Reply Parent Comment' });

    await replyToComment(page, parent, 'E2E First Level Reply');

    const group = page.locator('.comment-group').filter({ has: parent });
    await expect(
      group.locator('.comment-item.comment-reply').filter({ hasText: 'E2E First Level Reply' }),
    ).toBeVisible();
  });

  // Valid partition: cancelling a reply discards it without posting
  test('cancelling a reply should discard it', async ({ page }) => {
    await addComment(page, 'E2E Cancel Reply Parent');
    const parent = topLevelComments(page).filter({ hasText: 'E2E Cancel Reply Parent' });

    await parent.locator('.reply-btn').click();
    const replyBox = parent.locator('.reply-input-box');
    await expect(replyBox).toBeVisible();
    await replyBox.locator('textarea').fill('This reply should never be posted');
    await replyBox.locator('.cancel-reply-btn').click();

    await expect(replyBox).toHaveCount(0);
    await expect(
      replyComments(page).filter({ hasText: 'This reply should never be posted' }),
    ).toHaveCount(0);
  });

  // Boundary: multiple replies to the same comment all appear, correctly nested
  test('multiple replies to the same comment should all appear nested under it', async ({
    page,
  }) => {
    await addComment(page, 'E2E Multi Reply Parent');
    const parent = topLevelComments(page).filter({ hasText: 'E2E Multi Reply Parent' });

    await replyToComment(page, parent, 'E2E Reply Number One');
    // Re-fetch the parent locator since the DOM was rebuilt after the reload
    const parentAgain = topLevelComments(page).filter({ hasText: 'E2E Multi Reply Parent' });
    await replyToComment(page, parentAgain, 'E2E Reply Number Two');

    const group = page.locator('.comment-group').filter({ has: parentAgain });
    await expect(group.locator('.comment-item.comment-reply')).toHaveCount(2);
  });
});

// ── Edit Comment ─────────────────────────────────────────
test.describe('Edit Comment', () => {
  // Valid partition: owner edits their comment and the change persists
  test('should allow the comment owner to edit their comment', async ({ page }) => {
    await addComment(page, 'E2E Edit Original Comment');
    const comment = topLevelComments(page).filter({ hasText: 'E2E Edit Original Comment' });

    await openCommentMenu(comment);
    await comment.locator('.edit-comment-btn').click();
    await expect(comment.locator('.comment-edit-form')).toBeVisible();

    await comment.locator('.comment-edit-input').fill('E2E Edit Updated Comment');
    await comment.locator('.save-edit-comment-btn').click();

    await expect(
      topLevelComments(page)
        .filter({ hasText: 'E2E Edit Updated Comment' })
        .locator('.comment-text-display'),
    ).toContainText('E2E Edit Updated Comment');
  });

  // Error handling: cancelling an edit discards the change
  test('cancelling an edit should discard changes', async ({ page }) => {
    await addComment(page, 'E2E Cancel Edit Comment');
    const comment = topLevelComments(page).filter({ hasText: 'E2E Cancel Edit Comment' });

    await openCommentMenu(comment);
    await comment.locator('.edit-comment-btn').click();
    await comment.locator('.comment-edit-input').fill('This should never be saved');
    await comment.locator('.cancel-edit-comment-btn').click();

    await expect(comment.locator('.comment-edit-form')).toBeHidden();
    await expect(comment.locator('.comment-text-display')).toContainText('E2E Cancel Edit Comment');
    await expect(comment.locator('.comment-text-display')).not.toContainText(
      'This should never be saved',
    );
  });

  // Boundary: clearing the content blocks save (empty-string boundary)
  test('should block saving when the edit is cleared to empty', async ({ page }) => {
    await addComment(page, 'E2E Empty Edit Check');
    const comment = topLevelComments(page).filter({ hasText: 'E2E Empty Edit Check' });

    await openCommentMenu(comment);
    await comment.locator('.edit-comment-btn').click();

    let dialogMessage = '';
    page.once('dialog', async (dialog) => {
      dialogMessage = dialog.message();
      await dialog.accept();
    });

    await comment.locator('.comment-edit-input').fill('');
    await comment.locator('.save-edit-comment-btn').click();

    await expect.poll(() => dialogMessage).toContain('Comment cannot be empty.');
    await expect(comment.locator('.comment-edit-form')).toBeVisible();
  });
});

// ── Delete Comment ───────────────────────────────────────
test.describe('Delete Comment', () => {
  // Valid partition: deleting a comment removes it, other comments remain
  test('should allow me to delete a comment, leaving other comments intact', async ({ page }) => {
    await addComment(page, 'E2E Keep This Comment');
    await addComment(page, 'E2E Delete This Comment');

    const target = topLevelComments(page).filter({ hasText: 'E2E Delete This Comment' });
    await deleteComment(page, target);

    await expect(topLevelComments(page).filter({ hasText: 'E2E Delete This Comment' })).toHaveCount(
      0,
    );
    await expect(topLevelComments(page).filter({ hasText: 'E2E Keep This Comment' })).toBeVisible();
  });

  // Error handling: cancelling the delete confirmation keeps the comment
  test('cancelling the delete confirmation should keep the comment', async ({ page }) => {
    await addComment(page, 'E2E Cancel Delete Comment');
    const comment = topLevelComments(page).filter({ hasText: 'E2E Cancel Delete Comment' });

    await openCommentMenu(comment);
    await comment.locator('.delete-comment-btn').click();
    await expect(page.locator('#confirmOverlay')).toBeVisible();

    await page.locator('#confirmCancelBtn').click();

    await expect(page.locator('#confirmOverlay')).toBeHidden();
    await expect(
      topLevelComments(page).filter({ hasText: 'E2E Cancel Delete Comment' }),
    ).toBeVisible();
  });

  // Boundary: deleting a reply removes only that reply, not its parent or siblings
  test('deleting a reply should remove only that reply, not its parent or sibling replies', async ({
    page,
  }) => {
    await addComment(page, 'E2E Reply Delete Parent');
    const parent = topLevelComments(page).filter({ hasText: 'E2E Reply Delete Parent' });

    await replyToComment(page, parent, 'E2E Reply To Keep');
    const parentAgain = topLevelComments(page).filter({ hasText: 'E2E Reply Delete Parent' });
    await replyToComment(page, parentAgain, 'E2E Reply To Delete');

    const group = page.locator('.comment-group').filter({ has: parentAgain });
    const replyToDelete = group.locator('.comment-item.comment-reply').filter({
      hasText: 'E2E Reply To Delete',
    });

    await deleteComment(page, replyToDelete);

    await expect(
      group.locator('.comment-item.comment-reply').filter({ hasText: 'E2E Reply To Delete' }),
    ).toHaveCount(0);
    await expect(
      group.locator('.comment-item.comment-reply').filter({ hasText: 'E2E Reply To Keep' }),
    ).toBeVisible();
    await expect(
      topLevelComments(page).filter({ hasText: 'E2E Reply Delete Parent' }),
    ).toBeVisible();
  });
});

// ── PandaBot Auto-Reply ──────────────────────────────────
test.describe('PandaBot Auto-Reply', () => {
  // Valid partition: mentioning @pandabot in a top-level comment triggers a threaded bot reply
  test('should get a PandaBot reply when a comment mentions @pandabot', async ({ page }) => {
    await addComment(page, 'hey @pandabot what do you think about this?');
    const trigger = topLevelComments(page).filter({
      hasText: 'hey @pandabot what do you think about this?',
    });

    const group = page.locator('.comment-group').filter({ has: trigger });
    await expect(group.locator('.comment-item.comment-reply.pandabot-comment')).toBeVisible({
      timeout: 20000,
    });
  });

  // Valid partition: mentioning @pandabot inside a REPLY still threads the bot's
  // reply flat under the original parent, not double-nested under the reply
  test('should thread the PandaBot reply flat under the parent when mentioned in a reply', async ({
    page,
  }) => {
    await addComment(page, 'E2E PandaBot Reply Thread Parent');
    const parent = topLevelComments(page).filter({
      hasText: 'E2E PandaBot Reply Thread Parent',
    });

    await replyToComment(page, parent, 'following up @pandabot any thoughts?');

    const parentAgain = topLevelComments(page).filter({
      hasText: 'E2E PandaBot Reply Thread Parent',
    });
    const group = page.locator('.comment-group').filter({ has: parentAgain });

    await expect(group.locator('.comment-item.comment-reply.pandabot-comment')).toBeVisible({
      timeout: 20000,
    });
  });

  // Boundary: PandaBot's own comment renders with distinct bot styling
  test("PandaBot's reply should render with bot-specific avatar and name badge", async ({
    page,
  }) => {
    await addComment(page, 'quick one for @pandabot here');
    const trigger = topLevelComments(page).filter({ hasText: 'quick one for @pandabot here' });
    const group = page.locator('.comment-group').filter({ has: trigger });

    const botReply = group.locator('.comment-item.comment-reply.pandabot-comment');
    await expect(botReply).toBeVisible({ timeout: 20000 });
    await expect(botReply.locator('.comment-avatar')).toContainText('🐼');
    await expect(botReply.locator('.comment-author.pandabot-name')).toBeVisible();
    await expect(botReply.locator('.bot-badge')).toContainText('Generated by PandaBot');
  });
});
