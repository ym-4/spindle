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

  // Wait until groups have been rendered
  await expect(page.locator('#popularGroupsContainer .group-card').first()).toBeVisible();
}

async function openGroupFeed(page) {
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

async function openTasksTab(page) {
  await openGroupFeed(page);

  // Change this selector to whatever opens your Tasks tab.
  // For example:
  // await page.locator('[data-bs-target="#tasksTab"]').click();

  await page.locator('[data-bs-target="#tasksTab"]').click();

  await expect(page.locator('#tasksTab')).toBeVisible();
  await expect(page.locator('#createTaskModal')).toBeHidden();
}

async function openCreateTaskModal(page) {
  await page.locator('[data-bs-target="#createTaskModal"]').click();

  await expect(page.locator('#createTaskModal')).toBeVisible();
}

// ============================================================
// CREATE TASK TESTS
// ============================================================

test.describe('Create task', () => {
  // test('user can open the Create Task modal', async ({ page }) => {
  //   await openTasksTab(page);

  //   await openCreateTaskModal(page);

  //   await expect(page.getByRole('heading', { name: 'Create New Task' })).toBeVisible();

  //   await expect(page.locator('#taskTitleInput')).toBeVisible();
  //   await expect(page.locator('#taskDescriptionInput')).toBeVisible();
  //   await expect(page.locator('#assigneeDropdownBtn')).toBeVisible();
  //   await expect(page.locator('#taskDueDateInput')).toBeVisible();
  //   await expect(page.locator('#addSubtaskBtn')).toBeVisible();
  //   await expect(page.locator('#createTaskBtn')).toBeVisible();
  // });

  test('user can create a basic task with title and description', async ({ page }) => {
    await openTasksTab(page);
    await openCreateTaskModal(page);

    await expect(page.locator('#createTaskModal')).toBeVisible();

    const taskTitle = 'Complete E2E Testing';

    await page.locator('#taskTitleInput').fill(taskTitle);

    await page.locator('#taskDescriptionInput').fill('Write end-to-end tests for the task feature');

    await page.locator('#createTaskBtn').click();

    // Verify modal closes
    await expect(page.locator('#createTaskModal')).toBeHidden();

    // Verify task appears on the board
    await expect(page.locator('.task-card').filter({ hasText: taskTitle })).toBeVisible();
  });

  test('user can create a task with assignee and due date', async ({ page }) => {
    await openTasksTab(page);
    await openCreateTaskModal(page);

    await expect(page.locator('#createTaskModal')).toBeVisible();

    const taskTitle = 'Prepare Project Report';

    await page.locator('#taskTitleInput').fill(taskTitle);

    await page.locator('#taskDescriptionInput').fill('Prepare the final project report');

    // Open assignee dropdown
    await page.locator('#assigneeDropdownBtn').click();

    // Select Alice
    await page.locator('#dropdownMember').getByRole('link', { name: 'Alice' }).click();

    // Verify selected assignee
    await expect(page.locator('#assigneeDropdownBtn')).toHaveText('Alice');

    // Set due date
    await page.locator('#taskDueDateInput').fill('2026-08-10');

    await page.locator('#createTaskBtn').click();

    // Verify task was created
    const task = page.locator('.task-card').filter({ hasText: taskTitle });

    await expect(task).toBeVisible();

    // Verify task contains assignee
    await expect(task).toContainText('You');

    // Depending on your implementation, you may also assert
    // the formatted due date.
  });

  test('user can add multiple subtasks when creating a task', async ({ page }) => {
    await openTasksTab(page);
    await openCreateTaskModal(page);

    await expect(page.locator('#createTaskModal')).toBeVisible();

    await page.locator('#taskTitleInput').fill('Complete Group Assignment');

    await page.locator('#taskDescriptionInput').fill('Write end-to-end tests for the task feature');

    // The modal starts with one subtask input
    const subtaskInputs = page.locator('.subtask-input');

    await expect(subtaskInputs).toHaveCount(1);

    await subtaskInputs.first().fill('Research topic');

    // Add second subtask
    await page.locator('#addSubtaskBtn').click();

    await expect(subtaskInputs).toHaveCount(2);

    await subtaskInputs.nth(1).fill('Write report');

    // Add third subtask
    await page.locator('#addSubtaskBtn').click();

    await expect(subtaskInputs).toHaveCount(3);

    await subtaskInputs.nth(2).fill('Submit assignment');

    await page.locator('#createTaskBtn').click();

    const task = page.locator('.task-card').filter({ hasText: 'Complete Group Assignment' });

    await expect(task).toBeVisible();

    await expect(task).toContainText('Research topic');
    await expect(task).toContainText('Write report');
    await expect(task).toContainText('Submit assignment');
  });

  test('user can remove a subtask before creating a task', async ({ page }) => {
    await openTasksTab(page);
    await openCreateTaskModal(page);

    await expect(page.locator('#createTaskModal')).toBeVisible();

    const subtaskInputs = page.locator('.subtask-input');

    await subtaskInputs.first().fill('Keep this subtask');

    // Add another subtask
    await page.locator('#addSubtaskBtn').click();

    await expect(subtaskInputs).toHaveCount(2);

    await subtaskInputs.nth(1).fill('Remove this subtask');

    // Remove second subtask
    await page.locator('.removeSubtaskBtn').nth(1).click();

    await expect(subtaskInputs).toHaveCount(1);

    await expect(subtaskInputs.first()).toHaveValue('Keep this subtask');
  });

  test('user can cancel task creation', async ({ page }) => {
    await openTasksTab(page);
    await openCreateTaskModal(page);
    await expect(page.locator('#createTaskModal')).toBeVisible();

    await page.locator('#taskTitleInput').fill('This task should not be created');

    // Click Cancel in Create Task modal
    await page.locator('#createTaskModal').getByRole('button', { name: 'Cancel' }).click();

    await expect(page.locator('#createTaskModal')).toBeHidden();

    // Task should not appear
    await expect(
      page.locator('.task-card').filter({ hasText: 'This task should not be created' }),
    ).toHaveCount(0);
  });
});

// ============================================================
// FILTER TESTS
// ============================================================

// test.describe('Filter Task', () => {
//   test('user can filter tasks', async ({ page }) => {
//     await openTasksTab(page);

//     await page.locator('#filterDropdown').click();

//     await page.locator('.filter-option[data-filter="assigned"]').click();

//     // Verify filter button changed or filtered results are shown.
//     // Adjust this assertion based on your implementation.
//     await expect(page.locator('#filterDropdown')).toContainText('Filter');
//   });

//   test('user can filter unassigned tasks', async ({ page }) => {
//     await openTasksTab(page);

//     await page.locator('#filterDropdown').click();

//     await page.locator('.filter-option[data-filter="unassigned"]').click();

//     // Add assertions based on your filtering implementation.
//   });

//   test('user can filter overdue tasks', async ({ page }) => {
//     await openTasksTab(page);

//     await page.locator('#filterDropdown').click();

//     await page.locator('.filter-option[data-filter="overdue"]').click();

//     // Add assertions based on your filtering implementation.
//   });
// });

// ============================================================
// TASK COMPLETION TESTS
// ============================================================

test.describe('Complete task and subtasks', () => {
  test('user can complete a subtask', async ({ page }) => {
    await openTasksTab(page);

    const task = page.locator('.task-card').filter({
      hasText: 'Build Login Page',
    });

    const subtask = task.locator('.subtask').filter({
      hasText: 'Connect Login API',
    });

    const icon = subtask.locator('.subtask-icon');

    await expect(subtask).toBeVisible();

    // Complete
    await subtask.click();

    await expect(subtask).toHaveClass(/completed/);
    await expect(icon).toHaveClass(/bi-check-square-fill/);

    // Uncomplete
    await subtask.click();

    await expect(subtask).not.toHaveClass(/completed/);
    await expect(icon).toHaveClass(/bi-square/);
    await expect(icon).not.toHaveClass(/bi-check-square-fill/);
  });

  test('user can drag task from Todo to In Progress', async ({ page }) => {
    await openTasksTab(page);

    const task = page.locator('[data-status="todo"] .task-card').filter({
      hasText: 'Build Login Page',
    });

    await expect(task).toBeVisible();

    const target = page.locator('[data-status="in_progress"]');

    await task.dragTo(target);

    await expect(
      page.locator('[data-status="in_progress"] .task-card').filter({
        hasText: 'Build Login Page',
      }),
    ).toBeVisible();
  });
});

// ============================================================
// EDIT AND DELETE TASK TESTS
// ============================================================

test.describe('Edit and Delete tasks', () => {
  test('user can edit an existing task', async ({ page }) => {
    await openTasksTab(page);

    const originalTitle = 'Build Login Page';
    const updatedTitle = 'Build Login Page - Updated';

    const task = page.locator('.task-card').filter({
      hasText: originalTitle,
    });

    await expect(task).toBeVisible();

    await task.locator('.edit-task-btn').click();

    await expect(page.locator('#editTaskModal')).toBeVisible();

    await page.locator('#editTaskTitle').fill(updatedTitle);

    await page.locator('#editTaskDescription').fill('Updated task description');

    await page.locator('#editTaskDueDate').fill('2026-08-20');

    await page.locator('#saveTaskBtn').click();

    await expect(page.locator('#editTaskModal')).toBeHidden();

    await expect(
      page.locator('.task-card').filter({
        hasText: updatedTitle,
      }),
    ).toBeVisible();
  });

  test('user can delete a task', async ({ page }) => {
    await openTasksTab(page);

    const taskTitle = 'Build Login Page - Updated';

    const task = page.locator('.task-card').filter({ hasText: taskTitle });

    await expect(task).toBeVisible();

    await task.locator('.edit-task-btn').click();

    await expect(page.locator('#editTaskModal')).toBeVisible();

    await page.locator('#deleteTaskBtn').click();

    await expect(page.locator('#confirmDeleteModal')).toBeVisible();

    await page.locator('#confirmDeleteBtn').click();

    await expect(page.locator('#confirmDeleteModal')).toBeHidden();

    await expect(page.locator('.task-card').filter({ hasText: taskTitle })).toHaveCount(0);
  });
});
