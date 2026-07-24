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
// (Get All Tasks)
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
        name: 'Task Group',
        description: 'Group for task testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Insert tasks directly into database
    await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES
        ($1, $2, $3, $4),
        ($1, $2, $5, $6)`,
      [groupId, user.user.id, 'Task One', 'First task', 'Task Two', 'Second task'],
    );

    // Get all tasks
    const response = await request(app).get('/groupTasks/tasks').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((task) => task.title)).toEqual(
      expect.arrayContaining(['Task One', 'Task Two']),
    );
  });

  // BVA: zero rows - empty task table
  test('should return an empty array when there are no tasks', async () => {
    const response = await request(app).get('/groupTasks/tasks').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 2 - GET /groupTasks/tasks/group/:group_id
// (Get Tasks by Group)
// -----------------------------------------------------------------------

describe('GET /groupTasks/tasks/group/:group_id', () => {
  // EP: Valid partition - returns tasks belonging to group
  test('should return tasks belonging to the specified group with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Group Task Test',
        description: 'Group for testing tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES
        ($1, $2, $3, $4),
        ($1, $2, $5, $6)`,
      [groupId, user.user.id, 'Group Task One', 'First task', 'Group Task Two', 'Second task'],
    );

    const response = await request(app).get(`/groupTasks/tasks/group/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((task) => task.title)).toEqual(
      expect.arrayContaining(['Group Task One', 'Group Task Two']),
    );
  });

  // BVA: zero rows - group has no tasks
  test('should return an empty array when the group has no tasks', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty Task Group',
        description: 'Group with no tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const response = await request(app).get(`/groupTasks/tasks/group/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 3 - GET /groupTasks/tasks/user/:group_id/:user_id
// (Get Tasks by Assignee and Group)
// -----------------------------------------------------------------------

describe('GET /tasks/user/:group_id/:user_id', () => {
  // EP: Valid partition - returns tasks assigned to user in group
  test('should return tasks assigned to the specified user in the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const assignee = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Assigned Task Group',
        description: 'Group for assigned task testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Add Bob to group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        user_id: assignee.user.id,
      })
      .expect(201);

    // Insert task assigned to Bob
    await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "assignee_id", "title", "description")
       VALUES ($1, $2, $3, $4, $5)`,
      [groupId, creator.user.id, assignee.user.id, 'Assigned Task', 'Task assigned to Bob'],
    );

    const response = await request(app)
      .get(`/groupTasks/tasks/user/${groupId}/${assignee.user.id}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        title: 'Assigned Task',
        assignee_id: assignee.user.id,
        group_id: groupId,
      }),
    );
  });

  // BVA: zero rows - user has no assigned tasks
  test('should return an empty array when user has no assigned tasks', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const assignee = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'No Assigned Tasks Group',
        description: 'Group for empty assigned tasks',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const response = await request(app)
      .get(`/groupTasks/tasks/user/${groupId}/${assignee.user.id}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 4 - POST /groupTasks/tasks/:group_id
// (Create Task)
// -----------------------------------------------------------------------

describe('POST /groupTasks/tasks/:group_id', () => {
  // EP: Valid partition - creates task successfully
  test('should create a task successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Create Task Group',
        description: 'Group for task creation',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'New Task',
        description: 'New task description',
      })
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        group_id: groupId,
        creator_id: user.user.id,
        title: 'New Task',
        description: 'New task description',
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
  });

  // EP: Valid partition - creates task with optional fields
  test('should create a task with assignee and due date', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const assignee = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Optional Task Group',
        description: 'Group for optional task fields',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    // Add Bob to group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${assignee.token}`)
      .send({
        user_id: assignee.user.id,
      })
      .expect(201);

    const dueDate = '2026-12-31T12:00:00.000Z';

    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Assigned Task',
        description: 'Task with optional fields',
        assignee_id: assignee.user.id,
        due_date: dueDate,
      })
      .expect(201);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        title: 'Assigned Task',
        assignee_id: assignee.user.id,
        group_id: groupId,
      }),
    );
  });

  // EP: Invalid partition - missing title
  test('should return 400 when title is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/groupTasks/tasks/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        description: 'Missing title',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: description or title is undefined');
  });

  // EP: Invalid partition - missing description
  test('should return 400 when description is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/groupTasks/tasks/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Missing description',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: description or title is undefined');
  });

  // EP: Invalid partition - user is not a group member
  test('should return 403 when user is not a member of the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const nonMember = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Non Member Task Group',
        description: 'Group for membership testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const response = await request(app)
      .post(`/groupTasks/tasks/${groupId}`)
      .set('Authorization', `Bearer ${nonMember.token}`)
      .send({
        title: 'Unauthorized Task',
        description: 'Should not be created',
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
        description: 'Test task',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 5 - PUT /groupTasks/tasks/:id
// (Update Task)
// -----------------------------------------------------------------------

describe('PUT /groupTasks/tasks/:id', () => {
  // EP: Valid partition - task creator updates task
  test('should update a task successfully and return 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

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

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Original Task', 'Original description'],
    );

    const taskId = taskResult.rows[0].id;

    const response = await request(app)
      .put(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Updated Task',
        description: 'Updated description',
        status: 'in_progress',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        title: 'Updated Task',
        description: 'Updated description',
      }),
    );

    // Verify database update
    const result = await pool.query(`SELECT * FROM "GroupTasks" WHERE id = $1`, [taskId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].title).toBe('Updated Task');
    expect(result.rows[0].description).toBe('Updated description');
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when title is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/tasks/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        description: 'Missing title',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: description or title is undefined');
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

  // EP: Invalid partition - user did not create or get assigned task
  test('should return 403 when user did not create or get assigned to task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Update Task Group',
        description: 'Group for update authorization',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, creator.user.id, 'Creator Task', 'Creator task description'],
    );

    const taskId = taskResult.rows[0].id;

    const response = await request(app)
      .put(`/groupTasks/tasks/${taskId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        title: 'Unauthorized Update',
        description: 'Should not update',
      })
      .expect(403);

    expect(response.body.message).toBe('You did not create or get assigned to this task');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .put('/groupTasks/tasks/1')
      .send({
        title: 'Updated Task',
        description: 'Updated description',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 6 - DELETE /groupTasks/tasks/:id
// (Delete Task)
// -----------------------------------------------------------------------

describe('DELETE /groupTasks/tasks/:id', () => {
  // EP: Valid partition - task creator deletes task
  test('should delete a task successfully and return 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

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

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Delete Task', 'Task to delete'],
    );

    const taskId = taskResult.rows[0].id;

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

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Delete Task Group',
        description: 'Group for delete authorization',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, creator.user.id, 'Protected Task', 'Task cannot be deleted by Bob'],
    );

    const taskId = taskResult.rows[0].id;

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
// Integration Test 7 - GET /groupTasks/taskItems
// (Get All Task Items)
// -----------------------------------------------------------------------

describe('GET /groupTasks/taskItems', () => {
  // EP: Valid partition - returns all task items
  test('should return all task items with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'All Items Group',
        description: 'Group for task items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Task With Items', 'Task containing items'],
    );

    const taskId = taskResult.rows[0].id;

    await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES
        ($1, $2),
        ($1, $3)`,
      [taskId, 'Item One', 'Item Two'],
    );

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
// Integration Test 8 - GET /groupTasks/taskItems/:task_id
// (Get Task Items by Task)
// -----------------------------------------------------------------------

describe('GET /groupTasks/taskItems/:task_id', () => {
  // EP: Valid partition - returns items belonging to task
  test('should return task items belonging to the specified task', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Task Item Group',
        description: 'Group for task item testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Item Test Task', 'Task for item testing'],
    );

    const taskId = taskResult.rows[0].id;

    await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES
        ($1, $2),
        ($1, $3)`,
      [taskId, 'First Item', 'Second Item'],
    );

    const response = await request(app).get(`/groupTasks/taskItems/${taskId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((item) => item.text)).toEqual(
      expect.arrayContaining(['First Item', 'Second Item']),
    );
  });

  // BVA: zero rows
  test('should return an empty array when task has no items', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty Items Group',
        description: 'Group with no task items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Empty Items Task', 'Task with no items'],
    );

    const taskId = taskResult.rows[0].id;

    const response = await request(app).get(`/groupTasks/taskItems/${taskId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 9 - POST /groupTasks/taskItems/:task_id
// (Create Task Item)
// -----------------------------------------------------------------------

describe('POST /groupTasks/taskItems/:task_id', () => {
  // EP: Valid partition - task creator creates item
  test('should create a task item successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Create Item Group',
        description: 'Group for item creation',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Item Creation Task', 'Task for item creation'],
    );

    const taskId = taskResult.rows[0].id;

    const response = await request(app)
      .post(`/groupTasks/taskItems/${taskId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        text: 'New task item',
      })
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        task_id: taskId,
        text: 'New task item',
      }),
    );

    // Verify item exists in database
    const result = await pool.query(`SELECT * FROM "GroupTaskItems" WHERE task_id = $1`, [taskId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('New task item');
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

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Item Group',
        description: 'Group for item authorization',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, creator.user.id, 'Protected Item Task', 'Task belongs to Alice'],
    );

    const taskId = taskResult.rows[0].id;

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
// Integration Test 10 - PUT /groupTasks/taskItems/:taskId/:id
// (Update Task Item)
// -----------------------------------------------------------------------

describe('PUT /groupTasks/taskItems/:taskId/:id', () => {
  // EP: Valid partition - task creator updates item
  test('should update a task item successfully and return 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Update Item Group',
        description: 'Group for updating items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Update Item Task', 'Task for item update'],
    );

    const taskId = taskResult.rows[0].id;

    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Original Item'],
    );

    const itemId = itemResult.rows[0].id;

    const response = await request(app)
      .put(`/groupTasks/taskItems/${taskId}/${itemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        text: 'Updated Item',
        completed: true,
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        text: 'Updated Item',
        completed: true,
      }),
    );

    // Verify database update
    const result = await pool.query(`SELECT * FROM "GroupTaskItems" WHERE id = $1`, [itemId]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Updated Item');
    expect(result.rows[0].completed).toBe(true);
    expect(result.rows[0].completed_by).toBe(user.user.id);
  });

  // EP: Invalid partition - missing text
  test('should return 400 when text is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/taskItems/1/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        completed: true,
      })
      .expect(400);

    expect(response.body.message).toBe('Error: text is undefined');
  });

  // EP: Invalid partition - task does not exist
  test('should return 404 when task does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groupTasks/taskItems/-1/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        text: 'Updated item',
      })
      .expect(404);

    expect(response.body.message).toBe('Task not found');
  });

  // EP: Invalid partition - user is not creator or assignee
  test('should return 403 when user did not create or get assigned to task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Update Item Group',
        description: 'Group for item update authorization',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, creator.user.id, 'Protected Item Task', 'Task belongs to Alice'],
    );

    const taskId = taskResult.rows[0].id;

    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Protected Item'],
    );

    const itemId = itemResult.rows[0].id;

    const response = await request(app)
      .put(`/groupTasks/taskItems/${taskId}/${itemId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        text: 'Unauthorized Update',
      })
      .expect(403);

    expect(response.body.message).toBe('You did not create or get assigned to this task');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .put('/groupTasks/taskItems/1/1')
      .send({
        text: 'Updated item',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 11 - DELETE /taskItems/:id
// (Delete Task Item)
// -----------------------------------------------------------------------

describe('DELETE /groupTasks/taskItems/:id', () => {
  // EP: Valid partition - task creator deletes task item
  test('should delete a task item successfully and return 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Delete Item Group',
        description: 'Group for deleting items',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, user.user.id, 'Delete Item Task', 'Task for item deletion'],
    );

    const taskId = taskResult.rows[0].id;

    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Delete Me'],
    );

    const itemId = itemResult.rows[0].id;

    await request(app)
      .delete(`/groupTasks/taskItems/${itemId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify item was deleted
    const result = await pool.query(`SELECT * FROM "GroupTaskItems" WHERE id = $1`, [itemId]);

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - user did not create task
  test('should return 403 when user did not create the task', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    const createGroupResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Delete Item Group',
        description: 'Group for delete authorization',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createGroupResponse.body.id;

    const taskResult = await pool.query(
      `INSERT INTO "GroupTasks"
        ("group_id", "creator_id", "title", "description")
       VALUES ($1, $2, $3, $4)
       RETURNING id`,
      [groupId, creator.user.id, 'Protected Delete Item Task', 'Task belongs to Alice'],
    );

    const taskId = taskResult.rows[0].id;

    const itemResult = await pool.query(
      `INSERT INTO "GroupTaskItems"
        ("task_id", "text")
       VALUES ($1, $2)
       RETURNING id`,
      [taskId, 'Protected Item'],
    );

    const itemId = itemResult.rows[0].id;

    const response = await request(app)
      .delete(`/groupTasks/taskItems/${itemId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .expect(403);

    expect(response.body.message).toBe('You did not create this task');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groupTasks/taskItems/1').expect(401);
  });
});
