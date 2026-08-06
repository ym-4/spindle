const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';
const API_BASE = 'http://localhost:3000';

test.beforeEach(async ({ page }) => {
  await page.goto(BASE_URL);
});

// ── Helpers ──────────────────────────────────────────────
async function createTestPost(page, { title, content, category = 'general', tags = [] }) {
  const userId = await page.evaluate(() => localStorage.getItem('loggedInUserId'));
  const res = await page.request.post(`${API_BASE}/posts`, {
    multipart: {
      user_id: String(userId),
      title,
      category,
      content,
      tags: JSON.stringify(tags),
    },
  });
  const body = await res.json();
  return body.id;
}

async function createTestComment(page, postId, content) {
  const token = await page.evaluate(() => localStorage.getItem('token'));
  await page.request.post(`${API_BASE}/comments/${postId}`, {
    headers: { Authorization: `Bearer ${token}` },
    multipart: { content },
  });
}

async function gotoSearch(page, query, params = {}) {
  const search = new URLSearchParams({ q: query, ...params });
  await page.goto(`${API_BASE}/search.html?${search.toString()}`);
  await waitForSearchLoaded(page);
}

async function waitForSearchLoaded(page) {
  await expect(page.locator('#searchResultsPanel .spinner-border')).toHaveCount(0, {
    timeout: 15000,
  });
}

function resultsPanel(page) {
  return page.locator('#searchResultsPanel');
}

// ── Search Results ───────────────────────────────────────
test.describe('Search Results', () => {
  // Valid partition: a query returns matching posts and comments together
  test('should return matching posts and comments for a valid query', async ({ page }) => {
    const keyword = `SearchE2EKeyword${Date.now()}`;
    const postId = await createTestPost(page, {
      title: `${keyword} Post`,
      content: 'Post body content',
    });
    await createTestComment(page, postId, `${keyword} comment reply`);

    await gotoSearch(page, keyword);

    await expect(resultsPanel(page)).toContainText(`${keyword} Post`);
    await expect(resultsPanel(page)).toContainText(`${keyword} comment reply`);
  });

  // Boundary: a query with no matches shows the empty state
  test('should show the empty state when nothing matches the query', async ({ page }) => {
    await gotoSearch(page, 'zzz-definitely-no-matches-zzz');

    await expect(resultsPanel(page)).toContainText('No results found for');
  });

  // Valid partition: clearing filters resets category/sort/date and reruns the search
  test('should reset filters and rerun the search when Clear is clicked', async ({ page }) => {
    const keyword = `ClearFilterKeyword${Date.now()}`;
    await createTestPost(page, { title: `${keyword} Post`, content: 'x', category: 'confession' });

    await gotoSearch(page, keyword);
    await page.locator('#categoryFilterBtn').click();
    await page.locator('.search-category-checkbox[value="confession"]').check();
    await waitForSearchLoaded(page);
    await expect(page.locator('#categoryFilterLabel')).toHaveText('Confession');

    await page.locator('#categoryFilterBtn').click();
    await page.locator('#clearSearchFiltersBtn').click();
    await waitForSearchLoaded(page);

    await expect(page.locator('#categoryFilterLabel')).toHaveText('All categories');
    await expect(page.locator('#searchSort')).toHaveValue('newest');
  });
});

// ── Search Filters ───────────────────────────────────────
test.describe('Search Filters', () => {
  // Valid partition: a category filter shows results for that category only
  test('should narrow results to the selected category', async ({ page }) => {
    const keyword = `CategoryFilterKeyword${Date.now()}`;
    await createTestPost(page, { title: `${keyword} A`, content: 'x', category: 'confession' });
    await createTestPost(page, { title: `${keyword} B`, content: 'x', category: 'general' });

    await gotoSearch(page, keyword);
    await page.locator('#categoryFilterBtn').click();
    await page.locator('.search-category-checkbox[value="confession"]').check();
    await waitForSearchLoaded(page);

    await expect(resultsPanel(page)).toContainText(`${keyword} A`);
    await expect(resultsPanel(page)).not.toContainText(`${keyword} B`);
  });

  // Valid partition: switching sort order flips the displayed order
  test('should reorder results when sort is switched to oldest first', async ({ page }) => {
    const keyword = `SortOrderKeyword${Date.now()}`;
    await createTestPost(page, { title: `${keyword} First`, content: 'x' });
    await page.waitForTimeout(1100);
    await createTestPost(page, { title: `${keyword} Second`, content: 'x' });

    await gotoSearch(page, keyword);
    const cards = resultsPanel(page).locator('.post-card');
    await expect(cards.first()).toContainText(`${keyword} Second`);

    await page.locator('#searchSort').selectOption('oldest');
    await waitForSearchLoaded(page);

    await expect(cards.first()).toContainText(`${keyword} First`);
  });

  // Boundary: a date_from set in the future excludes all current results
  test('should exclude all results when date_from is set in the future', async ({ page }) => {
    const keyword = `FutureDateKeyword${Date.now()}`;
    await createTestPost(page, { title: `${keyword} Post`, content: 'x' });

    await gotoSearch(page, keyword);
    await expect(resultsPanel(page)).toContainText(`${keyword} Post`);

    const futureDate = new Date(Date.now() + 1000 * 60 * 60 * 24 * 365).toISOString().slice(0, 10);
    await page.locator('#searchDateFrom').fill(futureDate);
    await waitForSearchLoaded(page);

    await expect(resultsPanel(page)).toContainText('No results found for');
  });
});

// ── Search Suggestions ────────────────
test.describe('Search Autocomplete & Recent Searches', () => {
  // Valid partition: typing shows a live suggestion for the typed query
  test('should show a live suggestion while typing', async ({ page }) => {
    await page.locator('#searchInput').fill('some partial query');

    await expect(page.locator('#searchDropdown')).toBeVisible({ timeout: 5000 });
    await expect(
      page
        .locator('#searchDropdown .search-dropdown-item')
        .filter({ hasText: 'some partial query' }),
    ).toBeVisible();
  });

  // Valid partition: a completed search is saved as a recent search
  test('should save a completed search and show it as a recent search', async ({ page }) => {
    const keyword = `RecentSearchKeyword${Date.now()}`;
    await page.locator('#searchInput').fill(keyword);
    await page.locator('#searchInput').press('Enter');
    await waitForSearchLoaded(page);

    await page.waitForTimeout(400);

    await page.locator('#searchInput').fill('');
    await expect(page.locator('#searchDropdown')).toContainText('Recent searches', {
      timeout: 5000,
    });
    await expect(page.locator('#searchDropdown')).toContainText(keyword);
  });

  // Boundary: removing a recent search removes only that entry
  test('should remove only the targeted recent search', async ({ page }) => {
    const keep = `KeepSearch${Date.now()}`;
    const remove = `RemoveSearch${Date.now()}`;

    for (const term of [keep, remove]) {
      await page.locator('#searchInput').fill(term);
      await page.locator('#searchInput').press('Enter');
      await waitForSearchLoaded(page);
      await page.waitForTimeout(400);
    }

    await page.locator('#searchInput').fill('');
    await expect(page.locator('#searchDropdown')).toContainText('Recent searches', {
      timeout: 5000,
    });

    const removeItem = page
      .locator('#searchDropdown .search-dropdown-item')
      .filter({ hasText: remove });
    await removeItem.locator('.remove-recent').click();

    await expect(page.locator('#searchDropdown')).not.toContainText(remove);
    await expect(page.locator('#searchDropdown')).toContainText(keep);
  });
});

// ── Tag Search ────────────────────────────────────────────
test.describe('Tag Search', () => {
  // Valid partition: typing a #tag and pressing Enter runs a tag search
  test('should run a tag search and hide the filter bar', async ({ page }) => {
    const tagName = `e2etag${Date.now()}`;
    await createTestPost(page, {
      title: 'Tagged Post',
      content: 'x',
      tags: [tagName],
    });

    await page.locator('#searchInput').fill(`#${tagName}`);
    await page.locator('#searchInput').press('Enter');
    await waitForSearchLoaded(page);

    await expect(page.locator('#searchFilterCard')).toBeHidden();
    await expect(resultsPanel(page)).toContainText('Tagged Post');
    await expect(resultsPanel(page)).toContainText(`tagged`);
  });

  // Valid partition: selecting a suggested tag from the dropdown runs a tag search
  test('should run a tag search when a suggested tag is clicked', async ({ page }) => {
    const tagName = `clicktag${Date.now()}`;
    await createTestPost(page, {
      title: 'Clickable Tag Post',
      content: 'x',
      tags: [tagName],
    });

    await page.locator('#searchInput').fill(tagName.slice(0, -2));
    await expect(page.locator('#searchDropdown')).toContainText('Tags', { timeout: 5000 });

    await page
      .locator('#searchDropdown .search-dropdown-item')
      .filter({ hasText: `#${tagName}` })
      .click();
    await waitForSearchLoaded(page);

    await expect(page).toHaveURL(/type=tag/);
    await expect(resultsPanel(page)).toContainText('Clickable Tag Post');
  });

  // Boundary: a tag with no posts shows the empty state
  test('should show the tag-specific empty state for an unused tag', async ({ page }) => {
    await gotoSearch(page, '#zzznonexistenttagzzz', { type: 'tag' });

    await expect(resultsPanel(page)).toContainText('No posts found with tag');
  });
});
