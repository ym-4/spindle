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
  whiteboard: `${BASE_URL}/whiteboard.html`,
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

// ============================================================
// Whiteboard tests
// ============================================================
test.describe('Whiteboard', () => {
  async function openWikiTab(page) {
    await openGroupFeed(page);

    await page.locator('[data-bs-target="#wikiTab"]').click();

    await expect(page.locator('#wikiTab')).toBeVisible();
  }

  test('user can create a whiteboard', async ({ page }) => {
    await openWikiTab(page);

    await page.locator('#createNoteDropdownBtn').click();
    await page.locator('#createWhiteboardBtn').click();

    await expect(page.locator('#createWhiteboardModal')).toBeVisible();

    await page.locator('#whiteboardTitle').fill('E2E Whiteboard');

    await page.locator('#createWhiteboardConfirmBtn').click();

    await expect(page.locator('#createWhiteboardModal')).toBeHidden();

    await expect(page).toHaveURL(/whiteboard\.html/);
  });

  test('user can create a pixel whiteboard', async ({ page }) => {
    await openWikiTab(page);

    await page.locator('#createNoteDropdownBtn').click();
    await page.locator('#createWhiteboardBtn').click();

    await page.locator('#whiteboardTitle').fill('Pixel Board');

    await page.locator('label[for="modePixel"]').click();

    await page.locator('#createWhiteboardConfirmBtn').click();

    await expect(page).toHaveURL(/whiteboard\.html/);
  });

  test('user can open an existing whiteboard', async ({ page }) => {
    await openWikiTab(page);

    // Wait until the whiteboards are rendered
    await expect(page.locator('#folderStructure')).toBeVisible();

    const whiteboard = page
      .locator('#folderStructure .wiki-file')
      .filter({ hasText: 'E2E Whiteboard' })
      .first();

    await expect(whiteboard).toBeVisible();

    await whiteboard.click();

    await expect(page).toHaveURL(/whiteboard\.html/);
  });

  test('user can draw on a whiteboard', async ({ page }) => {
    await openWikiTab(page);

    await expect(page.locator('#folderStructure')).toBeVisible();

    const whiteboard = page
      .locator('#folderStructure .wiki-file')
      .filter({ hasText: 'E2E Whiteboard' })
      .first();

    await expect(whiteboard).toBeVisible();

    await whiteboard.click();

    await expect(page).toHaveURL(/whiteboard\.html/);
    const canvas = page.locator('#drawing-board');

    await expect(canvas).toBeVisible();

    const box = await canvas.boundingBox();

    await page.mouse.move(box.x + 100, box.y + 100);
    await page.mouse.down();
    await page.mouse.move(box.x + 250, box.y + 180);
    await page.mouse.move(box.x + 320, box.y + 220);
    await page.mouse.up();

    // Verify drawing occurred using your UI indicator
    // await expect(page.locator('#saveWhiteboardBtn')).toBeEnabled();
  });

  test('user can draw on a pixel whiteboard', async ({ page }) => {
    await openWikiTab(page);

    await expect(page.locator('#folderStructure')).toBeVisible();

    const whiteboard = page
      .locator('#folderStructure .wiki-file')
      .filter({ hasText: 'Pixel Board' })
      .first();

    await expect(whiteboard).toBeVisible();

    await whiteboard.click();

    await expect(page).toHaveURL(/whiteboard\.html/);
    const canvas = page.locator('#pixel-board');

    const box = await canvas.boundingBox();

    await page.mouse.click(box.x + 20, box.y + 20);
    await page.mouse.click(box.x + 40, box.y + 20);
    await page.mouse.click(box.x + 60, box.y + 20);
  });

  //   test('user can save whiteboard changes', async ({ page }) => {
  //     await openWikiTab(page);

  //     await page
  //       .locator('#whiteboardList .whiteboard-item')
  //       .filter({ hasText: 'Revision Mindmap' })
  //       .click();

  //     const canvas = page.locator('#whiteboardCanvas');

  //     const box = await canvas.boundingBox();

  //     await page.mouse.move(box.x + 50, box.y + 50);
  //     await page.mouse.down();
  //     await page.mouse.move(box.x + 150, box.y + 150);
  //     await page.mouse.up();

  //     await page.locator('#saveWhiteboardBtn').click();

  //     await expect(page.locator('.toast')).toContainText('saved');
  //   });

  //   test('user can switch between whiteboards', async ({ page }) => {
  //     await openWikiTab(page);

  //     await page
  //       .locator('#whiteboardList .whiteboard-item')
  //       .filter({ hasText: 'Revision Mindmap' })
  //       .click();

  //     await expect(page.locator('#whiteboardTitle')).toContainText('Revision Mindmap');

  //     await page
  //       .locator('#whiteboardList .whiteboard-item')
  //       .filter({ hasText: 'Assignment Planning' })
  //       .click();

  //     await expect(page.locator('#whiteboardTitle')).toContainText('Assignment Planning');
  //   });
});
