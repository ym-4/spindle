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
// Integration Test 1 - GET /groups
// (Get All Groups)
// -----------------------------------------------------------------------
describe('GET /groups', () => {
  // EP: Valid partition - returns existing groups
  test('should return all groups with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create groups
    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Group One',
        description: 'First group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Group Two',
        description: 'Second group',
        school: 'MAD',
        module: 'ST0527',
      })
      .expect(201);

    // Get groups
    const response = await request(app).get('/groups').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((group) => group.name)).toEqual(
      expect.arrayContaining(['Group One', 'Group Two']),
    );
  });

  // Boundary (BVA): zero rows – empty table returns an empty array
  test('should return no groups with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Get groups
    const response = await request(app).get('/groups').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);

    expect(response.body.map((group) => group.name)).toEqual(expect.arrayContaining([]));
  });
});

// -----------------------------------------------------------------------
// Integration Test 2 - GET /groups/group/:group_id
// (Get Group members by group id)
// -----------------------------------------------------------------------

describe('GET /groups/group/:group_id', () => {
  // EP: Valid partition - returns existing group with that id
  test('should return the group with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Test Group',
        description: 'Test description',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app).get(`/groups/group/${groupId}`).expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: groupId,
          name: 'Test Group',
          description: 'Test description',
          school: 'SOC',
          module: 'ST0526',
        }),
      ]),
    );
  });

  // Boundary (BVA): zero rows – empty table returns an empty array
  test('should return an empty result for a group that does not exist', async () => {
    const response = await request(app).get('/groups/group/-1').expect(200);

    expect(response.body).toEqual([]);
  });
});

// -----------------------------------------------------------------------
// Integration Test 3 - GET /groups/school/:school_name
// Get groups by school
// -----------------------------------------------------------------------

describe('GET /groups/school/:school_name', () => {
  // EP: Valid partition - returns existing groups belonging to that school
  test('should return groups belonging to the specified school with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create groups
    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'SP Group 1',
        description: 'Singapore Polytechnic group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'SP Group 2',
        description: 'Cool group',
        school: 'SOC',
        module: 'ST0527',
      })
      .expect(201);

    // Get group by school
    const response = await request(app).get('/groups/school/SOC').expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    expect(response.body).toHaveLength(2);

    expect(response.body.map((group) => group.name)).toEqual(
      expect.arrayContaining(['SP Group 1', 'SP Group 2']),
    );
  });

  // Boundary (BVA): Invalid partition - school that does not exist
  test('should return no groups', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create groups
    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'SP Group 1',
        description: 'Singapore Polytechnic group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'SP Group 2',
        description: 'Cool group',
        school: 'SOC',
        module: 'ST0527',
      })
      .expect(201);

    // Get group by school
    const response = await request(app).get('/groups/school/NonExistentSchool').expect(400);

    expect(response.body.message).toBe('Error: Invalid school');
  });
});

// -----------------------------------------------------------------------
// Integration Test 4 - POST /groups/create/:creator_id
// (Create Group members by group id)
// -----------------------------------------------------------------------

describe('POST /groups/create/:creator_id', () => {
  // EP: Valid partition - creates group
  test('should create a group successfully and return 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create groups
    const response = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'New Group',
        description: 'A new test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.objectContaining({
        name: 'New Group',
        description: 'A new test group',
        school: 'SOC',
        module: 'ST0526',
      }),
    );

    // Verify the group actually exists in the database
    const result = await pool.query(`SELECT * FROM "Groups" WHERE id = $1`, [response.body.id]);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].name).toBe('New Group');
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when required fields are missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Incomplete Group',
        description: 'Missing school and module',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: name, description, school or module is undefined');
  });

  // EP: Invalid partition - duplicate name
  test('should return 409 when group name already exists', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const groupData = {
      name: 'Duplicate Group',
      description: 'Test description',
      school: 'SOC',
      module: 'ST0526',
    };

    // Create group
    await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(groupData)
      .expect(201);

    // Create group with same name again
    const response = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send(groupData)
      .expect(409);

    expect(response.body.message).toBe('Error: Group name already exists');
  });

  // EP: Invalid partition - user is not authenticated (no token)
  test('should return 401 when user is not authenticated', async () => {
    // Create group
    await request(app)
      .post('/groups/create/1')
      .send({
        name: 'Unauthorised Group',
        description: 'Test description',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 5 - PUT /groups/description/:group_id
// (Update group description)
// -----------------------------------------------------------------------

describe('PUT /groups/description/:group_id', () => {
  // EP: Valid partition - updates group description
  test('admin should be able to update group description', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Description Group',
        description: 'Old description',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Update description
    const response = await request(app)
      .put(`/groups/description/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        description: 'Updated description',
      })
      .expect(200);

    expect(response.body.description).toBe('Updated description');

    // Check that description is changed in database
    const result = await pool.query(`SELECT description FROM "Groups" WHERE id = $1`, [groupId]);

    expect(result.rows[0].description).toBe('Updated description');
  });

  // EP: Invalid partition - missing required info
  test('should return 400 when description is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Update group request
    const response = await request(app)
      .put('/groups/description/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: description is undefined');
  });

  // EP: Invalid partition - user has no permissions
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Admin Group',
        description: 'Original',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Join request by Bob
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Bob is a member but not an admin cannot update
    const response = await request(app)
      .put(`/groups/description/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        description: 'Unauthorized update',
      })
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator or an admin");
  });

  // EP: Invalid partition - user is not authenticated (no token)
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post(`/groups/create/1`)
      .send({
        name: 'Admin Group',
        description: 'Original',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 6 - PUT /groups/public/:group_id
// (Update group publicity)
// -----------------------------------------------------------------------
describe('PUT /groups/public/:group_id', () => {
  // EP: Valid partition - updates publicity
  test('creator should be able to update group publicity', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Publicity Group',
        description: 'Test group',
        school: 'MAD',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Update publicity
    const response = await request(app)
      .put(`/groups/public/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        public: false,
      })
      .expect(200);

    expect(response.body.public).toBe(false);
  });

  // EP: Invalid partition - missing required info
  test('should return 400 when public field is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groups/public/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: public or creator_id is undefined');
  });

  // EP: Invalid partition - user has no permissions
  test('should return 403 when user is not the creator', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Private Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .put(`/groups/public/${groupId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        public: false,
      })
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator");
  });

  // EP: Invalid partition - user is not authenticated (no token)
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .put(`/groups/public/1`)
      .send({
        public: false,
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 7 - PUT /groups/module/:group_id
// (Update group module)
// -----------------------------------------------------------------------
describe('PUT /groups/module/:group_id', () => {
  // EP: Valid partition - updates module
  test('admin should be able to update group module', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Module Group',
        description: 'Test group',
        school: 'ABE',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Update module
    const response = await request(app)
      .put(`/groups/module/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        module: 'ST0527',
      })
      .expect(200);

    expect(response.body.module).toBe('ST0527');
  });

  // EP: Invalid partition - missing required info
  test('should return 400 when module is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groups/module/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: module is undefined');
  });

  // EP: Invalid partition: user has no permissions
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Module Admin Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Join Group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Update module
    const response = await request(app)
      .put(`/groups/module/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        module: 'ST0527',
      })
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator or an admin");
  });

  // EP: Invalid partition - user is not authenticated (no token)
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .put(`/groups/module/1`)
      .send({
        module: 'ST0527',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 8 - DELETE /groups/:group_id
// (Delete group)
// -----------------------------------------------------------------------

describe('DELETE /groups/:group_id', () => {
  // EP: Valid partition - deletes group
  test('creator should be able to delete group', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Delete Group',
        description: 'Group to delete',
        school: 'MAD',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    await request(app)
      .delete(`/groups/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify group no longer exists
    const result = await pool.query(`SELECT * FROM "Groups" WHERE id = $1`, [groupId]);

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - user has no permissions
  test('should return 403 when user is not the creator', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Protected Group',
        description: 'Cannot delete',
        school: 'MAD',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .delete(`/groups/${groupId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator");
  });

  // EP: Invalid partition - group does not exist
  test('should return 404 when group does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/groups/999999')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(404);

    expect(response.body.message).toBe('Group not found');
  });

  // EP: Invalid partition - user is not authenticated (no token)
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groups/1').expect(401);
  });
});
