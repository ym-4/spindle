const { test, expect } = require('@playwright/test');

// ── Helper ───────────────────────────────────────────────
const BASE_URL = 'http://localhost:3000/index.html';

// const url = 'http://localhost:3000/groups.html';

// // Helpers
// test.beforeEach(async ({ page }) => {
//   await page.goto(url);
// });

// ------------------------------------------
// View Groups
// ------------------------------------------
test.describe('View Groups', () => {
  // Valid partition: User sees groups
  test('user can view groups for a school', async ({ page }) => {
    // Go to the school selection page
    await page.goto('http://localhost:3000/groups.html');

    // Click the School of Computing (SOC) button
    await page.click('#soc');

    // User should be redirected to groups_page.html
    await expect(page).toHaveURL(/groups_page\.html/);

    // The page should display the School of Computing heading
    await expect(page.locator('#school-name')).toHaveText('School of Computing');

    // Wait for the groups API request and rendering to finish
    await expect(page.locator('#popularGroupsContainer .group-card').first()).toBeVisible();

    // Check that at least one group is displayed
    const groupCards = page.locator('#popularGroupsContainer .group-card');

    await expect(groupCards.first()).toBeVisible();

    // Check that the group card contains a group name
    await expect(groupCards.first().locator('h3')).toBeVisible();

    // Check that the group card contains a description
    await expect(groupCards.first().locator('p')).toBeVisible();

    // Check that the group card contains module/member information
    await expect(groupCards.first().locator('.group-footer')).toBeVisible();
  });

  // Valid partition: User clicks on group to see group details
  test('user can click on a group and view group details', async ({ page }) => {
    // Open the school selection page
    await page.goto('http://localhost:3000/groups.html');

    // Select School of Computing
    await page.click('#soc');

    // Verify that we are on the groups page
    await expect(page).toHaveURL(/groups_page\.html/);

    // Verify that the school name is displayed
    await expect(page.locator('#school-name')).toHaveText('School of Computing');

    // Wait for at least one group to appear
    const firstGroup = page.locator('#popularGroupsContainer .group-card').first();

    await expect(firstGroup).toBeVisible();

    // Get the group name before clicking
    const groupName = await firstGroup.locator('h3').innerText();

    // Click the first group
    await firstGroup.click();

    // Verify that the Group Details modal is visible
    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Verify that the modal displays the correct group name
    await expect(page.locator('#joinGroupName')).toHaveText(groupName);

    // Verify that group details are displayed
    await expect(page.locator('#joinGroupDescription')).toBeVisible();
    await expect(page.locator('#joinGroupModule')).toBeVisible();
    await expect(page.locator('#joinGroupMembers')).toBeVisible();
    await expect(page.locator('#joinGroupSchool')).toBeVisible();

    // Verify that the Join button is visible
    await expect(page.locator('#join-group-btn')).toBeVisible();
  });
});

// ------------------------------------------
// Create Group
// ------------------------------------------

test.describe('Create Group', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/groups.html');

    // Open the Create Group modal before each test
    await page.locator('#add-btn').click();

    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // Valid partition: Group created
  test('user can successfully create a group', async ({ page }) => {
    // Fill in all required fields
    await page.locator('#group-name').fill('E2E Test Group');
    await page.locator('#group-description').fill('This group was created during an E2E test.');
    await page.locator('#group-module').fill('TEST101');

    // Click Create
    await page.locator('#create-group-btn').click();

    // Verify the group appears in the group list
    await expect(page.locator('#joinedGroupsContainer')).toContainText('E2E Test Group');
  });

  // Invalid partition: missing group name
  test('user cannot create a group without a group name', async ({ page }) => {
    // Leave group name empty
    await page.locator('#group-description').fill('A test group without a name.');

    await page.locator('#group-module').fill('TEST101');

    // Try to create the group
    await page.locator('#create-group-btn').click();

    // HTML required validation should prevent submission
    await expect(page.locator('#group-name')).toHaveJSProperty('validity.valid', false);

    // Modal should still be visible
    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // Invalid partition: missing group description
  test('user cannot create a group without a description', async ({ page }) => {
    await page.locator('#group-name').fill('E2E Test Group');

    // Leave description empty
    await page.locator('#group-module').fill('TEST101');

    await page.locator('#create-group-btn').click();

    // Verify required validation
    await expect(page.locator('#group-description')).toHaveJSProperty('validity.valid', false);

    // Modal remains open
    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // Invalid partition: missing group module
  test('user cannot create a group without a module', async ({ page }) => {
    await page.locator('#group-name').fill('E2E Test Group');
    await page.locator('#group-description').fill('A test group without a module.');

    // Leave module empty
    await page.locator('#create-group-btn').click();

    // Verify required validation
    await expect(page.locator('#group-module')).toHaveJSProperty('validity.valid', false);

    // Modal remains open
    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // Invalid partition: missing required fields
  test('user cannot create a group when all fields are empty', async ({ page }) => {
    // Click Create without entering anything
    await page.locator('#create-group-btn').click();

    // All required fields should be invalid
    await expect(page.locator('#group-name')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#group-description')).toHaveJSProperty('validity.valid', false);

    await expect(page.locator('#group-module')).toHaveJSProperty('validity.valid', false);

    // Modal should remain open
    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // Valid partition: User closes modal using close button
  test('user can close the Create Group modal using the Close button', async ({ page }) => {
    // Click Close
    await page.locator('#create-group-modal').getByRole('button', { name: 'Close' }).click();

    // Modal should no longer be visible
    await expect(page.locator('#create-group-modal')).not.toBeVisible();
  });

  // Valid partition: User closes modal using x button
  test('user can close the Create Group modal using the X button', async ({ page }) => {
    // Click the X button
    await page.locator('#create-group-modal').locator('.btn-close').click();

    // Modal should no longer be visible
    await expect(page.locator('#create-group-modal')).not.toBeVisible();
  });

  // Valid partition: Closing modal does not create group
  test('closing the modal does not create a group', async ({ page }) => {
    // Fill in group details
    await page.locator('#group-name').fill('Group That Should Not Exist');
    await page.locator('#group-description').fill('This group should not be created.');

    await page.locator('#group-module').fill('TEST101');

    // Close using X
    await page.locator('#create-group-modal').locator('.btn-close').click();

    // Modal should be closed
    await expect(page.locator('#create-group-modal')).not.toBeVisible();

    // Re-open the modal
    await page.locator('#add-btn').click();

    // The group should not have been created
    await expect(page.locator('#joinedGroupsContainer')).not.toContainText(
      'Group That Should Not Exist',
    );
  });

  // Invalid partition: spaces for required fields
  test('user cannot submit a group with only whitespace', async ({ page }) => {
    await page.locator('#group-name').fill('   ');
    await page.locator('#group-description').fill('   ');
    await page.locator('#group-module').fill('   ');

    await page.locator('#create-group-btn').click();

    // NOTE:
    // The current HTML `required` attribute does NOT reject whitespace.
    // This test will only pass if your JavaScript validates trimmed values.
    //
    // Example expected behaviour:
    // "Group name cannot be empty."

    await expect(page.locator('#create-group-modal')).toBeVisible();
  });

  // Error handling: server error
  test('handles server error when creating a group', async ({ page }) => {
    // Mock the API request to simulate a server failure
    await page.route('**/api/groups**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          error: 'Failed to create group',
        }),
      });
    });

    await page.locator('#group-name').fill('Failed Group');
    await page.locator('#group-description').fill('This request should fail.');

    await page.locator('#group-module').fill('TEST101');

    await page.locator('#create-group-btn').click();

    // Expected behaviour:
    // The modal stays open and an error message/toast is shown.
    //
    // Update the selector below to match your actual error message.
    await expect(page.locator('#groupsToast')).toBeVisible();

    await expect(page.locator('#toastBody')).toContainText('Failed to create group');
  });
});

// ------------------------------------------
// Join and Leave Group
// ------------------------------------------

test.describe('Joining and Leaving Groups', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('http://localhost:3000/groups.html');

    // Wait for the groups to load
    await expect(page.locator('#popularGroupsContainer')).toBeVisible();
  });

  // Valid partition: joined public group
  test('user can join a public group', async ({ page }) => {
    // Find and click a public group
    // Replace this selector with the actual group card selector
    await page
      .locator('#popularGroupsContainer .group-card')
      .filter({ hasText: 'Public Test Group' })
      .click();

    // Verify group details modal opens
    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Verify group information
    await expect(page.locator('#joinGroupName')).toHaveText('Public Test Group');

    // Public group should show the Join button
    await expect(page.locator('#join-group-btn')).toBeVisible();
    await expect(page.locator('#join-group-btn')).toBeEnabled();

    // Leave button should not be available yet
    await expect(page.locator('#leave-group-btn')).not.toBeVisible();

    // Click Join
    await page.locator('#join-group-btn').click();

    // Verify the user has joined
    // This depends on your application's behaviour.
    // For example, the Join button may disappear
    // and Leave button may appear.
    await expect(page.locator('#join-group-btn')).not.toBeVisible();
    await expect(page.locator('#leave-group-btn')).toBeVisible();

    // Verify the group now appears in Joined Groups
    await expect(page.locator('#joinedGroupsContainer')).toContainText('Public Test Group');
  });

  // Valid partition: joined public group and then leave
  test('user can join a public group and then leave it', async ({ page }) => {
    // Open public group
    await page
      .locator('#popularGroupsContainer .group-card')
      .filter({ hasText: 'Public Test Group' })
      .click();

    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Join group
    await page.locator('#join-group-btn').click();

    // Verify Leave button appears
    await expect(page.locator('#leave-group-btn')).toBeVisible();

    // Leave the group
    await page.locator('#leave-group-btn').click();

    // Verify the user is no longer a member
    await expect(page.locator('#leave-group-btn')).not.toBeVisible();

    // Join button should become available again
    await expect(page.locator('#join-group-btn')).toBeVisible();
  });

  // Valid partition: request to join private group
  test('user can request to join a private group', async ({ page }) => {
    // Find and click a private group
    await page
      .locator('#popularGroupsContainer .group-card')
      .filter({ hasText: 'Private Test Group' })
      .click();

    // Verify group details modal opens
    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Private group should show Request button
    await expect(page.locator('#request-group-btn')).toBeVisible();
    await expect(page.locator('#request-group-btn')).toBeEnabled();

    // User should not immediately be added as a member
    await expect(page.locator('#leave-group-btn')).not.toBeVisible();

    // Send join request
    await page.locator('#request-group-btn').click();

    // Verify request is now pending
    await expect(page.locator('#request-group-btn')).toHaveText('Request Pending');

    // Button should be disabled to prevent duplicate requests
    await expect(page.locator('#request-group-btn')).toBeDisabled();

    // User should NOT appear as a joined member yet
    await expect(page.locator('#joinedGroupsContainer')).not.toContainText('Private Test Group');
  });

  // Valid partition: multiple request to join private group fails
  test('user cannot send multiple join requests to a private group', async ({ page }) => {
    // Open private group
    await page
      .locator('#popularGroupsContainer .group-card')
      .filter({ hasText: 'Private Test Group' })
      .click();

    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Send first request
    await page.locator('#request-group-btn').click();

    // Verify request is pending
    await expect(page.locator('#request-group-btn')).toHaveText('Request Pending');

    // Verify button is disabled
    await expect(page.locator('#request-group-btn')).toBeDisabled();

    // User should not be able to click it again
    await expect(page.locator('#request-group-btn')).toHaveCount(1);
  });

  // Valid partition: user can close modal without joining group with close button
  test('user can close group details without joining', async ({ page }) => {
    // Open public group
    await page
      .locator('#popularGroupsContainer .group-card')
      .filter({ hasText: 'Public Test Group' })
      .click();

    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Close modal
    await page.locator('#join-group-modal').getByRole('button', { name: 'Close' }).click();

    // Modal should close
    await expect(page.locator('#join-group-modal')).not.toBeVisible();

    // Verify user did not join
    await expect(page.locator('#joinedGroupsContainer')).not.toContainText('Public Test Group');
  });

  // Valid partition: user can close modal without joining group with x button
  test('user can close group details using X without joining', async ({ page }) => {
    // Open public group
    await page
      .locator('#popularGroupsContainer .group-card')
      .filter({ hasText: 'Public Test Group' })
      .click();

    await expect(page.locator('#join-group-modal')).toBeVisible();

    // Click X
    await page.locator('#join-group-modal').locator('.btn-close').click();

    // Verify modal closed
    await expect(page.locator('#join-group-modal')).not.toBeVisible();

    // Verify user did not join
    await expect(page.locator('#joinedGroupsContainer')).not.toContainText('Public Test Group');
  });
});

// ------------------------------------------
// Delete Group
// ------------------------------------------

test.describe('Delete a group owned by the user', () => {
  // Valid partition: can delete group if owner
  test('owner can permanently delete their group after confirmation', async ({ page }) => {
    // Precondition:
    // User is logged in as the owner of the group.
    // Replace this with your actual login/setup logic if required.
    await page.goto('/groups_admin.html');

    // Verify that the user is on the group admin page.
    await expect(page).toHaveTitle(/Groups feed/i);
    await expect(page.getByText('Manage Group')).toBeVisible();

    // Open the Delete Group modal.
    await page.locator('[data-bs-target="#deleteGroupModal"]').click();

    // Verify that the modal is displayed.
    const deleteModal = page.locator('#deleteGroupModal');
    await expect(deleteModal).toBeVisible();

    // Verify the warning and confirmation instructions.
    await expect(
      deleteModal.getByText('Are you sure you want to permanently delete this group?'),
    ).toBeVisible();

    await expect(deleteModal.getByText('This action cannot be undone.')).toBeVisible();

    await expect(deleteModal.getByText(/Type DELETE to confirm/i)).toBeVisible();

    // Delete button should initially be disabled.
    const deleteButton = page.locator('#confirmDeleteGroup');
    await expect(deleteButton).toBeDisabled();

    // Enter an incorrect confirmation value.
    await page.locator('#deleteGroupConfirm').fill('delete');

    // Button should remain disabled because the confirmation is not exactly "DELETE".
    await expect(deleteButton).toBeDisabled();

    // Enter the correct confirmation value.
    await page.locator('#deleteGroupConfirm').fill('DELETE');

    // Delete button should now be enabled.
    await expect(deleteButton).toBeEnabled();

    // Click Delete Group.
    await deleteButton.click();

    // Verify that the group is deleted and the user is redirected.
    await expect(page).toHaveURL(/groups(_page|_feed)?\.html/);

    // Verify that the deleted group no longer appears.
    await expect(page.getByText('SOC Study Group')).not.toBeVisible();
  });

  // Valid partition: can cancel group deletion
  test('owner can cancel group deletion', async ({ page }) => {
    await page.goto('/groups_admin.html?groupId=123');

    await page.locator('[data-testid="delete-group-button"]').click();

    const modal = page.locator('[data-testid="delete-group-modal"]');

    await expect(modal).toBeVisible();

    await modal.locator('[data-testid="cancel-delete-group"]').click();

    await expect(modal).not.toBeVisible();

    // Group should still exist
    await expect(page.locator('[data-testid="group-name"]')).toBeVisible();
  });

  // Invalid partition: non owner members cannot delete group
  test('non-owner cannot delete a group', async ({ page }) => {
    await page.goto('/groups_feed.html?groupId=123');

    // Manage Group should not be available
    await expect(page.locator('#manageGroupButton')).not.toBeVisible();
  });

  // Valid partition: non owner cannot see group deletion
  test('non-owner cannot access group deletion controls', async ({ page }) => {
    await page.goto('/groups_admin.html?groupId=123');

    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();

    await expect(page.locator('[data-testid="delete-group-button"]')).not.toBeVisible();
  });

  // Valid partition: can close delete confirmation without deleting gorup
  test('owner can close delete confirmation without deleting group', async ({ page }) => {
    await page.goto('/groups_admin.html?groupId=123');

    await page.locator('[data-testid="delete-group-button"]').click();

    const modal = page.locator('[data-testid="delete-group-modal"]');

    await expect(modal).toBeVisible();

    await modal.locator('.btn-close').click();

    await expect(modal).not.toBeVisible();

    // Group still exists
    await expect(page.locator('[data-testid="group-name"]')).toBeVisible();
  });

  // Error handling: sees error when group deletion fails
  test('owner sees error when group deletion fails', async ({ page }) => {
    await page.route('**/api/groups/123', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Failed to delete group',
        }),
      });
    });

    await page.goto('/groups_admin.html?groupId=123');

    await page.locator('[data-testid="delete-group-button"]').click();

    await page.locator('[data-testid="confirm-delete-group"]').click();

    // User should remain on the page
    await expect(page).toHaveURL(/groups_admin\.html/);

    // Error should be displayed
    await expect(page.locator('[data-testid="group-delete-error"]')).toBeVisible();

    await expect(page.locator('[data-testid="group-delete-error"]')).toContainText(
      'Failed to delete group',
    );
  });
});

// ------------------------------------------
// Go to groups page
// ------------------------------------------

test.describe('Joined Group Navigation', () => {
  // Valid partition: user can click on joined group and see feed
  test('user can click a joined group and access its group feed', async ({ page }) => {
    // 1. Navigate to Groups page
    await page.goto('/groups_page.html');

    // 2. Find a group the user has already joined
    const joinedGroup = page.locator('[data-testid="joined-group"]').first();

    // Ensure the joined group is visible
    await expect(joinedGroup).toBeVisible();

    // Capture expected group information before clicking
    const expectedGroupName = await joinedGroup.locator('[data-testid="group-name"]').textContent();

    const expectedGroupId = await joinedGroup.getAttribute('data-group-id');

    // 3. Click the joined group
    await joinedGroup.click();

    // 4. Wait for navigation
    await page.waitForLoadState('domcontentloaded');

    // 5. Verify user is redirected to Group Feed
    await expect(page).toHaveURL(new RegExp(`groups_feed\\.html\\?groupId=${expectedGroupId}`));

    // 6. Verify group name is displayed
    await expect(page.locator('#bannerGroupName')).toHaveText(expectedGroupName);

    // 7. Verify Group Feed is loaded
    await expect(page.locator('#content-area')).toBeVisible();

    // 8. Verify group information is displayed
    await expect(page.locator('#groupInfoDescription')).toBeVisible();
    await expect(page.locator('#groupInfoModule')).toBeVisible();
    await expect(page.locator('#groupInfoMemberCount')).toBeVisible();
    await expect(page.locator('#groupInfoPublicity')).toBeVisible();

    // 9. Verify Chat tab is active
    await expect(page.locator('#chatTab')).toHaveClass(/show/);

    // 10. Verify channels are displayed
    await expect(page.locator('#channel-container')).toBeVisible();
    await expect(page.locator('#generalChannel')).toBeVisible();

    // 11. Verify the user can access group content
    await expect(page.locator('#message-container')).toBeVisible();
  });

  // Invalid partition: no group id
  test('user cannot access group feed without a group ID', async ({ page }) => {
    await page.goto('/groups_feed.html');

    // User should be redirected back to Groups
    await expect(page).toHaveURL(/groups_page\.html/);
  });

  // Invalid partition: group does not exist
  test('user cannot access a non-existent group', async ({ page }) => {
    await page.goto('/groups_feed.html?groupId=does-not-exist');

    // Wait for error handling
    await expect(page.locator('[data-testid="group-error"]')).toBeVisible();

    await expect(page.locator('[data-testid="group-error"]')).toContainText('group');
  });

  // Invalid partition: user did not join the group
  test('user cannot access a group they have not joined', async ({ page }) => {
    await page.goto('/groups_feed.html?groupId=private-group-123');

    // User should not see the group feed
    await expect(page.locator('#content-area')).not.toBeVisible();

    // User should receive an access error
    await expect(page.locator('[data-testid="access-denied"]')).toBeVisible();

    await expect(page.locator('[data-testid="access-denied"]')).toContainText('not a member');
  });

  // Invalid partition: user cannot see deleted group
  test('user cannot access a deleted group', async ({ page }) => {
    await page.goto('/groups_feed.html?groupId=deleted-group-123');

    await expect(page.locator('[data-testid="group-error"]')).toBeVisible();

    await expect(page.locator('[data-testid="group-error"]')).toContainText('no longer available');
  });

  // Error handling: error shown if group data does not load
  test('user sees an error when group data fails to load', async ({ page }) => {
    await page.route('**/api/groups/**', async (route) => {
      await route.fulfill({
        status: 500,
        contentType: 'application/json',
        body: JSON.stringify({
          message: 'Internal server error',
        }),
      });
    });

    await page.goto('/groups_feed.html?groupId=123');

    await expect(page.locator('[data-testid="group-error"]')).toBeVisible();

    await expect(page.locator('[data-testid="retry-button"]')).toBeVisible();
  });
});
