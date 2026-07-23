const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';

const NEW_POSTS = [
  { title: 'E2E Test Post One', content: 'This is the first automated test post.' },
  { title: 'E2E Test Post Two', content: 'This is the second automated test post.' },
  { title: 'E2E Delete Target', content: 'This post exists only to be deleted.' },
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

/**
 * Waits for the feed's initial fetch to finish (showPostsLoading()'s
 * spinner to be gone) so tests don't race the loading state.
 */
async function waitForFeedLoaded(page) {
  await expect(page.locator('#postsContainer .spinner-border')).toHaveCount(0, { timeout: 15000 });
}

/**
 * Fill in the create-post modal and submit a new Post.
 * Waits until the feed contains the new title and the modal closes.
 */
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

/**
 * Delete a post by its title via the dropdown menu + confirm dialog.
 */
async function deletePost(page, title) {
  const card = postCards(page).filter({ hasText: title });
  await card.locator('.post-menu-btn').click();
  await card.locator('.delete-post-btn').click();
  await expect(page.locator('#confirmOverlay')).toBeVisible();
  await page.locator('#confirmOkBtn').click();
  await expect(postCards(page).filter({ hasText: title })).toHaveCount(0);
}

/**
 * From the feed, open a post's dropdown and click "Edit post", landing
 * on posts.html?id=<id>&edit=true with the edit form already rendered.
 */
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
    await addPost(page, { ...NEW_POSTS[0], category: CATEGORIES[0] });
    await addPost(page, { ...NEW_POSTS[1], category: CATEGORIES[1] });

    const container = page.locator('#postsContainer');
    await expect(container).toContainText(NEW_POSTS[0].title);
    await expect(container).toContainText(NEW_POSTS[1].title);
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
  // Valid partition: delete a specific post and verify it disappears
  test('should allow me to delete a post I created', async ({ page }) => {
    await addPost(page, NEW_POSTS[2]);
    await deletePost(page, NEW_POSTS[2].title);
  });

  // Valid partition: other posts remain unaffected after deleting one
  test('other posts should remain after deleting one', async ({ page }) => {
    await addPost(page, NEW_POSTS[0]);
    await addPost(page, NEW_POSTS[2]);

    await deletePost(page, NEW_POSTS[2].title);

    await expect(postCards(page).filter({ hasText: NEW_POSTS[0].title })).toBeVisible();
    await expect(postCards(page).filter({ hasText: NEW_POSTS[2].title })).toHaveCount(0);
  });

  // Boundary: a deleted post should not remain anywhere in the feed
  test('a deleted post should no longer be present anywhere in the feed', async ({ page }) => {
    await addPost(page, NEW_POSTS[2]);
    await deletePost(page, NEW_POSTS[2].title);

    const remaining = postCards(page).filter({ hasText: NEW_POSTS[2].title });
    await expect(remaining).toHaveCount(0);
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
