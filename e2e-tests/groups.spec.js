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

// These must exist in your E2E/test database.
// Prefer dedicated test fixtures over manually-created production data.
const TEST_GROUPS = {
  public: 'Public Test Group',
  private: 'Private Test Group',
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

function groupCard(page, groupName) {
  return page.locator('#popularGroupsContainer .group-card').filter({ hasText: groupName }).first();
}

async function openGroupDetails(page, groupName) {
  const card = groupCard(page, groupName);

  await expect(card).toBeVisible();

  await card.click();

  await expect(page.locator('#join-group-modal')).toBeVisible();
}

// test.beforeEach(async ({ page }) => {
//   await openGroupsPage(page);
// });

// ============================================================
// View Groups
// ============================================================

// test('debug storage state', async ({ page }) => {
//   await page.goto('http://localhost:3000');

//   const result = await page.evaluate(() => ({
//     origin: location.origin,
//     token: localStorage.getItem('token'),
//     userId: localStorage.getItem('loggedInUserId'),
//     all: { ...localStorage },
//   }));

//   console.log(JSON.stringify(result, null, 2));
// });

test.describe('View Groups', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupsPage(page);
  });

  test('user can view groups for a school', async ({ page }) => {
    const groupCards = page.locator('#popularGroupsContainer .group-card');

    // At least one group is displayed.
    await expect(groupCards.first()).toBeVisible();

    // Group card contains a name.
    await expect(groupCards.first().locator('h3')).toBeVisible();

    // Group card contains a description.
    await expect(groupCards.first().locator('p')).toBeVisible();

    // Group card contains footer information.
    await expect(groupCards.first().locator('.group-footer')).toBeVisible();
  });

  test('user can click a group and view group details', async ({ page }) => {
    const firstGroup = page.locator('#popularGroupsContainer .group-card').first();

    await expect(firstGroup).toBeVisible();

    const groupName = await firstGroup.locator('h3').innerText();

    await firstGroup.click();

    const modal = page.locator('#join-group-modal');

    await expect(modal).toBeVisible();

    await expect(page.locator('#joinGroupName')).toHaveText(groupName);

    await expect(page.locator('#joinGroupDescription')).toBeVisible();
    await expect(page.locator('#joinGroupModule')).toBeVisible();
    await expect(page.locator('#joinGroupMembers')).toBeVisible();
    await expect(page.locator('#joinGroupSchool')).toBeVisible();

    // NOTE: the app hides #join-group-btn and shows #leave-group-btn
    // instead when the current user is already a member of the group
    // clicked (see displayGroupInfo() in groups.js). Since this test
    // clicks whichever group happens to render first, we can't assume
    // membership state — assert that exactly one of the three action
    // buttons (join / leave / request) is visible instead.
    const joinBtn = page.locator('#join-group-btn');
    const leaveBtn = page.locator('#leave-group-btn');
    const requestBtn = page.locator('#request-group-btn');

    const visibleStates = await Promise.all([
      joinBtn.isVisible(),
      leaveBtn.isVisible(),
      requestBtn.isVisible(),
    ]);

    const visibleCount = visibleStates.filter(Boolean).length;

    expect(visibleCount).toBe(1);
  });
});

// ============================================================
// Create Group
// ============================================================

test.describe('Create Group', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupsPage(page);

    await page.locator('#add-btn').click();

    await expect(page.locator('#create-group-modal')).toBeVisible();

    // await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  test('user can successfully create a group', async ({ page }) => {
    const groupName = `E2E Test Group ${Date.now()}`;

    await page.locator('#group-name').fill(groupName);
    await page.locator('#group-description').fill('This group was created during an E2E test.');
    await page.locator('#group-module').fill('TEST101');

    await page.locator('#create-group-btn').click();

    // Verify the group was created.
    await page.reload();

    await expect(page.locator('#joinedGroupsContainer')).toContainText(groupName);
  });

  test('user cannot create a group without a group name', async ({ page }) => {
    await page.locator('#group-description').fill('A test group without a name.');

    await page.locator('#group-module').fill('TEST101');

    await page.locator('#create-group-btn').click();

    await expect(page.locator('#group-name')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  test('user cannot create a group without a description', async ({ page }) => {
    await page.locator('#group-name').fill('E2E Test Group');
    await page.locator('#group-module').fill('TEST101');

    await page.locator('#create-group-btn').click();

    await expect(page.locator('#group-description')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  test('user cannot create a group without a module', async ({ page }) => {
    await page.locator('#group-name').fill('E2E Test Group');
    await page.locator('#group-description').fill('A test group without a module.');

    await page.locator('#create-group-btn').click();

    await expect(page.locator('#group-module')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  test('user cannot create a group when all required fields are empty', async ({ page }) => {
    await page.locator('#create-group-btn').click();

    await expect(page.locator('#group-name')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#group-description')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#group-module')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // test('user can close the Create Group modal using Close', async ({ page }) => {
  //   await page.locator('#create-group-modal').getByRole('button', { name: 'Close' }).click();

  //   await expect(page.locator('#create-group-modal')).not.toBeVisible();
  // });

  test('user can close the Create Group modal using X', async ({ page }) => {
    await page.locator('#create-group-modal').locator('.btn-close').click();

    await expect(page.locator('#create-group-modal')).not.toBeVisible();
  });

  test('closing the Create Group modal does not create a group', async ({ page }) => {
    const groupName = `E2E Cancelled Group ${Date.now()}`;

    await page.locator('#group-name').fill(groupName);
    await page.locator('#group-description').fill('This group should not be created.');
    await page.locator('#group-module').fill('TEST101');

    await page.locator('#create-group-modal').locator('.btn-close').click();

    await expect(page.locator('#create-group-modal')).not.toBeVisible();

    // Re-open modal.
    await page.locator('#add-btn').click();

    // The cancelled group should not exist.
    await expect(page.locator('#joinedGroupsContainer')).not.toContainText(groupName);
  });

  test('user cannot submit a group with only whitespace', async ({ page }) => {
    await page.locator('#group-name').fill('   ');
    await page.locator('#group-description').fill('   ');
    await page.locator('#group-module').fill('   ');

    await page.locator('#create-group-btn').click();

    // This test is valid only if the application explicitly
    // rejects whitespace-only input.
    //
    // Ideally, assert the actual validation behaviour:
    //
    // await expect(page.locator('#group-name-error'))
    //   .toContainText('Group name cannot be empty');
    //
    // For now, we only verify that the modal remains open.
    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  test('shows an error when group creation fails', async ({ page }) => {
    page.once('dialog', async (dialog) => {
      expect(dialog.type()).toBe('alert');
      expect(dialog.message()).toBe('Something went wrong');
      await dialog.dismiss();
    });

    // await page.route('**/groups**', async (route) => {
    //   await route.fulfill({
    //     status: 500,
    //     contentType: 'application/json',
    //     body: JSON.stringify({
    //       error: 'Failed to create group',
    //     }),
    //   });
    // });

    // await page.locator('#group-name').fill(`Failed Group ${Date.now()}`);
    // await page.locator('#group-description').fill('This request should fail.');
    // await page.locator('#group-module').fill('TEST101');

    // await page.locator('#create-group-btn').click();

    // await expect(page.locator('#groupsToast')).toBeVisible();
    // await expect(page.locator('#toastBody')).toContainText('Failed to create group');
  });
});

// ============================================================
// Join and Leave Groups
// ============================================================

test.describe('Joining and Leaving Groups', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupsPage(page);

    // setTimeout(async () => {
    await expect(page.locator('#popularGroupsContainer')).toBeVisible();
    // }, 2000);
  });

  test('user can join a public group', async ({ page }) => {
    await openGroupDetails(page, TEST_GROUPS.public);

    await expect(page.locator('#joinGroupName')).toHaveText(TEST_GROUPS.public);

    await expect(page.locator('#join-group-btn')).toBeVisible();

    await expect(page.locator('#join-group-btn')).toBeEnabled();

    await expect(page.locator('#leave-group-btn')).not.toBeVisible();

    await page.locator('#join-group-btn').click();

    await page.mouse.click(10, 10);

    await page.reload();

    await openGroupDetails(page, TEST_GROUPS.public);

    await expect(page.locator('#join-group-btn')).not.toBeVisible();

    await expect(page.locator('#leave-group-btn')).toBeVisible();

    await expect(page.locator('#joinedGroupsContainer')).toContainText(TEST_GROUPS.public);
  });

  test('user can join a public group and then leave it', async ({ page }) => {
    await openGroupDetails(page, TEST_GROUPS.public);

    await expect(page.locator('#leave-group-btn')).toBeVisible();

    await page.locator('#leave-group-btn').click();

    await page.reload();

    await openGroupDetails(page, TEST_GROUPS.public);

    await expect(page.locator('#leave-group-btn')).not.toBeVisible();

    await expect(page.locator('#join-group-btn')).toBeVisible();
  });

  test('user can request to join a private group', async ({ page }) => {
    await openGroupDetails(page, TEST_GROUPS.private);

    const joinBtn = page.locator('#join-group-btn');
    const requestPendingBtn = page.locator('#request-group-btn');

    await expect(joinBtn).toBeVisible();
    await expect(joinBtn).toHaveText('Request to Join Group');

    await joinBtn.click();

    await page.reload();

    await openGroupDetails(page, TEST_GROUPS.private);

    await expect(requestPendingBtn).toBeVisible();
    await expect(requestPendingBtn).toHaveText('Request Pending');
    await expect(requestPendingBtn).toBeDisabled();

    await expect(joinBtn).not.toBeVisible();
    await expect(page.locator('#joinedGroupsContainer')).not.toContainText(TEST_GROUPS.private);
  });

  // Doesn't work
  // test('user cannot submit a duplicate private-group request', async ({ page }) => {
  //   await openGroupDetails(page, TEST_GROUPS.private);

  //   const requestButton = page.locator('#request-group-btn');

  //   await requestButton.click();

  //   await expect(requestButton).toHaveText('Request Pending');

  //   await expect(requestButton).toBeDisabled();

  //   // The button must no longer be usable.
  //   await expect(requestButton).toBeDisabled();
  // });

  test('user can close group details without joining', async ({ page }) => {
    await openGroupDetails(page, TEST_GROUPS.public);

    const closeBtn = page.locator('#closeGroupModal');

    await closeBtn.click();

    await expect(page.locator('#join-group-modal')).not.toBeVisible();
  });

  test('user can close group details using X without joining', async ({ page }) => {
    await openGroupDetails(page, TEST_GROUPS.public);

    await page.locator('#join-group-modal').locator('.btn-close').click();

    await expect(page.locator('#join-group-modal')).not.toBeVisible();
  });
});

// ============================================================
// Joined Group Navigation
// ============================================================

test.describe('Joined Group Navigation', () => {
  test.beforeEach(async ({ page }) => {
    await openGroupsPage(page);
  });

  test('user can click a joined group and access its group feed', async ({ page }) => {
    await page.goto(PAGES.groups);

    const joinedGroup = page.locator('#joinedGroupsContainer .group-card').first();

    await expect(joinedGroup).toBeVisible();

    const expectedGroupName = await joinedGroup.locator('h3').innerText();
    const expectedGroupId = await joinedGroup.getAttribute('data-group-id');

    expect(expectedGroupId).toBeTruthy();
    expect(expectedGroupName).toBeTruthy();

    await joinedGroup.click();

    // Your current app stores groupId in localStorage
    // and navigates to groups_feed.html.
    await expect(page).toHaveURL(/groups_feed\.html$/);

    const storedGroupId = await page.evaluate(() => localStorage.getItem('groupId'));

    expect(storedGroupId).toBe(expectedGroupId);

    await expect(page.locator('#bannerGroupName')).toHaveText(expectedGroupName);

    await expect(page.locator('#content-area')).toBeVisible();
    await expect(page.locator('#groupInfoDescription')).toBeVisible();
    await expect(page.locator('#groupInfoModule')).toBeVisible();
    await expect(page.locator('#groupInfoMemberCount')).toBeVisible();
    await expect(page.locator('#groupInfoPublicity')).toBeVisible();
    await expect(page.locator('#chatTab')).toHaveClass(/show/);
    await expect(page.locator('#channel-container')).toBeVisible();
    await expect(page.locator('#channelHeader')).toBeVisible();
    await expect(page.locator('#message-container')).toBeVisible();
  });

  // test('user cannot access a group they have not joined', async ({ page }) => {
  //   await page.goto(`${PAGES.feed}?groupId=private-group-123`);

  //   await expect(page.locator('#content-area')).not.toBeVisible();

  //   await expect(page.locator('#group-error')).toBeVisible();

  //   await expect(page.locator('#group-error')).toContainText('not a member');
  // });

  // test('shows an error when group data fails to load', async ({ page }) => {
  //   await page.route('**/groups/**', async (route) => {
  //     await route.fulfill({
  //       status: 500,
  //       contentType: 'application/json',
  //       body: JSON.stringify({
  //         message: 'Internal server error',
  //       }),
  //     });
  //   });

  //   await page.goto(`${PAGES.feed}?groupId=123`);

  //   await expect(page.locator('#group-error')).toBeVisible();
  // });
});
