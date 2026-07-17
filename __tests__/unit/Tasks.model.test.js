const pool = require('../../src/models/db');
const {
  getTasksByGroupID,
  getTasksByUserAndGroupID,
  insertTasks,
  updateTasks,
  deleteTasks,
  getTaskItemsByTaskID,
  insertTaskItems,
  updateTaskItems,
  deleteTaskItems,
  getTaskItemsByUserAndGroupID,
} = require('../../src/models/Tasks.model');

// Mocking
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// --------------------------------------------
// Unit Test 1 - Get tasks by group
// --------------------------------------------
describe('Tasks.model - getTasksByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all tasks for a group from the database', async () => {
    const fakeTasks = [
      {
        task_id: 1,
        title: 'Task 1',
        group_id: 5,
      },
      {
        task_id: 2,
        title: 'Task 2',
        group_id: 5,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeTasks,
    });

    // Get tasks for group_id (5)
    const result = await getTasksByGroupID({
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupTasks" WHERE group_id = $1', [5]);
    expect(result).toEqual(fakeTasks);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 tasks by group id from the database', async () => {
    const fakeTasks = [
      {
        task_id: 1,
        title: 'Task 1',
        group_id: 5,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeTasks,
    });

    // Get tasks for group_id (5)
    const result = await getTasksByGroupID({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupTasks" WHERE group_id = $1', [5]);
    expect(result).toEqual(fakeTasks);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no tasks exist', async () => {
    const fakeTasks = [];

    pool.query.mockResolvedValue({
      rows: fakeTasks,
    });

    // Get tasks for group_id (5)
    const result = await getTasksByGroupID({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupTasks" WHERE group_id = $1', [5]);
    expect(result).toEqual(fakeTasks);
  });

  // Boundary: group_id < 0 (below accepted range)
  test('should return no tasks from the database', async () => {
    const fakeTasks = [
      {
        task_id: 1,
        title: 'Task 1',
        group_id: 5,
      },
    ];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get tasks for group_id (-1)
    const result = await getTasksByGroupID({
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupTasks" WHERE group_id = $1', [-1]);
    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(getTasksByGroupID({ group_id: 1 })).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 2 - Get assigned tasks
// --------------------------------------------
describe('Tasks.model - getTasksByUserAndGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all tasks for a user and group from the database', async () => {
    const fakeTasks = [
      { task_id: 1, group_id: 5, assignee_id: 2 },
      { task_id: 2, group_id: 5, assignee_id: 2 },
    ];

    pool.query.mockResolvedValue({
      rows: fakeTasks,
    });

    // Get assigned tasks for user_id (2) and group_id (5)
    const result = await getTasksByUserAndGroupID({
      user_id: 2,
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupTasks" WHERE assignee_id = $1 AND group_id = $2',
      [2, 5],
    );
    expect(result).toEqual(fakeTasks);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 tasks by group id from the database', async () => {
    const fakeTasks = [{ task_id: 1, group_id: 5, assignee_id: 2 }];

    pool.query.mockResolvedValue({
      rows: fakeTasks,
    });

    // Get assigned tasks for user_id (2) and group_id (5)
    const result = await getTasksByUserAndGroupID({
      user_id: 2,
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupTasks" WHERE assignee_id = $1 AND group_id = $2',
      [2, 5],
    );
    expect(result).toEqual(fakeTasks);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no tasks exist for user', async () => {
    const fakeTasks = [];

    pool.query.mockResolvedValue({
      rows: fakeTasks,
    });

    // Get assigned tasks for user_id (2) and group_id (5)
    const result = await getTasksByUserAndGroupID({
      user_id: 2,
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupTasks" WHERE assignee_id = $1 AND group_id = $2',
      [2, 5],
    );
    expect(result).toEqual(fakeTasks);
  });

  // Boundary: user_id < 0 (below accepted range)
  test('should return no tasks from the database', async () => {
    const fakeTasks = [
      { task_id: 1, group_id: 5, assignee_id: 2 },
      { task_id: 2, group_id: 5, assignee_id: 2 },
    ];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get tasks for user_id (-1) and group_id (5)
    const result = await getTasksByUserAndGroupID({
      user_id: -1,
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupTasks" WHERE assignee_id = $1 AND group_id = $2',
      [-1, 5],
    );
    expect(result).toEqual([]);
  });

  // Boundary: group_id < 0 (below accepted range)
  test('should return no tasks from the database', async () => {
    const fakeTasks = [
      { task_id: 1, group_id: 5, assignee_id: 2 },
      { task_id: 2, group_id: 5, assignee_id: 2 },
    ];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get tasks for user_id (2) and group_id (-1)
    const result = await getTasksByUserAndGroupID({
      user_id: 2,
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupTasks" WHERE assignee_id = $1 AND group_id = $2',
      [2, -1],
    );
    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(getTasksByUserAndGroupID({ user_id: 2, group_id: 5 })).rejects.toThrow(
      'connection refused',
    );
  });
});

// --------------------------------------------
// Unit Test 3 - Create tasks
// --------------------------------------------
describe('Tasks.model - insertTasks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: task created
  test('should insert new task to the database', async () => {
    const dueDate = new Date();

    const newFakeTask = {
      id: 10,
      group_id: 5,
      creator_id: 1,
      title: 'Finish CA4',
      description: 'Write unit tests',
      assignee_id: 2,
      due_date: dueDate,
    };

    pool.query.mockResolvedValue({
      rows: newFakeTask,
    });

    // Create task
    const result = await insertTasks({
      group_id: 5,
      creator_id: 1,
      title: 'Finish CA4',
      description: 'Write unit tests',
      assignee_id: 2,
      due_date: dueDate,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupTasks" (group_id, creator_id, assignee_id, title, description, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [5, 1, 2, 'Finish CA4', 'Write unit tests', dueDate],
    );
    expect(result).toEqual(newFakeTask);
  });

  // Boundary: empty optional fields (description, assignee_id, due_date)
  test('should insert new task with no description, assignee_id and due_date to the database', async () => {
    const newFakeTask = {
      id: 10,
      group_id: 5,
      creator_id: 1,
      title: 'Finish CA4',
    };

    pool.query.mockResolvedValue({
      rows: newFakeTask,
    });

    // Create task
    const result = await insertTasks({
      group_id: 5,
      creator_id: 1,
      title: 'Finish CA4',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupTasks" (group_id, creator_id, assignee_id, title, description, due_date) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *',
      [5, 1, undefined, 'Finish CA4', undefined, undefined],
    );
    expect(result).toEqual(newFakeTask);
  });

  // Boundary: null values
  test('should not insert new task to the database', async () => {
    const newFakeTask = {
      id: 10,
      group_id: null,
      creator_id: null,
      title: null,
      description: 'Write unit tests',
      assignee_id: 2,
      due_date: new Date(),
    };

    pool.query.mockRejectedValue(
      new Error('null value in column "group_id" violates not-null constraint'),
    );

    await expect(
      insertTasks({
        group_id: null,
        creator_id: null,
        title: null,
        description: 'Write unit tests',
        assignee_id: 2,
        due_date: new Date(),
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(
      insertTasks({
        id: 10,
        group_id: 5,
        creator_id: 1,
        title: 'Finish CA4',
      }),
    ).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 4 - Update tasks
// --------------------------------------------
describe('Tasks.model - updateTasks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Task updated with optional fields
  test('should insert new task to the database', async () => {
    const date = new Date();

    const newUpdatedTask = {
      id: 1,
      assignee_id: 2,
      title: 'Updated',
      description: 'Updated desc',
      due_date: date,
      status: 'Completed',
    };

    pool.query.mockResolvedValue({
      rows: newUpdatedTask,
    });

    // Update task
    const result = await updateTasks({
      id: 1,
      assignee_id: 2,
      title: 'Updated',
      description: 'Updated desc',
      due_date: date,
      status: 'Completed',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupTasks" SET assignee_id = $1, title = $2, description = $3, due_date = $4, status = $5 WHERE id = $6 RETURNING *',
      [2, 'Updated', 'Updated desc', date, 'Completed', 1],
    );
    expect(result).toEqual(newUpdatedTask);
  });

  // Valid partition: Task updated no optional fields
  test('should insert new task without optional fields to the database', async () => {
    const date = new Date();

    const newUpdatedTask = {
      id: 1,
      title: 'Updated',
      status: 'Completed',
    };

    pool.query.mockResolvedValue({
      rows: newUpdatedTask,
    });

    // Update task
    const result = await updateTasks({
      id: 1,
      title: 'Updated',
      status: 'Completed',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupTasks" SET assignee_id = $1, title = $2, description = $3, due_date = $4, status = $5 WHERE id = $6 RETURNING *',
      [undefined, 'Updated', undefined, undefined, 'Completed', 1],
    );
    expect(result).toEqual(newUpdatedTask);
  });

  // Invalid partition: Task does not exist
  test('should not update task to the database', async () => {
    const date = new Date();

    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateTasks({
      id: -1,
      assignee_id: 2,
      title: 'Updated',
      description: 'Updated desc',
      due_date: date,
      status: 'Completed',
    });

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    const date = new Date();
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(
      updateTasks({
        id: 1,
        assignee_id: 2,
        title: 'Updated',
        description: 'Updated desc',
        due_date: date,
        status: 'Completed',
      }),
    ).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 5 - Delete tasks
// --------------------------------------------
describe('Tasks.model - deleteTasks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Task delete successfully
  test('should delete task from the database', async () => {
    const deletedFakeTask = {
      id: 1,
      creator_id: 2,
    };

    pool.query.mockResolvedValue({
      rows: [deletedFakeTask],
    });

    // Update task
    const result = await deleteTasks({
      id: 1,
      creator_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "GroupTasks" WHERE id = $1 AND creator_id = $2 RETURNING *',
      [1, 2],
    );
    expect(result).toEqual([deletedFakeTask]);
  });

  // Invalid partition: Wrong creator
  test('should not delete task from the database (wrong creator)', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteTasks({
      id: 1,
      creator_id: 999,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "GroupTasks" WHERE id = $1 AND creator_id = $2 RETURNING *',
      [1, 999],
    );
    expect(result).toEqual([]);
  });

  // Invalid partition: Invalid Task ID
  test('should not delete task from the database (Invalid Task ID)', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteTasks({
      creator_id: 2,
    });

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(deleteTasks({ id: 1, user_id: 1 })).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 6 - Get task items
// --------------------------------------------
describe('Tasks.model - getTaskItemsByTaskID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all tasks items for a task from the database', async () => {
    const fakeTaskItems = [
      { id: 1, task_id: 5, text: 'Item 1' },
      { id: 2, task_id: 5, text: 'Item 2' },
    ];

    pool.query.mockResolvedValue({ rows: fakeTaskItems });

    const result = await getTaskItemsByTaskID({ task_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupTaskItems" WHERE task_id = $1',
      [5],
    );

    expect(result).toEqual(fakeTaskItems);
  });

  // Boundary: zero rows – empty result set
  test('should return empty array when task has no items', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getTaskItemsByTaskID({ task_id: 5 });

    expect(result).toEqual([]);
  });

  // Boundary: Invalid task ID
  test('should return empty array for invalid task id', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getTaskItemsByTaskID({ task_id: -1 });

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(getTaskItemsByTaskID({ task_id: 1 })).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 7 - Create task items
// --------------------------------------------
describe('Tasks.model - insertTaskItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Task item created
  test('should insert a task item', async () => {
    const newItem = {
      id: 1,
      task_id: 5,
      text: 'Buy milk',
      completed_by: null,
    };

    pool.query.mockResolvedValue({
      rows: newItem,
    });

    const result = await insertTaskItems({
      task_id: 5,
      text: 'Buy milk',
      completed_by: null,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupTaskItems" (task_id, text, completed_by) VALUES ($1, $2, $3) RETURNING *',
      [5, 'Buy milk', null],
    );

    expect(result).toEqual(newItem);
  });

  // Invalid partition: null task_id
  test('should reject null task_id', async () => {
    pool.query.mockRejectedValue(
      new Error('null value in column "task_id" violates not-null constraint'),
    );

    await expect(
      insertTaskItems({
        task_id: null,
        text: 'Buy milk',
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(
      insertTaskItems({
        task_id: null,
        text: 'Buy milk',
      }),
    ).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 8 - Update task items
// --------------------------------------------
describe('Tasks.model - updateTaskItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Task item updated
  test('should update task item', async () => {
    const completedAt = new Date();

    const updatedItem = {
      id: 1,
      text: 'Updated',
      completed: true,
      completed_by: 2,
      completed_at: completedAt,
    };

    pool.query.mockResolvedValue({
      rows: updatedItem,
    });

    const result = await updateTaskItems({
      id: 1,
      text: 'Updated',
      completed: true,
      completed_by: 2,
      completed_at: completedAt,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupTaskItems" SET text = $1, completed = $2, completed_by = $3, completed_at = $4 WHERE id = $5 RETURNING *',
      ['Updated', true, 2, completedAt, 1],
    );

    expect(result).toEqual(updatedItem);
  });

  // Invalid partition: Task item not found
  test('should not update non-existent task item', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateTaskItems({
      id: -1,
      text: 'Updated',
    });

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(
      updateTaskItems({
        id: 1,
        text: 'Updated',
      }),
    ).rejects.toThrow('connection refused');
  });
});

// --------------------------------------------
// Unit Test 9 - Delete task items
// --------------------------------------------
describe('Tasks.model - deleteTaskItems', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Deletes task item
  test('should delete task item', async () => {
    const deletedItem = {
      id: 1,
    };

    pool.query.mockResolvedValue({
      rows: [deletedItem],
    });

    const result = await deleteTaskItems({
      id: 1,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "GroupTaskItems" WHERE id = $1 RETURNING *',
      [1],
    );

    expect(result).toEqual([deletedItem]);
  });

  // Invalid partition: Task item not found
  test('should return empty array when item does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteTaskItems({
      id: -1,
    });

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(
      deleteTaskItems({
        id: 1,
      }),
    ).rejects.toThrow('connection refused');
  });
});
