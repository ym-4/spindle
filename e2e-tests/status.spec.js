const { test, expect } = require('@playwright/test');
const { BASE } = require('./helpers');

// Status/Stories feature: post a text status, view it back, delete it.
// Global setup logs in Alice and stores her session in storageState.json.
const STORIES_URL = `${BASE}/stories.html`;

/** Post a text status and wait for the feed to refresh. */
async function postTextStatus(page, caption) {
  await expect(page.locator('#captionInput')).toBeVisible({ timeout: 15000 });
  await page.fill('#captionInput', caption);
  await expect(page.locator('#sendBtn')).toBeEnabled();
  await page.locator('#sendBtn').click();
  // Own ring appears once the story is saved and the feed refreshes.
  await expect(page.locator('#ownRingBtn')).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#storiesList')).toContainText('Just now', { timeout: 15000 });
}

/** Open the own-story viewer and advance until `caption` is on screen. */
async function openOwnViewerToCaption(page, caption) {
  await page.locator('#ownRingBtn').click();
  await expect(page.locator('#viewerOverlay')).toBeVisible({ timeout: 15000 });
  for (let i = 0; i < 15; i++) {
    const text = await page
      .locator('#viewerTextCaption')
      .textContent()
      .catch(() => '');
    const footer = await page
      .locator('#viewerCaption')
      .textContent()
      .catch(() => '');
    if ((text || '').includes(caption) || (footer || '').includes(caption)) return;
    const visible = await page
      .locator('#viewerOverlay')
      .isVisible()
      .catch(() => false);
    if (!visible) break;
    await page.locator('#tapNext').click();
  }
  throw new Error(`caption not found in own stories: ${caption}`);
}

/** Cycle the own-story viewer and report whether `caption` is ever shown. */
async function ownViewerContains(page, caption) {
  const opened = await page
    .locator('#viewerOverlay')
    .isVisible()
    .catch(() => false);
  if (!opened) return false;
  for (let i = 0; i < 15; i++) {
    const text = await page
      .locator('#viewerTextCaption')
      .textContent()
      .catch(() => '');
    const footer = await page
      .locator('#viewerCaption')
      .textContent()
      .catch(() => '');
    if ((text || '').includes(caption) || (footer || '').includes(caption)) return true;
    const visible = await page
      .locator('#viewerOverlay')
      .isVisible()
      .catch(() => false);
    if (!visible) break;
    await page.locator('#tapNext').click();
  }
  return false;
}

test.describe('Status (Stories) journeys', () => {
  test('can post a text status and view it under "My status"', async ({ page }) => {
    const caption = `Way to go ${Date.now()}`;
    await page.goto(STORIES_URL);

    await postTextStatus(page, caption);

    // Own ring labelled "My status"
    await expect(page.getByText('My status').first()).toBeVisible();

    // The caption is visible inside the story viewer opened from the own ring.
    await openOwnViewerToCaption(page, caption);
    await expect(page.locator('#viewerTextCaption')).toContainText(caption);
  });

  test('story viewer advances to the next story and can be closed', async ({ page }) => {
    const first = `first ${Date.now()}`;
    const second = `second ${Date.now()}`;
    await page.goto(STORIES_URL);

    await postTextStatus(page, first);
    await postTextStatus(page, second);

    // Open viewer: oldest own story shows first, next tap shows the second.
    await page.locator('#ownRingBtn').click();
    await expect(page.locator('#viewerOverlay')).toBeVisible({ timeout: 15000 });

    const before = await page.locator('#viewerTextCaption').textContent();
    await page.locator('#tapNext').click();
    await expect
      .poll(async () => page.locator('#viewerTextCaption').textContent())
      .not.toBe(before);

    // Close via the X button.
    await page.locator('#viewerClose').click();
    await expect(page.locator('#viewerOverlay')).toBeHidden();
    await expect(page).toHaveURL(STORIES_URL);
  });

  test('can delete your own status and it disappears', async ({ page }) => {
    const caption = `deletable ${Date.now()}`;
    await page.goto(STORIES_URL);

    await postTextStatus(page, caption);

    // Open the story viewer and locate our story.
    await page.locator('#ownRingBtn').click();
    await expect(page.locator('#viewerOverlay')).toBeVisible({ timeout: 15000 });
    for (let i = 0; i < 15; i++) {
      const text = await page
        .locator('#viewerTextCaption')
        .textContent()
        .catch(() => '');
      if ((text || '').includes(caption)) break;
      await page.locator('#tapNext').click();
    }
    await expect(page.locator('#viewerDelete')).toBeVisible();

    // Delete (accept the native confirm dialog).
    page.once('dialog', (dialog) => dialog.accept());
    await page.locator('#viewerDelete').click();

    // The deleted story must never appear in the own-story viewer again.
    await page.waitForTimeout(500);
    await page
      .locator('#viewerClose')
      .click()
      .catch(() => {});
    await page.reload();
    await expect(page.locator('#ownRingBtn')).toBeVisible({ timeout: 15000 });
    await page.locator('#ownRingBtn').click();
    expect(await ownViewerContains(page, caption)).toBe(false);
  });
});
