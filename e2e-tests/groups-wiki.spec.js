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

// ============================================================
// Notes
// ============================================================

test.describe('Notes', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupFeed(page);

    // Open Wiki tab
    await page.locator('#wikiBtn').click();

    // Wiki tab should be visible
    await expect(page.locator('#wikiTab')).toBeVisible();
  });

  // ----------------------------------------------------------
  // View Notes
  // ----------------------------------------------------------

  test('user can view the Notes section', async ({ page }) => {
    // Notes sidebar should be visible
    await expect(page.locator('#wikiTab')).toBeVisible();

    // Notes heading should be visible
    await expect(
      page.locator('#wikiTab').getByText('Notes', { exact: true }).first(),
    ).toBeVisible();

    // Note folder structure should be visible
    await expect(page.locator('#folderStructure')).toBeVisible();

    // Note content area should be visible
    await expect(page.locator('#noteContent')).toBeVisible();
  });

  // ----------------------------------------------------------
  // Create Note
  // ----------------------------------------------------------

  test('user can open the New Note modal', async ({ page }) => {
    // Click the + dropdown button
    await page.locator('#createNoteDropdownBtn').click();

    await page.locator('#createNoteBtn').click();

    await expect(page.locator('#newNoteModal')).toBeVisible();

    await expect(page.locator('#noteNameInput')).toBeVisible();

    await expect(page.locator('#newNoteBtn')).toBeVisible();
  });

  test('user can create a new note', async ({ page }) => {
    const noteName = `E2E Test Note ${Date.now()}`;

    // Click the + dropdown button
    await page.locator('#createNoteDropdownBtn').click();

    // Wait for dropdown to actually open
    await expect(page.locator('#createNoteBtn')).toBeVisible();

    // Open New Note modal
    await page.locator('#createNoteBtn').click();

    await expect(page.locator('#newNoteModal')).toBeVisible();

    // Enter note name
    await page.locator('#noteNameInput').fill(noteName);

    // Create note
    await page.locator('#newNoteBtn').click();

    // Modal should close
    await expect(page.locator('#newNoteModal')).not.toBeVisible();

    // New note should appear in the Notes sidebar
    await expect(page.locator('#folderStructure')).toContainText(noteName);

    // Note should be displayed
    await expect(page.locator('#noteTitle')).toContainText(noteName);
  });

  // ----------------------------------------------------------
  // Edit Note
  // ----------------------------------------------------------

  test('user can edit an existing note', async ({ page }) => {
    // Make sure a note exists
    const noteLink = page.locator('#folderStructure .wiki-file').first();

    await expect(noteLink).toBeVisible();

    // Open note
    await noteLink.click();

    // Click Edit
    await page.locator('#editNoteBtn').click();

    // Editor should become visible
    await expect(page.locator('#noteEditor')).toBeVisible();

    // Title input should be visible
    await expect(page.locator('#noteTitleInput')).toBeVisible();
  });

  // ----------------------------------------------------------
  // Save Note
  // ----------------------------------------------------------

  test('user can edit and save a note', async ({ page }) => {
    const noteLink = page.locator('#folderStructure .wiki-file').first();

    await expect(noteLink).toBeVisible();

    // Open existing note
    await noteLink.click();

    // Enter edit mode
    await page.locator('#editNoteBtn').click();

    // Change title
    const updatedTitle = `Updated E2E Note ${Date.now()}`;

    await page.locator('#noteTitleInput').fill(updatedTitle);

    // Enter content in Quill editor
    await page.locator('#noteEditor .ql-editor').fill('This note was updated during an E2E test.');

    // Save note
    await page.locator('#saveNoteBtn').click();

    // Editor should close
    await expect(page.locator('#noteEditor')).not.toBeVisible();

    // Updated title should be displayed
    await expect(page.locator('#noteTitle')).toContainText(updatedTitle);

    // Updated content should be displayed
    await expect(page.locator('#noteContent')).toContainText(
      'This note was updated during an E2E test.',
    );
  });

  // ----------------------------------------------------------
  // Create Folder
  // ----------------------------------------------------------

  test('user can create a new note folder', async ({ page }) => {
    const folderName = `E2E Test Folder ${Date.now()}`;

    // Click the + dropdown button
    await page.locator('#createNoteDropdownBtn').click();

    // Wait for dropdown to actually open
    await expect(page.locator('#createNoteFolderBtn')).toBeVisible();

    // Open New Folder modal
    await page.locator('#createNoteFolderBtn').click();

    await expect(page.locator('#newNoteFolderModal')).toBeVisible();

    // Enter folder name
    await page.locator('#noteFolderNameInput').fill(folderName);

    // Create folder
    await page.locator('#newNoteFolderBtn').click();

    // Modal should close
    await expect(page.locator('#newNoteFolderModal')).not.toBeVisible();

    // Folder should appear
    await expect(page.locator('#folderStructure')).toContainText(folderName);
  });

  // ----------------------------------------------------------
  // Note Formatting
  // ----------------------------------------------------------

  test('user can apply bold formatting to note content', async ({ page }) => {
    const noteLink = page.locator('#folderStructure .wiki-file').first();

    await noteLink.click();

    await page.locator('#editNoteBtn').click();

    const editor = page.locator('#noteEditor .ql-editor');

    await editor.fill('Bold test content');

    // Select all editor content
    await editor.press('Control+A');

    // Click Bold button
    await page.locator('#boldBtn').click();

    // Verify Quill generated bold formatting
    await expect(editor.locator('strong')).toBeVisible();
  });
});
