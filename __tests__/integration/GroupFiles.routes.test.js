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
  await pool.query('DELETE FROM "GroupFiles"');
  await pool.query('DELETE FROM "GroupMembers"');
  await pool.query('DELETE FROM "Groups"');

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
  await pool.query('DELETE FROM "GroupFiles"');
  await pool.query('DELETE FROM "Groups"');

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
// Integration Test 1 - GET /groupFiles/files/:group_id
// (Get files by group)
// -----------------------------------------------------------------------

describe('GET /groupFiles/files/:group_id', () => {
  // EP: Valid partition - returns files belonging to the group
  test('should return all files belonging to the specified group with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'File Test Group',
        description: 'Group for file testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Insert files directly into database
    await pool.query(
      `INSERT INTO "GroupFiles"
        ("user_id", "name", "file_path", "folder_name", "group_id")
       VALUES
        ($1, $2, $3, $4, $5),
        ($1, $6, $7, $8, $5)`,
      [
        user.user.id,
        'test-file-1.txt',
        'test-file-1.txt',
        'general',
        groupId,
        'test-file-2.pdf',
        'test-file-2.pdf',
        'documents',
      ],
    );

    // Get files
    const response = await request(app).get(`/groupFiles/files/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((file) => file.name)).toEqual(
      expect.arrayContaining(['test-file-1.txt', 'test-file-2.pdf']),
    );
  });

  // BVA: zero rows - group has no files
  test('should return an empty array when the group has no files', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty File Group',
        description: 'Group with no files',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app).get(`/groupFiles/files/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 2 - POST /groupFiles/files/:group_id
// (Create / Upload file)
// -----------------------------------------------------------------------

describe('POST /groupFiles/files/:group_id', () => {
  // EP: Valid partition - uploads a file successfully
  test('should upload a file successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Upload File Group',
        description: 'Group for uploading files',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Upload file
    const response = await request(app)
      .post(`/groupFiles/files/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('folder_name', 'general')
      .attach('file', Buffer.from('Test file contents'), 'test-file.txt')
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        user_id: user.user.id,
        group_id: groupId,
        name: 'test-file.txt',
        folder_name: 'general',
      }),
    );

    // Verify file exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupFiles"
       WHERE "group_id" = $1 AND "user_id" = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('test-file.txt');
    expect(result.rows[0].folder_name).toBe('general');
  });

  // EP: Invalid partition - no file uploaded
  test('should return 400 when no file is uploaded', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'No File Group',
        description: 'Group for testing missing file',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .post(`/groupFiles/files/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .field('folder_name', 'general')
      .expect(400);

    expect(response.body.message).toBe('No file uploaded');
  });

  // EP: Invalid partition - folder_name missing
  test('should return 400 when folder_name is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Missing Folder Group',
        description: 'Group for testing missing folder name',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .post(`/groupFiles/files/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .attach('file', Buffer.from('Test file contents'), 'test-file.txt')
      .expect(400);

    expect(response.body.message).toBe('Error: name, file_path or folder_name is undefined');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groupFiles/files/1')
      .field('folder_name', 'general')
      .attach('file', Buffer.from('Test file contents'), 'test-file.txt')
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 3 - DELETE /groupFiles/files/:id
// (Delete file)
// -----------------------------------------------------------------------

describe('DELETE /groupFiles/files/:id', () => {
  // EP: Valid partition - creator deletes own file
  test('should delete a file successfully and return 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Delete File Group',
        description: 'Group for deleting files',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Insert file directly into database
    const fileResult = await pool.query(
      `INSERT INTO "GroupFiles"
        ("user_id", "name", "file_path", "folder_name", "group_id")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING *`,
      [user.user.id, 'delete-me.txt', 'delete-me.txt', 'general', groupId],
    );

    const fileId = fileResult.rows[0].id;

    // Delete file
    await request(app)
      .delete(`/groupFiles/files/${fileId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify file was deleted from database
    const result = await pool.query(`SELECT * FROM "GroupFiles" WHERE id = $1`, [fileId]);

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - file does not exist
  test('should return 404 when file does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/groupFiles/files/-1')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(404);

    expect(response.body.message).toBe('File not found');
  });

  // EP: Invalid partition - user did not upload the file
  test('should return 403 when user did not upload the file', async () => {
    const uploader = await registerAndVerify('Alice', 'alice@example.com');
    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${uploader.user.id}`)
      .set('Authorization', `Bearer ${uploader.token}`)
      .send({
        name: 'File Ownership Group',
        description: 'Group for file ownership testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Insert file belonging to Alice
    const fileResult = await pool.query(
      `INSERT INTO "GroupFiles"
        ("user_id", "name", "file_path", "folder_name", "group_id")
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id`,
      [uploader.user.id, 'alice-file.txt', 'alice-file.txt', 'general', groupId],
    );

    const fileId = fileResult.rows[0].id;

    // Bob attempts to delete Alice's file
    const response = await request(app)
      .delete(`/groupFiles/files/${fileId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .expect(403);

    expect(response.body.message).toBe('You did not upload this file');

    // Verify file still exists
    const result = await pool.query(`SELECT * FROM "GroupFiles" WHERE id = $1`, [fileId]);

    expect(result.rows).toHaveLength(1);
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groupFiles/files/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 4 - GET /groupFiles/folders/:group_id
// (Get folders by group)
// -----------------------------------------------------------------------

describe('GET /groupFiles/folders/:group_id', () => {
  // EP: Valid partition - returns folders belonging to group
  test('should return all folders belonging to the specified group with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Folder Test Group',
        description: 'Group for folder testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create folders
    await pool.query(
      `INSERT INTO "GroupFolders"
        ("group_id", "name", "created_by")
       VALUES
        ($1, $2, $3),
        ($1, $4, $3)`,
      [groupId, 'Documents', user.user.id, 'Assignments'],
    );

    // Get folders
    const response = await request(app).get(`/groupFiles/folders/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((folder) => folder.name)).toEqual(
      expect.arrayContaining(['Documents', 'Assignments']),
    );
  });

  // BVA: zero rows - group has no folders
  test('should return an empty array when the group has no folders', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty Folder Group',
        description: 'Group with no folders',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app).get(`/groupFiles/folders/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 5 - POST /groupFiles/folders/:group_id
// (Create folder)
// -----------------------------------------------------------------------

describe('POST /groupFiles/folders/:group_id', () => {
  // EP: Valid partition - creates folder successfully
  test('should create a folder successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Create Folder Group',
        description: 'Group for folder creation',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create folder
    const response = await request(app)
      .post(`/groupFiles/folders/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'New Folder',
      })
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(1);

    expect(response.body[0]).toEqual(
      expect.objectContaining({
        group_id: groupId,
        name: 'New Folder',
        created_by: user.user.id,
      }),
    );

    // Verify folder exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupFolders"
       WHERE group_id = $1 AND name = $2`,
      [groupId, 'New Folder'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].created_by).toBe(user.user.id);
  });

  // EP: Invalid partition - missing folder name
  test('should return 400 when folder name is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Missing Folder Name Group',
        description: 'Group for testing missing folder name',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .post(`/groupFiles/folders/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: name is undefined');
  });

  // EP: Invalid partition - unauthenticated user
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groupFiles/folders/1')
      .send({
        name: 'Unauthorised Folder',
      })
      .expect(401);
  });
});
