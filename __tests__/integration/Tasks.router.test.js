const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.

beforeEach(async () => {
  // Clean slate for every test

  await pool.query('DELETE FROM "GroupJoinRequests"');
  await pool.query('DELETE FROM "GroupAnnouncements"');
  await pool.query('DELETE FROM "GroupDiscussions"');
  await pool.query('DELETE FROM "GroupMembers"');
  await pool.query('DELETE FROM "Groups"');
  await pool.query('DELETE FROM "GroupFolders"');

  await pool.query('DELETE FROM "Notifications"');
  await pool.query('DELETE FROM "Stories"');
  await pool.query('DELETE FROM "MessageReadState"');
  await pool.query('DELETE FROM "MessageReactions"');
  await pool.query('DELETE FROM "CallLogs"');
  await pool.query('DELETE FROM "PersonalMessages"');
  await pool.query('DELETE FROM "FriendRequests"');
  await pool.query('DELETE FROM "UserFriends"');
  await pool.query('DELETE FROM "EmailVerificationCodes"');
  await pool.query('DELETE FROM "TrustedDevices"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "GroupJoinRequests"');
  await pool.query('DELETE FROM "GroupAnnouncements"');
  await pool.query('DELETE FROM "GroupDiscussions"');
  await pool.query('DELETE FROM "GroupMembers"');
  await pool.query('DELETE FROM "Groups"');
  await pool.query('DELETE FROM "GroupFolders"');

  await pool.query('DELETE FROM "PersonalMessages"');
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');

  await pool.end();
});

// ── Helper ───────────────────────────────────────────────
async function seedPersons() {
  await pool.query(
    `INSERT INTO "Person" ("email","name") VALUES
      ('alice@example.com','Alice'),
      ('bob@example.com','Bob')`,
  );
}

async function seedSomethings() {
  await pool.query(`INSERT INTO "Something" ("name") VALUES ('Seed 1'),('Seed 2')`);
}

async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

async function loginAndVerify(username, password, rememberMe = false) {
  const login = await request(app).post('/auth/login').send({ username, password });
  if (login.body.needs2FA) {
    const verify = await request(app).post('/auth/verify-login').send({
      email: login.body.email,
      code: login.body.previewCode,
      remember_me: rememberMe,
    });
    return {
      user: verify.body.user,
      token: verify.body.token,
      remember_token: verify.body.remember_token,
    };
  }
  return { user: login.body.user, token: login.body.token };
}

// -----------------------------------------------------------------------
// Integration Test 1 - GET /groupTasks/tasks
// (Get all tasks)
// -----------------------------------------------------------------------

describe('GET /groupTasks/tasks', () => {
  // EP: Valid partition - returns existing tasks
  test('should return all tasks with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Task Test Group',
        description: 'Group for task testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create tasks directly in database
    await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description", "status")
       VALUES
        ($1, $2, $3, $4, $5),
        ($1, $2, $6, $7, $8)`,
      [
        groupId,
        user.user.id,
        'Task One',
        'First task',
        'todo',
        'Task Two',
        'Second task',
        'in_progress',
      ],
    );

    // Get all tasks
    const response = await request(app).get('/groupTasks/tasks').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((task) => task.title)).toEqual(
      expect.arrayContaining(['Task One', 'Task Two']),
    );
  });

  // BVA: zero rows - no tasks exist
  test('should return an empty array when there are no tasks', async () => {
    const response = await request(app).get('/groupTasks/tasks').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 2 - POST /groupTasks/tasks/:group_id
// (Create task)
// -----------------------------------------------------------------------

describe('POST /groupTasks/tasks/:group_id', () => {
  // EP: Valid partition - creates task successfully
  test('should create a task successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Create Task Group',
        description: 'Group for creating tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'New Task',
        description: 'Task description',
      })
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        group_id: groupId,
        creator_id: user.user.id,
        title: 'New Task',
        description: 'Task description',
      }),
    );

    // Verify task exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupTasks"
       WHERE group_id = $1 AND creator_id = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('New Task');
    expect(result.rows[0].description).toBe('Task description');
  });

  // EP: Valid partition - creates task with optional fields
  test('should create a task with assignee and due date', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const assignee = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Assigned Task Group',
        description: 'Group for assigned tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Add Bob as group member
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        user_id: assignee.user.id,
      })
      .expect(201);

    // Create task
    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Assigned Task',
        description: 'Task assigned to Bob',
        assignee_id: assignee.user.id,
        due_date: '2030-01-01T00:00:00.000Z',
      })
      .expect(201);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        group_id: groupId,
        creator_id: creator.user.id,
        assignee_id: assignee.user.id,
        title: 'Assigned Task',
      }),
    );
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when title or description is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Invalid Task Group',
        description: 'Group for invalid task tests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Missing Description',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: description or title is undefined');
  });

  // EP: Invalid partition - user is not a group member
  test('should return 403 when user is not a member of the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Member Only Task Group',
        description: 'Group for member testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Bob attempts to create task without joining
    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        title: 'Unauthorized Task',
        description: 'This should fail',
      })
      .expect(403);

    expect(response.body.message).toBe('You are not a member of this group');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groupTasks/tasks/1')
      .send({
        title: 'Unauthorised Task',
        description: 'Test description',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 3 - PUT /groupTasks/tasks/:id
// (Update task)
// -----------------------------------------------------------------------

describe('PUT /groupTasks/tasks/:id', () => {
  // EP: Valid partition - task creator updates task
  test('should update a task successfully and return 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Update Task Group',
        description: 'Group for updating tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Original Task',
        description: 'Original description',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Update task
    const response = await request(app)
      .put(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Updated Task',
        description: 'Updated description',
        status: 'done',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          title: 'Updated Task',
          description: 'Updated description',
          status: 'done',
        }),
      ]),
    );

    // Verify database
    const result = await pool.query(`SELECT * FROM "GroupTasks" WHERE id = $1`, [taskId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('Updated Task');
    expect(result.rows[0].description).toBe('Updated description');
    expect(result.rows[0].status).toBe('done');
  });

  // EP: Valid partition - assigned user updates task
  test('should allow the assigned user to update a task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const assignee = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Assigned Update Group',
        description: 'Group for assigned task updates',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Add Bob as member
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        user_id: assignee.user.id,
      })
      .expect(201);

    // Create task assigned to Bob
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Assigned Task',
        description: 'Original description',
        assignee_id: assignee.user.id,
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Bob updates task
    const response = await request(app)
      .put(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        title: 'Updated By Assignee',
        description: 'Updated by Bob',
        status: 'in_progress',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: taskId,
          title: 'Updated By Assignee',
          description: 'Updated by Bob',
        }),
      ]),
    );
  });

  // EP: Invalid partition - task does not exist
  test('should return 404 when task does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/tasks/-1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Updated Task',
        description: 'Updated description',
      })
      .expect(404);

    expect(response.body.message).toBe('Task not found');
  });

  // EP: Invalid partition - user has no permission
  test('should return 403 when user did not create or get assigned to task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Update Group',
        description: 'Group for unauthorized updates',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Creator Task',
        description: 'Task owned by Alice',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Bob attempts to update
    const response = await request(app)
      .put(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        title: 'Unauthorized Update',
        description: 'Should fail',
      })
      .expect(403);

    expect(response.body.message).toBe('You did not create or get assigned to this task');
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when title or description is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/tasks/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Missing Description',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: description or title is undefined');
  });
});

// -----------------------------------------------------------------------
// Integration Test 4 - DELETE /groupTasks/tasks/:id
// (Delete task)
// -----------------------------------------------------------------------

describe('DELETE /groupTasks/tasks/:id', () => {
  // EP: Valid partition - creator deletes own task
  test('should delete a task successfully and return 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Delete Task Group',
        description: 'Group for deleting tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Delete Me',
        description: 'Task to delete',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Delete task
    await request(app)
      .delete(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify task was deleted
    const result = await pool.query(`SELECT * FROM "GroupTasks" WHERE id = $1`, [taskId]);

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - user did not create task
  test('should return 403 when user did not create the task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Delete Group',
        description: 'Group for unauthorized deletion',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Creator Task',
        description: 'Task owned by Alice',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Bob attempts to delete task
    const response = await request(app)
      .delete(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .expect(403);

    expect(response.body.message).toBe('You did not create this task');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groupTasks/tasks/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 5 - GET /groupTasks/taskItems
// (Get all task items)
// -----------------------------------------------------------------------

describe('GET /groupTasks/taskItems', () => {
  // EP: Valid partition - returns all task items
  test('should return all task items with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Task Items Group',
        description: 'Group for task item testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Task With Items',
        description: 'Task for item testing',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Insert task items
    await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES
        ($1, $2),
        ($1, $3)`,
      [taskId, 'Item One', 'Item Two'],
    );

    // Get all task items
    const response = await request(app).get('/groupTasks/taskItems').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((item) => item.text)).toEqual(
      expect.arrayContaining(['Item One', 'Item Two']),
    );
  });

  // BVA: zero rows
  test('should return an empty array when there are no task items', async () => {
    const response = await request(app).get('/groupTasks/taskItems').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 6 - POST /groupTasks/taskItems/:task_id
// (Create task item)
// -----------------------------------------------------------------------

describe('POST /groupTasks/taskItems/:task_id', () => {
  // EP: Valid partition - task creator creates task item
  test('should create a task item successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Create Task Item Group',
        description: 'Group for creating task items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Task With Item',
        description: 'Task description',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Create task item
    const response = await request(app)
      .post(`/groupTasks/taskItems/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        text: 'Complete this item',
      })
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        task_id: taskId,
        text: 'Complete this item',
      }),
    );

    // Verify task item exists
    const result = await pool.query(
      `SELECT * FROM "GroupTaskItems"
       WHERE task_id = $1`,
      [taskId],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Complete this item');
  });

  // EP: Invalid partition - missing text
  test('should return 400 when text is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/groupTasks/taskItems/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: text is undefined');
  });

  // EP: Invalid partition - user did not create task
  test('should return 403 when user did not create the task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Task Item Permission Group',
        description: 'Group for task item permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Creator Task',
        description: 'Task owned by Alice',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Bob attempts to create task item
    const response = await request(app)
      .post(`/groupTasks/taskItems/${taskId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        text: 'Unauthorized item',
      })
      .expect(403);

    expect(response.body.message).toBe('You did not create this task');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groupTasks/taskItems/1')
      .send({
        text: 'Unauthorised item',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 7 - PUT /groupTasks/taskItems/:taskId/:id
// (Update task item)
// -----------------------------------------------------------------------

describe('PUT /groupTasks/taskItems/:taskId/:id', () => {
  // EP: Valid partition - task creator updates task item
  test('should update a task item successfully and return 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Update Task Item Group',
        description: 'Group for updating task items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Task With Item',
        description: 'Task description',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Create task item directly
    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING *`,
      [taskId, 'Original Item'],
    );

    const itemId = itemResult.rows[0].id;

    // Update task item
    const response = await request(app)
      .put(`/groupTasks/taskItems/${taskId}/${itemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        text: 'Updated Item',
        completed: true,
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: itemId,
          text: 'Updated Item',
          completed: true,
        }),
      ]),
    );

    // Verify database
    const result = await pool.query(`SELECT * FROM "GroupTaskItems" WHERE id = $1`, [itemId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Updated Item');
    expect(result.rows[0].completed).toBe(true);
  });

  // EP: Valid partition - assigned user updates task item
  test('should allow assigned user to update a task item', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const assignee = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Assigned Task Item Group',
        description: 'Group for assigned task items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Add Bob as member
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        user_id: assignee.user.id,
      })
      .expect(201);

    // Create task assigned to Bob
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Assigned Task',
        description: 'Task assigned to Bob',
        assignee_id: assignee.user.id,
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Create item
    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Original Item'],
    );

    const itemId = itemResult.rows[0].id;

    // Bob updates item
    const response = await request(app)
      .put(`/groupTasks/taskItems/${taskId}/${itemId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        text: 'Completed By Bob',
        completed: true,
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: itemId,
          text: 'Completed By Bob',
          completed: true,
        }),
      ]),
    );
  });

  // EP: Invalid partition - task does not exist
  test('should return 404 when the task does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/taskItems/-1/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        text: 'Updated Item',
      })
      .expect(404);

    expect(response.body.message).toBe('Task not found');
  });

  // EP: Invalid partition - missing text
  test('should return 400 when text is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/taskItems/1/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: text is undefined');
  });

  // EP: Invalid partition - user has no permission
  test('should return 403 when user did not create or get assigned to task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Item Update Group',
        description: 'Group for unauthorized item updates',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Creator Task',
        description: 'Task owned by Alice',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Create item
    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Original Item'],
    );

    const itemId = itemResult.rows[0].id;

    // Bob attempts to update item
    const response = await request(app)
      .put(`/groupTasks/taskItems/${taskId}/${itemId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        text: 'Unauthorized Update',
      })
      .expect(403);

    expect(response.body.message).toBe('You did not create or get assigned to this task');
  });
});

// -----------------------------------------------------------------------
// Integration Test 8 - DELETE /groupTasks/taskItems/:id
// (Delete task item)
// -----------------------------------------------------------------------

describe('DELETE /groupTasks/taskItems/:id', () => {
  // EP: Valid partition - task creator deletes task item
  test('should delete a task item successfully and return 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Delete Task Item Group',
        description: 'Group for deleting task items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Task With Item',
        description: 'Task description',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Create task item
    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Delete Me'],
    );

    const itemId = itemResult.rows[0].id;

    // Delete item
    await request(app)
      .delete(`/groupTasks/taskItems/${itemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify item deleted
    const result = await pool.query(`SELECT * FROM "GroupTaskItems" WHERE id = $1`, [itemId]);

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - user did not create task
  test('should return 403 when user did not create the task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Item Delete Group',
        description: 'Group for unauthorized item deletion',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Create task
    const createTaskResponse = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Creator Task',
        description: 'Task owned by Alice',
      })
      .expect(201);

    const taskId = createTaskResponse.body[0].id;

    // Create item
    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Protected Item'],
    );

    const itemId = itemResult.rows[0].id;

    // Bob attempts to delete item
    const response = await request(app)
      .delete(`/groupTasks/taskItems/${itemId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .expect(403);

    expect(response.body.message).toBe('You did not create this task');

    // Verify item still exists
    const result = await pool.query(`SELECT * FROM "GroupTaskItems" WHERE id = $1`, [itemId]);

    expect(result.rows).toHaveLength(1);
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groupTasks/taskItems/1').expect(401);
  });
});
