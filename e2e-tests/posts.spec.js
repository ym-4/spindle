const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';

const NEW_POSTS = [
  { title: 'E2E Test Post 1', content: 'This is the 1st automated test post.' },
  { title: 'E2E Test Post 2', content: 'This is the 2nd automated test post.' },
  { title: 'E2E Test Delete Post', content: 'This post exists only to be deleted.' },
  { title: 'E2E Test Post Category A', content: 'Content for the category A test.' },
  { title: 'E2E Test Post Category B', content: 'Content for the category B test.' },
  { title: 'E2E Test Post Remains', content: 'This post should remain after another is deleted.' },
];

// valid category values
const CATEGORIES = ['confession', 'qna'];

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
  await waitForFeedLoaded(page);
});

function postCards(page) {
  return page.locator('.post-card').filter({ has: page.locator('.post-author-name') });
}

// Waits for the feed's initial fetch to complete
async function waitForFeedLoaded(page) {
  await expect(page.locator('#postsContainer .spinner-border')).toHaveCount(0, { timeout: 15000 });
}

// Fill in the create-post modal and submit a new post
async function addPost(page, { title, content, category = CATEGORIES[0] }) {
  await page.locator('.create-post-input').click();
  await expect(page.locator('#createPostModal')).toBeVisible();
  await page.locator('#postTitle').fill(title);
  await page.locator('#postCategory').selectOption(category);
  await page.locator('#createPostModal .ql-editor').fill(content);
  await page.locator('#submitPostBtn').click();
  await expect(page.locator('#createPostModal')).toBeHidden();
  await expect(postCards(page).filter({ hasText: title })).toBeVisible();
}

// Delete a post by its title via the dropdown menu + confirm dialog
async function deletePost(page, title) {
  const card = postCards(page).filter({ hasText: title });
  await card.locator('.post-menu-btn').click();
  await card.locator('.delete-post-btn').click();
  await expect(page.locator('#confirmOverlay')).toBeVisible();
  await page.locator('#confirmOkBtn').click();
  await expect(postCards(page).filter({ hasText: title })).toHaveCount(0);
}

// From the feed, open a post's dropdown and click "Edit post", landing on posts.html?id=<id>&edit=true with the edit mode open
async function goToEditPage(page, title) {
  const card = postCards(page).filter({ hasText: title });
  await card.locator('.post-menu-btn').click();
  await card.locator('.edit-post-btn').click();
  await expect(page).toHaveURL(/posts\.html\?id=\d+&edit=true/);
  await expect(page.locator('#editTitle')).toBeVisible();
}

// ── Page load ────────────────────────────────────────────
test.describe('Page load', () => {
  // Valid partition: the feed container is visible on load
  test('should display the posts feed container', async ({ page }) => {
    await expect(page.locator('#postsContainer')).toBeVisible();
  });

  // Valid partition: a logged-in user sees the create-post entry point
  test('should display the create-post input for a logged-in user', async ({ page }) => {
    await expect(page.locator('.create-post-input')).toBeVisible();
  });
});

// ── Load Posts ───────────────────────────────────────────
test.describe('Load Posts', () => {
  // Valid partition: existing posts appear in the feed on page load
  test('should show existing post cards in the feed on page load', async ({ page }) => {
    const cards = postCards(page);
    await cards.first().waitFor();
    const count = await cards.count();
    expect(count).toBeGreaterThan(0);
  });

  // Valid partition: each post card has the expected structure
  test('each post card should display author, content, and action buttons', async ({ page }) => {
    const firstCard = postCards(page).first();
    await firstCard.waitFor();
    await expect(firstCard.locator('.post-author-name')).not.toHaveText('');
    await expect(firstCard.locator('.post-content')).toBeVisible();
    await expect(firstCard.locator('.like-btn')).toBeVisible();
    await expect(firstCard.locator('.dislike-btn')).toBeVisible();
    await expect(firstCard.locator('.comment-btn')).toBeVisible();
  });
});

// ── Create Post ──────────────────────────────────────────
test.describe('New Post', () => {
  // Valid partition: add a single post via the modal
  test('should allow me to create a new post', async ({ page }) => {
    await addPost(page, NEW_POSTS[0]);
  });

  // Valid partition: add multiple posts in different categories – all appear in the feed
  test('should allow me to create posts in different categories', async ({ page }) => {
    await addPost(page, { ...NEW_POSTS[3], category: CATEGORIES[0] });
    await addPost(page, { ...NEW_POSTS[4], category: CATEGORIES[1] });

    const container = page.locator('#postsContainer');
    await expect(container).toContainText(NEW_POSTS[3].title);
    await expect(container).toContainText(NEW_POSTS[4].title);
  });

  // Boundary: title/category/content empty – submit stays disabled (mirrors validateForm())
  test('should keep the Post button disabled until title, category, and content are filled', async ({
    page,
  }) => {
    await page.locator('.create-post-input').click();
    await expect(page.locator('#createPostModal')).toBeVisible();
    await expect(page.locator('#submitPostBtn')).toBeDisabled();

    await page.locator('#postTitle').fill(NEW_POSTS[0].title);
    await expect(page.locator('#submitPostBtn')).toBeDisabled();
  });

  // Boundary: special characters – XSS payload displayed as escaped text
  test('should handle special characters in post content (XSS boundary)', async ({ page }) => {
    const xssTitle = 'E2E XSS Boundary Post';
    await addPost(page, { title: xssTitle, content: '<b>bold</b> & "quotes"' });

    const card = postCards(page).filter({ hasText: xssTitle });
    await expect(card.locator('.post-content')).toBeVisible();
  });
});

// ── Delete Post ──────────────────────────────────────────
test.describe('Delete Post', () => {
  // Valid partition: deleting a post removes it from the feed while other posts remain
  test('should allow me to delete a post I created, leaving other posts intact', async ({
    page,
  }) => {
    await addPost(page, NEW_POSTS[5]);
    await addPost(page, NEW_POSTS[2]);

    await deletePost(page, NEW_POSTS[2].title);

    await expect(postCards(page).filter({ hasText: NEW_POSTS[5].title })).toBeVisible();
    await expect(postCards(page).filter({ hasText: NEW_POSTS[2].title })).toHaveCount(0);
  });

  // Boundary: a deleted post's own .html?id=n page should no longer be reachable
  test("a deleted post's detail page should show a not-found state", async ({ page }) => {
    await addPost(page, NEW_POSTS[2]);

    const card = postCards(page).filter({ hasText: NEW_POSTS[2].title });
    const postId = await card.getAttribute('data-post-id');

    await deletePost(page, NEW_POSTS[2].title);

    await page.goto(`http://localhost:3000/posts.html?id=${postId}`);
    await expect(page.locator('#postDetailContainer')).toContainText('Post not found.');
  });

  // Error handling: cancelling the confirm-delete modal should discard the action
  test('cancelling the delete confirmation should keep the post', async ({ page }) => {
    const original = {
      title: 'E2E Cancel Delete Check',
      content: 'This post should survive a cancel.',
    };
    await addPost(page, original);

    const card = postCards(page).filter({ hasText: original.title });
    await card.locator('.post-menu-btn').click();
    await card.locator('.delete-post-btn').click();
    await expect(page.locator('#confirmOverlay')).toBeVisible();

    await page.locator('#confirmCancelBtn').click();

    await expect(page.locator('#confirmOverlay')).toBeHidden();
    await expect(postCards(page).filter({ hasText: original.title })).toBeVisible();
  });
});

// ── Edit Post ────────────────────────────────────────────
test.describe('Edit Post', () => {
  // Valid partition: owner edits title + content and the change persists
  test("should allow the post owner to edit a post's title and content", async ({ page }) => {
    const original = { title: 'E2E Edit Original Title', content: 'Original content.' };
    const updatedTitle = 'E2E Edit Updated Title';
    const updatedContent = 'Updated content after editing.';

    await addPost(page, original);
    await goToEditPage(page, original.title);

    await page.locator('#editTitle').fill(updatedTitle);
    await page.locator('#editQuillEditor .ql-editor').fill(updatedContent);
    await page.locator('#saveEditBtn').click();

    await expect(page.locator('#editTitle')).toBeHidden();
    await expect(page.locator('#postDetailContainer')).toContainText(updatedTitle);
    await expect(page.locator('#postDetailContainer')).toContainText(updatedContent);
  });

  // Valid partition: a saved edit shows the "edited" indicator
  test('an edited post should show an "edited" indicator', async ({ page }) => {
    const original = { title: 'E2E Edited Tag Original', content: 'Content before edit.' };

    await addPost(page, original);
    await goToEditPage(page, original.title);

    await page.locator('#editQuillEditor .ql-editor').fill('Content after edit.');
    await page.locator('#saveEditBtn').click();

    await expect(page.locator('#postDetailContainer .post-edited-tag')).toBeVisible();
    await expect(page.locator('#postDetailContainer .post-edited-tag')).toContainText('edited');
  });

  // Boundary: clearing the title blocks save (empty-string boundary)
  test('should block saving when the title is cleared', async ({ page }) => {
    const original = { title: 'E2E Edit Empty Title Check', content: 'Some content.' };

    await addPost(page, original);
    await goToEditPage(page, original.title);

    await page.locator('#editTitle').fill('');
    await page.locator('#saveEditBtn').click();

    await expect(page.locator('#editError')).toBeVisible();
    await expect(page.locator('#editError')).toContainText('Title cannot be empty.');
    await expect(page.locator('#editTitle')).toBeVisible();
  });

  // Error handling: cancelling discards changes and restores the original view
  test('cancelling an edit should discard changes', async ({ page }) => {
    const original = { title: 'E2E Edit Cancel Check', content: 'Content that should survive.' };

    await addPost(page, original);
    await goToEditPage(page, original.title);

    await page.locator('#editTitle').fill('This title should never be saved');
    await page.locator('#cancelEditBtn').click();

    await expect(page.locator('#editTitle')).toBeHidden();
    await expect(page.locator('#postDetailContainer')).toContainText(original.title);
    await expect(page.locator('#postDetailContainer')).not.toContainText(
      'This title should never be saved',
    );
  });
});

// ── Post Polls ─────────────────────────────────────────────────
async function addPostWithPoll(
  page,
  { title, content, category = CATEGORIES[0], pollQuestion, pollOptions },
) {
  await page.locator('.create-post-input').click();
  await expect(page.locator('#createPostModal')).toBeVisible();
  await page.locator('#postTitle').fill(title);
  await page.locator('#postCategory').selectOption(category);
  await page.locator('#createPostModal .ql-editor').fill(content);

  await page.locator('#pollToggleBtn').click();
  await expect(page.locator('#pollBuilderPanel')).toBeVisible();
  await page.locator('#pollQuestion').fill(pollQuestion);

  const optionInputs = page.locator('.poll-option-input');
  for (let i = 0; i < pollOptions.length; i++) {
    await optionInputs.nth(i).fill(pollOptions[i]);
  }

  await page.locator('#submitPostBtn').click();
  await expect(page.locator('#createPostModal')).toBeHidden();
  await expect(postCards(page).filter({ hasText: title })).toBeVisible();

  // Poll creation fires as a separate request after the post itself is
  // created (see indexFeed.js), so the initially-rendered card may not yet
  // reflect it. Reload to force a fresh fetch once it's had time to land.
  await page.reload();
  await waitForFeedLoaded(page);
}

function pollCardFor(page, title) {
  return postCards(page).filter({ hasText: title });
}

test.describe('Poll Tests', () => {
  // Valid partition: creating a post with a poll attaches and renders it
  test('should allow me to create a post with a poll', async ({ page }) => {
    await addPostWithPoll(page, {
      title: 'E2E Poll Creation Post',
      content: 'Which do you prefer?',
      pollQuestion: 'Coffee or tea?',
      pollOptions: ['Coffee', 'Tea'],
    });

    const card = pollCardFor(page, 'E2E Poll Creation Post');
    await expect(card.locator('.poll-question')).toHaveText('Coffee or tea?', { timeout: 10000 });
    await expect(card.locator('.poll-option')).toHaveCount(2);

    const labels = await card.locator('.poll-option-label').allTextContents();
    expect(labels.sort()).toEqual(['Coffee', 'Tea']);
  });

  // Valid partition: voting on an option marks it as the user's choice and shows results
  test('should allow me to vote on a poll option and see the result', async ({ page }) => {
    await addPostWithPoll(page, {
      title: 'E2E Poll Vote Post',
      content: 'Vote test content',
      pollQuestion: 'Cats or dogs?',
      pollOptions: ['Cats', 'Dogs'],
    });

    const card = pollCardFor(page, 'E2E Poll Vote Post');
    await expect(card.locator('.poll-question')).toBeVisible({ timeout: 10000 });

    await card.locator('.poll-option').first().click();

    await expect(card.locator('.poll-option.user-voted')).toBeVisible();
    await expect(card.locator('.poll-option.user-voted .poll-option-pct')).toHaveText('100%');
  });

  // Boundary: switching a vote updates which option is marked as the user's choice
  test('should switch my vote when I click a different option', async ({ page }) => {
    await addPostWithPoll(page, {
      title: 'E2E Poll Switch Post',
      content: 'Switch vote test content',
      pollQuestion: 'Pizza or pasta?',
      pollOptions: ['Pizza', 'Pasta'],
    });

    const card = pollCardFor(page, 'E2E Poll Switch Post');
    await expect(card.locator('.poll-question')).toBeVisible({ timeout: 10000 });

    await card.locator('.poll-option').filter({ hasText: 'Pizza' }).click();
    await expect(
      card.locator('.poll-option.user-voted').filter({ hasText: 'Pizza' }),
    ).toBeVisible();

    await card.locator('.poll-option').filter({ hasText: 'Pasta' }).click();

    await expect(
      card.locator('.poll-option.user-voted').filter({ hasText: 'Pasta' }),
    ).toBeVisible();
    await expect(card.locator('.poll-option.user-voted').filter({ hasText: 'Pizza' })).toHaveCount(
      0,
    );
  });
});
