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
// async function seedPersons() {
//   await pool.query(
//     `INSERT INTO "Person" ("email","name") VALUES
//       ('alice@example.com','Alice'),
//       ('bob@example.com','Bob')`,
//   );
// }

// async function seedSomethings() {
//   await pool.query(`INSERT INTO "Something" ("name") VALUES ('Seed 1'),('Seed 2')`);
// }

async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({ name, email, password });
  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });
  return { user: verify.body.user, token: verify.body.token };
}

// async function loginAndVerify(username, password, rememberMe = false) {
//   const login = await request(app).post('/auth/login').send({ username, password });
//   if (login.body.needs2FA) {
//     const verify = await request(app).post('/auth/verify-login').send({
//       email: login.body.email,
//       code: login.body.previewCode,
//       remember_me: rememberMe,
//     });
//     return {
//       user: verify.body.user,
//       token: verify.body.token,
//       remember_token: verify.body.remember_token,
//     };
//   }
//   return { user: login.body.user, token: login.body.token };
// }

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
    // const user = await registerAndVerify('Alice', 'alice@example.com');

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

// -----------------------------------------------------------------------
// Integration Test 9 - GET /groups/joined_groups
// (Get Joined groups by user id)
// -----------------------------------------------------------------------

describe('GET /groups/joined_groups/', () => {
  // EP: Valid partition - returns groups that the authenticated user joined
  test('should return groups joined by the authenticated user with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create groups
    const groupOneResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Joined Group One',
        description: 'First joined group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupTwoResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Joined Group Two',
        description: 'Second joined group',
        school: 'MAD',
        module: 'ST0527',
      })
      .expect(201);

    // Bob joins both groups
    await request(app)
      .post(`/groups/join/${groupOneResponse.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(201);

    await request(app)
      .post(`/groups/join/${groupTwoResponse.body.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(201);

    // Get joined groups
    const response = await request(app)
      .get('/groups/joined_groups/')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((group) => group.name)).toEqual(
      expect.arrayContaining(['Joined Group One', 'Joined Group Two']),
    );
  });

  // Boundary (BVA): zero rows - user has not joined any groups
  test('should return an empty array when user has not joined any groups', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .get('/groups/joined_groups/')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).get('/groups/joined_groups/').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 10 - GET /groups/joined/:group_id
// (Get Group Members by Group ID)
// -----------------------------------------------------------------------

describe('GET /groups/joined/:group_id', () => {
  // EP: Valid partition - returns all members belonging to the group
  test('should return group members with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Members Group',
        description: 'Group with members',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Get group members
    const response = await request(app).get(`/groups/joined/${groupId}`).expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: creator.user.id,
        }),
        expect.objectContaining({
          group_id: groupId,
          user_id: member.user.id,
        }),
      ]),
    );
  });

  // Boundary (BVA): zero rows - group does not exist
  test('should return an empty array when group does not exist', async () => {
    const response = await request(app).get('/groups/joined/-1').expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(0);
  });
});

// -----------------------------------------------------------------------
// Integration Test 11 - POST /groups/join/:group_id
// (Create Group Membership / Join Group)
// -----------------------------------------------------------------------

describe('POST /groups/join/:group_id', () => {
  // EP: Valid partition - user successfully joins group
  test('should allow user to join a group with status 201', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Join Group',
        description: 'Group for joining',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    const response = await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
        }),
      ]),
    );

    // Verify membership exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupMembers"
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].group_id).toBe(groupId);
    expect(result.rows[0].user_id).toBe(user.user.id);
    expect(result.rows[0].role).toBe('user');
  });

  // EP: Invalid partition - user is already a member
  test('should return 409 when user is already a member of the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Existing Member Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Join group first time
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(201);

    // Join group second time
    const response = await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(409);

    expect(response.body.message).toBe('Error: User is already a member');
  });

  // Boundary (BVA): group does not exist
  test('should return 404 when group does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/groups/join/-1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(404);

    expect(response.body.message).toBe('Error: Group not found');
  });

  // EP: Invalid partition - missing user_id
  test('should return 400 when user_id is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/groups/join/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: user_id is undefined');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groups/join/1')
      .send({
        user_id: 1,
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 12 - DELETE /groups/leave/:group_id
// (Delete Group Membership / Leave Group)
// -----------------------------------------------------------------------

describe('DELETE /groups/leave/:group_id', () => {
  // EP: Valid partition - user successfully leaves group
  test('should allow a member to leave the group with status 204', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Leave Group',
        description: 'Group for leaving',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(201);

    // Bob leaves group
    await request(app)
      .delete(`/groups/leave/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(204);

    // Verify membership no longer exists
    const result = await pool.query(
      `SELECT * FROM "GroupMembers"
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - user is not a member
  test('should return 404 when user is not a member of the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Not Member Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob attempts to leave without joining
    const response = await request(app)
      .delete(`/groups/leave/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        user_id: user.user.id,
      })
      .expect(404);

    expect(response.body.message).toBe('User is not a member');
  });

  // EP: Invalid partition - creator attempts to leave
  test('should return 409 when group creator attempts to leave the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Creator Leave Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Creator attempts to leave
    const response = await request(app)
      .delete(`/groups/leave/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        user_id: creator.user.id,
      })
      .expect(409);

    expect(response.body.message).toBe('User cannot leave the group as its creator');
  });

  // EP: Invalid partition - missing user_id
  test('should return 400 when user_id is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/groups/leave/1')
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: user_id is undefined');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .delete('/groups/leave/1')
      .send({
        user_id: 1,
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 13 - DELETE /groups/kick/:group_id/:removed_user_id
// (Kick Member - Admin)
// -----------------------------------------------------------------------

describe('DELETE /groups/kick/:group_id/:removed_user_id', () => {
  // EP: Valid partition - admin successfully kicks member
  test('should allow an admin to kick a member with status 204', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Kick Group',
        description: 'Group for kicking members',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Creator kicks Bob
    await request(app)
      .delete(`/groups/kick/${groupId}/${member.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(204);

    // Verify Bob is no longer a member
    const result = await pool.query(
      `SELECT * FROM "GroupMembers"
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, member.user.id],
    );

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - regular member is not an admin
  test('should return 403 when a regular member attempts to kick another member', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const memberOne = await registerAndVerify('Bob', 'bob@example.com');
    const memberTwo = await registerAndVerify('Charlie', 'charlie@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Kick Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${memberOne.token}`)
      .send({
        user_id: memberOne.user.id,
      })
      .expect(201);

    // Charlie joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${memberTwo.token}`)
      .send({
        user_id: memberTwo.user.id,
      })
      .expect(201);

    // Bob attempts to kick Charlie
    const response = await request(app)
      .delete(`/groups/kick/${groupId}/${memberTwo.user.id}`)
      .set('Authorization', `Bearer ${memberOne.token}`)
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator or an admin");
  });

  // EP: Invalid partition - member does not exist in group
  test('should return 404 when attempting to kick a user who is not a member', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Missing Member Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Creator attempts to kick Bob who is not a member
    const response = await request(app)
      .delete(`/groups/kick/${groupId}/${user.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(404);

    expect(response.body.message).toBe('User is not a member');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groups/kick/1/2').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 14 - PUT /groups/roleToAdmin/:group_id/:user_being_promoted_user_id
// (Update Member Role to Admin)
// -----------------------------------------------------------------------

describe('PUT /groups/roleToAdmin/:group_id/:user_being_promoted_user_id', () => {
  // EP: Valid partition - admin successfully promotes member
  test('should allow an admin to promote a member to admin with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Promote Group',
        description: 'Group for role testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Creator promotes Bob to admin
    const response = await request(app)
      .put(`/groups/roleToAdmin/${groupId}/${member.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        group_id: groupId,
        user_id: member.user.id,
        role: 'admin',
      }),
    );

    // Verify role in database
    const result = await pool.query(
      `SELECT role FROM "GroupMembers"
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, member.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].role).toBe('admin');
  });

  // EP: Invalid partition - regular member is not an admin
  test('should return 403 when a regular member attempts to promote another member', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const memberOne = await registerAndVerify('Bob', 'bob@example.com');
    const memberTwo = await registerAndVerify('Charlie', 'charlie@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Promote Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${memberOne.token}`)
      .send({
        user_id: memberOne.user.id,
      })
      .expect(201);

    // Charlie joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${memberTwo.token}`)
      .send({
        user_id: memberTwo.user.id,
      })
      .expect(201);

    // Bob attempts to promote Charlie
    const response = await request(app)
      .put(`/groups/roleToAdmin/${groupId}/${memberTwo.user.id}`)
      .set('Authorization', `Bearer ${memberOne.token}`)
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator or an admin");
  });

  // Boundary (BVA): user is not a member of group
  test('should return 404 when attempting to promote a user who is not a group member', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Missing Promote Member Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Creator attempts to promote Bob who is not a member
    const response = await request(app)
      .put(`/groups/roleToAdmin/${groupId}/${user.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(404);

    expect(response.body.message).toBe('Group member not found.');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).put('/groups/roleToAdmin/1/2').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 15 - PUT /groups/roleToUser/:group_id/:user_being_demoted_user_id
// (Update Member Role to User)
// -----------------------------------------------------------------------

describe('PUT /groups/roleToUser/:group_id/:user_being_demoted_user_id', () => {
  // EP: Valid partition - creator successfully demotes admin
  test('should allow the creator to demote an admin to user with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const admin = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Demote Group',
        description: 'Group for role testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        user_id: admin.user.id,
      })
      .expect(201);

    // Creator promotes Bob to admin
    await request(app)
      .put(`/groups/roleToAdmin/${groupId}/${admin.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    // Creator demotes Bob back to user
    const response = await request(app)
      .put(`/groups/roleToUser/${groupId}/${admin.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        group_id: groupId,
        user_id: admin.user.id,
        role: 'user',
      }),
    );

    // Verify role in database
    const result = await pool.query(
      `SELECT role FROM "GroupMembers"
       WHERE group_id = $1 AND user_id = $2`,
      [groupId, admin.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].role).toBe('user');
  });

  // EP: Invalid partition - admin cannot demote another admin
  test('should return 403 when an admin attempts to demote another member', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const adminOne = await registerAndVerify('Bob', 'bob@example.com');
    const adminTwo = await registerAndVerify('Charlie', 'charlie@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Unauthorized Demote Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Both users join group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${adminOne.token}`)
      .send({
        user_id: adminOne.user.id,
      })
      .expect(201);

    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${adminTwo.token}`)
      .send({
        user_id: adminTwo.user.id,
      })
      .expect(201);

    // Creator promotes both users to admin
    await request(app)
      .put(`/groups/roleToAdmin/${groupId}/${adminOne.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    await request(app)
      .put(`/groups/roleToAdmin/${groupId}/${adminTwo.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    // Admin One attempts to demote Admin Two
    const response = await request(app)
      .put(`/groups/roleToUser/${groupId}/${adminTwo.user.id}`)
      .set('Authorization', `Bearer ${adminOne.token}`)
      .expect(403);

    expect(response.body.message).toBe("Error: User is not the group's creator");
  });

  // Boundary (BVA): user is not a member of group
  test('should return 404 when attempting to demote a user who is not a group member', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Missing Demote Member Group',
        description: 'Test group',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Creator attempts to demote Bob who is not a member
    const response = await request(app)
      .put(`/groups/roleToUser/${groupId}/${user.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(404);

    expect(response.body.message).toBe('Group member not found.');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).put('/groups/roleToUser/1/2').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 16 - GET /groups/messages/channels/:group_id
// (Get Discussion Message Channels by Group ID)
// -----------------------------------------------------------------------

describe('GET /groups/messages/channels/:group_id', () => {
  // EP: Valid partition - returns channels belonging to group
  test('should return discussion channels for a group with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Discussion Group',
        description: 'Group for discussions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create messages in different channels
    await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Hello general channel',
      })
      .expect(201);

    await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'homework',
        message: 'Discuss homework here',
      })
      .expect(201);

    // Get discussion channels
    const response = await request(app)
      .get(`/groups/messages/channels/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.objectContaining({
        channels: expect.arrayContaining(['general', 'homework']),
      }),
    );

    expect(response.body.channels).toHaveLength(2);
  });

  // Boundary (BVA): zero rows - group has no discussion messages
  test('should return an empty channels array when group has no messages', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty Discussion Group',
        description: 'Group with no messages',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Get discussion channels
    const response = await request(app)
      .get(`/groups/messages/channels/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(response.body).toEqual({
      channels: [],
    });
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    const response = await request(app).get('/groups/messages/channels/1').expect(401);

    expect(response.body).toBeDefined();
  });
});

// -----------------------------------------------------------------------
// Integration Test 17 - GET /groups/messages/channel/:group_id/:channel_name
// (Get Discussion Messages by Channel and Group)
// -----------------------------------------------------------------------

describe('GET /groups/messages/channel/:group_id/:channel_name', () => {
  // EP: Valid partition - returns messages belonging to group and channel
  test('should return discussion messages for the specified group and channel with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Message Group',
        description: 'Group for testing messages',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create message
    await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Hello everyone',
      })
      .expect(201);

    // Get messages
    const response = await request(app)
      .get(`/groups/messages/channel/${groupId}/general`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
          channel_name: 'general',
          message: 'Hello everyone',
        }),
      ]),
    );
  });

  // Boundary (BVA): zero rows - channel has no messages
  test('should return an empty array when channel has no messages', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty Channel Group',
        description: 'Group with empty channel',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Get messages from channel with no messages
    const response = await request(app)
      .get(`/groups/messages/channel/${groupId}/empty-channel`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).get('/groups/messages/channel/1/general').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 18 - POST /groups/messages/send/:user_id
// (Create / Send Discussion Message)
// -----------------------------------------------------------------------

describe('POST /groups/messages/send/:user_id', () => {
  // EP: Valid partition - member successfully sends a message
  test('group member should be able to send a discussion message with status 201', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Send Message Group',
        description: 'Group for sending messages',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Send message
    const response = await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'This is a test message',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
          channel_name: 'general',
          message: 'This is a test message',
        }),
      ]),
    );

    // Verify message exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupDiscussions"
       WHERE group_id = $1
       AND user_id = $2
       AND channel_name = $3`,
      [groupId, user.user.id, 'general'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].message).toBe('This is a test message');
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when required fields are missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        message: 'Missing group and channel',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: channel_name, message or group_id is undefined');
  });

  // EP: Invalid partition - user is not a group member
  test('should return 403 when user is not a member of the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Creator creates group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Private Message Group',
        description: 'Only members can send',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob attempts to send message without joining
    const response = await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Unauthorized message',
      })
      .expect(403);

    expect(response.body.message).toBe('User is not a member of the group');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groups/messages/send/1')
      .send({
        group_id: 1,
        channel_name: 'general',
        message: 'Unauthorized message',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 19 - PUT /groups/messages/edit/:user_id
// (Update / Edit Discussion Message)
// -----------------------------------------------------------------------

describe('PUT /groups/messages/edit/:user_id', () => {
  // EP: Valid partition - message owner successfully edits message
  test('message owner should be able to update their discussion message with status 200', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Edit Message Group',
        description: 'Group for editing messages',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create message
    const messageResponse = await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Original message',
      })
      .expect(201);

    const messageId = messageResponse.body[0].id;

    // Update message
    const response = await request(app)
      .put(`/groups/messages/edit/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        id: messageId,
        new_message: 'Updated message',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: messageId,
          message: 'Updated message',
        }),
      ]),
    );

    // Verify database was updated
    const result = await pool.query(`SELECT message FROM "GroupDiscussions" WHERE id = $1`, [
      messageId,
    ]);

    expect(result.rows[0].message).toBe('Updated message');
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when id or new_message is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put(`/groups/messages/edit/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        new_message: 'Updated message',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: id or new_message is undefined');
  });

  // EP: Invalid partition - user did not send the message
  test('should return 403 when user tries to edit another user message', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Edit Permission Group',
        description: 'Group for edit permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Add Bob to group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Alice sends message
    const messageResponse = await request(app)
      .post(`/groups/messages/send/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Alice original message',
      })
      .expect(201);

    const messageId = messageResponse.body[0].id;

    // Bob attempts to edit Alice's message
    const response = await request(app)
      .put(`/groups/messages/edit/${member.user.id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        id: messageId,
        new_message: 'Bob changed Alice message',
      })
      .expect(403);

    expect(response.body.message).toBe('Error: You did not send this message');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .put('/groups/messages/edit/1')
      .send({
        id: 1,
        new_message: 'Unauthorized edit',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 20 - DELETE /groups/messages/delete/:user_id
// (Delete Discussion Message)
// -----------------------------------------------------------------------

describe('DELETE /groups/messages/delete/:user_id', () => {
  // EP: Valid partition - message owner successfully deletes message
  test('message owner should be able to delete their discussion message with status 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Delete Message Group',
        description: 'Group for deleting messages',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create message
    const messageResponse = await request(app)
      .post(`/groups/messages/send/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Message to delete',
      })
      .expect(201);

    const messageId = messageResponse.body[0].id;

    // Delete message
    await request(app)
      .delete(`/groups/messages/delete/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        id: messageId,
      })
      .expect(204);

    // Verify message no longer exists
    const result = await pool.query(`SELECT * FROM "GroupDiscussions" WHERE id = $1`, [messageId]);

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - missing id
  test('should return 400 when id is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete(`/groups/messages/delete/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: id is undefined');
  });

  // EP: Invalid partition - user did not send the message
  test('should return 403 when user tries to delete another user message', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Delete Permission Group',
        description: 'Group for delete permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Add Bob to group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Alice sends message
    const messageResponse = await request(app)
      .post(`/groups/messages/send/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        group_id: groupId,
        channel_name: 'general',
        message: 'Alice message',
      })
      .expect(201);

    const messageId = messageResponse.body[0].id;

    // Bob attempts to delete Alice's message
    const response = await request(app)
      .delete(`/groups/messages/delete/${member.user.id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        id: messageId,
      })
      .expect(403);

    expect(response.body.message).toBe('Error: You did not send this message');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .delete('/groups/messages/delete/1')
      .send({
        id: 1,
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 21 - POST /groups/messages/channel/:user_id
// (Create Discussion Message Channel - Admin)
// -----------------------------------------------------------------------

describe('POST /groups/messages/channel/:user_id', () => {
  // EP: Valid partition - admin successfully creates channel
  test('admin should be able to create a discussion channel with status 201', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Channel Group',
        description: 'Group for channel testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create channel
    const response = await request(app)
      .post(`/groups/messages/channel/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        group_id: groupId,
        channel_name: 'homework',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: admin.user.id,
          channel_name: 'homework',
          message: 'Welcome to the new homework channel',
        }),
      ]),
    );

    // Verify channel exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupDiscussions"
       WHERE group_id = $1
       AND channel_name = $2`,
      [groupId, 'homework'],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].message).toBe('Welcome to the new homework channel');
  });

  // EP: Invalid partition - missing required fields
  test('should return 400 when channel_name or group_id is missing', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post(`/groups/messages/channel/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel_name: 'homework',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: channel_name or group_id is undefined');
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Admin Channel Group',
        description: 'Group for admin channel testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group as normal user
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Bob attempts to create channel
    const response = await request(app)
      .post(`/groups/messages/channel/${member.user.id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        group_id: groupId,
        channel_name: 'unauthorized-channel',
      })
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - duplicate channel name
  test('should return 409 when channel name already exists', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Duplicate Channel Group',
        description: 'Group for duplicate channel testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create first channel
    await request(app)
      .post(`/groups/messages/channel/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        group_id: groupId,
        channel_name: 'homework',
      })
      .expect(201);

    // Try creating same channel again
    const response = await request(app)
      .post(`/groups/messages/channel/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        group_id: groupId,
        channel_name: 'homework',
      })
      .expect(409);

    expect(response.body.message).toBe('Error: Group channel with the same name already exists');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groups/messages/channel/1')
      .send({
        group_id: 1,
        channel_name: 'homework',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 22 - DELETE /groups/messages/channel/:group_id
// (Delete Discussion Message Channel - Admin)
// -----------------------------------------------------------------------

describe('DELETE /groups/messages/channel/:group_id', () => {
  // EP: Valid partition - admin successfully deletes channel
  test('admin should be able to delete a discussion channel with status 204', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Delete Channel Group',
        description: 'Group for deleting channels',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create channel
    await request(app)
      .post(`/groups/messages/channel/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        group_id: groupId,
        channel_name: 'homework',
      })
      .expect(201);

    // Delete channel
    await request(app)
      .delete(`/groups/messages/channel/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel_name: 'homework',
      })
      .expect(204);

    // Verify channel messages no longer exist
    const result = await pool.query(
      `SELECT * FROM "GroupDiscussions"
       WHERE group_id = $1
       AND channel_name = $2`,
      [groupId, 'homework'],
    );

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - missing channel name
  test('should return 400 when channel_name is missing', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/groups/messages/channel/1')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: channel_name is undefined');
  });

  // EP: Invalid partition - default general channel cannot be deleted
  test('should return 400 when attempting to delete the default general channel', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/groups/messages/channel/1')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel_name: 'general',
      })
      .expect(400);

    expect(response.body.message).toBe('Cannot delete the default channel');
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Delete Channel Permission Group',
        description: 'Group for testing channel permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create channel as admin
    await request(app)
      .post(`/groups/messages/channel/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        group_id: groupId,
        channel_name: 'homework',
      })
      .expect(201);

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Bob attempts to delete channel
    const response = await request(app)
      .delete(`/groups/messages/channel/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        channel_name: 'homework',
      })
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - channel does not exist
  test('should return 404 when channel does not exist', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Missing Channel Group',
        description: 'Group for missing channel testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Attempt to delete channel that does not exist
    const response = await request(app)
      .delete(`/groups/messages/channel/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        channel_name: 'does-not-exist',
      })
      .expect(404);

    expect(response.body.message).toBe('Channel Name not found');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .delete('/groups/messages/channel/1')
      .send({
        channel_name: 'homework',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 23 - GET /groups/announcements/:group_id
// (Get Announcements by Group)
// -----------------------------------------------------------------------

describe('GET /groups/announcements/:group_id', () => {
  // EP: Valid partition - returns announcements belonging to group
  test('should return announcements for the specified group with status 200', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Announcement Group',
        description: 'Group for announcement testing',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create announcements
    await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'First announcement',
      })
      .expect(201);

    await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'Second announcement',
      })
      .expect(201);

    // Get announcements
    const response = await request(app)
      .get(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);
    expect(response.body).toHaveLength(2);

    expect(response.body.map((announcement) => announcement.text)).toEqual(
      expect.arrayContaining(['First announcement', 'Second announcement']),
    );
  });

  // Boundary (BVA): zero rows - group has no announcements
  test('should return an empty array when group has no announcements', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        name: 'Empty Announcement Group',
        description: 'Group with no announcements',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Get announcements
    const response = await request(app)
      .get(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).get('/groups/announcements/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 24 - POST /groups/announcements/:group_id
// (Create Announcement by Group)
// -----------------------------------------------------------------------

describe('POST /groups/announcements/:group_id', () => {
  // EP: Valid partition - admin successfully creates announcement
  test('admin should be able to create an announcement with status 201', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Create Announcement Group',
        description: 'Group for creating announcements',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create announcement
    const response = await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'Important group announcement',
      })
      .expect(201);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: admin.user.id,
          group_id: groupId,
          text: 'Important group announcement',
        }),
      ]),
    );

    // Verify announcement exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupAnnouncements"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, admin.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].text).toBe('Important group announcement');
  });

  // EP: Invalid partition - missing text
  test('should return 400 when text is missing', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/groups/announcements/1')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: text is undefined');
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Announcement Permission Group',
        description: 'Group for announcement permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Bob attempts to create announcement
    const response = await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        text: 'Unauthorized announcement',
      })
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .post('/groups/announcements/1')
      .send({
        text: 'Unauthorized announcement',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 25 - PUT /groups/announcements/:group_id/:announcement_id
// (Update Announcement)
// -----------------------------------------------------------------------

describe('PUT /groups/announcements/:group_id/:announcement_id', () => {
  // EP: Valid partition - admin successfully updates announcement
  test('admin should be able to update an announcement with status 200', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Update Announcement Group',
        description: 'Group for updating announcements',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create announcement
    const announcementResponse = await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'Original announcement',
      })
      .expect(201);

    const announcementId = announcementResponse.body[0].announcement_id;

    // Update announcement
    const response = await request(app)
      .put(`/groups/announcements/${groupId}/${announcementId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'Updated announcement',
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          announcement_id: announcementId,
          group_id: groupId,
          text: 'Updated announcement',
        }),
      ]),
    );

    // Verify database was updated
    const result = await pool.query(
      `SELECT text FROM "GroupAnnouncements"
       WHERE announcement_id = $1`,
      [announcementId],
    );

    expect(result.rows[0].text).toBe('Updated announcement');
  });

  // EP: Invalid partition - missing text
  test('should return 400 when text is missing', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/groups/announcements/1/1')
      .set('Authorization', `Bearer ${admin.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: text is undefined');
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Update Announcement Permission Group',
        description: 'Group for update permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create announcement as admin
    const announcementResponse = await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        text: 'Original announcement',
      })
      .expect(201);

    const announcementId = announcementResponse.body[0].announcement_id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Bob attempts to update announcement
    const response = await request(app)
      .put(`/groups/announcements/${groupId}/${announcementId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        text: 'Unauthorized update',
      })
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - announcement does not exist
  test('should return 404 when announcement does not exist', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Missing Announcement Group',
        description: 'Group for missing announcement',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .put(`/groups/announcements/${groupId}/999999`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'Updated announcement',
      })
      .expect(404);

    expect(response.body.message).toBe('Announcement not found');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app)
      .put('/groups/announcements/1/1')
      .send({
        text: 'Unauthorized update',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 26 - DELETE /groups/announcements/:group_id/:announcement_id
// (Delete Announcement)
// -----------------------------------------------------------------------

describe('DELETE /groups/announcements/:group_id/:announcement_id', () => {
  // EP: Valid partition - admin successfully deletes announcement
  test('admin should be able to delete an announcement with status 204', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Delete Announcement Group',
        description: 'Group for deleting announcements',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create announcement
    const announcementResponse = await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        text: 'Announcement to delete',
      })
      .expect(201);

    const announcementId = announcementResponse.body[0].announcement_id;

    // Delete announcement
    await request(app)
      .delete(`/groups/announcements/${groupId}/${announcementId}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(204);

    // Verify announcement no longer exists
    const result = await pool.query(
      `SELECT * FROM "GroupAnnouncements"
       WHERE announcement_id = $1`,
      [announcementId],
    );

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - announcement does not exist
  test('should return 404 when announcement does not exist', async () => {
    const admin = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${admin.user.id}`)
      .set('Authorization', `Bearer ${admin.token}`)
      .send({
        name: 'Missing Delete Announcement Group',
        description: 'Group for missing announcement',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .delete(`/groups/announcements/${groupId}/999999`)
      .set('Authorization', `Bearer ${admin.token}`)
      .expect(404);

    expect(response.body.message).toBe('Announcement not found');
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Delete Announcement Permission Group',
        description: 'Group for delete permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create announcement
    const announcementResponse = await request(app)
      .post(`/groups/announcements/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        text: 'Announcement to protect',
      })
      .expect(201);

    const announcementId = announcementResponse.body[0].announcement_id;

    // Bob joins group
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Bob attempts to delete announcement
    const response = await request(app)
      .delete(`/groups/announcements/${groupId}/${announcementId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groups/announcements/1/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 27 - GET /groups/join-requests/:group_id
// (Get Join Requests by Group)
// -----------------------------------------------------------------------

describe('GET /groups/join-requests/:group_id', () => {
  // EP: Valid partition - returns join requests for group
  test('should return join requests for the specified group with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Join Request Group',
        description: 'Group for join requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    // Get join requests
    const response = await request(app)
      .get(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
          status: 'pending',
        }),
      ]),
    );
  });

  // Boundary (BVA): zero rows - group has no join requests
  test('should return an empty array when group has no join requests', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Empty Join Request Group',
        description: 'Group with no join requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Get join requests
    const response = await request(app)
      .get(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    expect(response.body).toEqual([]);
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).get('/groups/join-requests/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 28 - POST /groups/join-requests/:group_id
// (Create Join Request)
// -----------------------------------------------------------------------

describe('POST /groups/join-requests/:group_id', () => {
  // EP: Valid partition - user successfully creates join request
  test('should create a join request successfully with status 201', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Create Join Request Group',
        description: 'Group for creating join requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Create join request
    const response = await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
          status: 'pending',
        }),
      ]),
    );

    // Verify join request exists in database
    const result = await pool.query(
      `SELECT * FROM "GroupJoinRequests"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].status).toBe('pending');
  });

  // EP: Invalid partition - user already has a join request
  test('should return 409 when user already requested to join the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Duplicate Join Request Group',
        description: 'Group for duplicate requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // First join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    // Duplicate join request
    const response = await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(409);

    expect(response.body.message).toBe('You already requested to join this group. ');
  });

  // EP: Invalid partition - user is already a member
  test('should return 409 when user is already a member of the group', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    // Creator is automatically a group member
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Existing Member Join Request Group',
        description: 'Group for existing member',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Creator attempts to create join request
    const response = await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(409);

    expect(response.body.message).toBe('You are already a member');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).post('/groups/join-requests/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 29 - PUT /groups/join-requests/accept/:group_id/:accepted_user_id
// (Accept Join Request)
// -----------------------------------------------------------------------

describe('PUT /groups/join-requests/accept/:group_id/:accepted_user_id', () => {
  // EP: Valid partition - admin successfully accepts join request
  test('admin should be able to accept a join request with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Accept Join Request Group',
        description: 'Group for accepting requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob creates join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    // Alice accepts Bob's request
    const response = await request(app)
      .put(`/groups/join-requests/accept/${groupId}/${user.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
        }),
      ]),
    );

    // Verify Bob is now a group member
    const memberResult = await pool.query(
      `SELECT * FROM "GroupMembers"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(memberResult.rows).toHaveLength(1);
    expect(memberResult.rows[0].role).toBe('user');

    // Verify join request status
    const requestResult = await pool.query(
      `SELECT status FROM "GroupJoinRequests"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(requestResult.rows[0].status).toBe('accepted');
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');
    const requester = await registerAndVerify('Charlie', 'charlie@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Accept Permission Group',
        description: 'Group for accept permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group as normal member
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Charlie creates join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${requester.token}`)
      .expect(201);

    // Bob attempts to accept Charlie's request
    const response = await request(app)
      .put(`/groups/join-requests/accept/${groupId}/${requester.user.id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - join request does not exist
  test('should return 404 when join request does not exist', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Missing Join Request Group',
        description: 'Group for missing request',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .put(`/groups/join-requests/accept/${groupId}/999999`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(404);

    expect(response.body.message).toBe('Join Request not found');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).put('/groups/join-requests/accept/1/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 30 - PUT /groups/join-requests/decline/:group_id/:declined_user_id
// (Decline Join Request)
// -----------------------------------------------------------------------

describe('PUT /groups/join-requests/decline/:group_id/:declined_user_id', () => {
  // EP: Valid partition - admin successfully declines join request
  test('admin should be able to decline a join request with status 200', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Decline Join Request Group',
        description: 'Group for declining requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob creates join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    // Alice declines Bob's request
    const response = await request(app)
      .put(`/groups/join-requests/decline/${groupId}/${user.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          group_id: groupId,
          user_id: user.user.id,
          status: 'denied',
        }),
      ]),
    );

    // Verify join request status in database
    const result = await pool.query(
      `SELECT status FROM "GroupJoinRequests"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows[0].status).toBe('denied');

    // Verify user was NOT added as a member
    const memberResult = await pool.query(
      `SELECT * FROM "GroupMembers"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(memberResult.rows).toHaveLength(0);
  });

  // EP: Invalid partition - user is not an admin
  test('should return 403 when user is not an admin', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const member = await registerAndVerify('Bob', 'bob@example.com');
    const requester = await registerAndVerify('Charlie', 'charlie@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Decline Permission Group',
        description: 'Group for decline permissions',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob joins group as normal member
    await request(app)
      .post(`/groups/join/${groupId}`)
      .set('Authorization', `Bearer ${member.token}`)
      .send({
        user_id: member.user.id,
      })
      .expect(201);

    // Charlie creates join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${requester.token}`)
      .expect(201);

    // Bob attempts to decline Charlie's request
    const response = await request(app)
      .put(`/groups/join-requests/decline/${groupId}/${requester.user.id}`)
      .set('Authorization', `Bearer ${member.token}`)
      .expect(403);

    expect(response.body.message).toBe('User is not an admin');
  });

  // EP: Invalid partition - join request does not exist
  test('should return 404 when join request does not exist', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Missing Decline Request Group',
        description: 'Group for missing decline request',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .put(`/groups/join-requests/decline/${groupId}/999999`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(404);

    expect(response.body.message).toBe('Join Request not found');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).put('/groups/join-requests/decline/1/1').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 31 - DELETE /groups/join-requests/:group_id/:being_deleted_user_id
// (Delete Join Request)
// -----------------------------------------------------------------------

describe('DELETE /groups/join-requests/:group_id/:being_deleted_user_id', () => {
  // EP: Valid partition - join request successfully deleted
  test('should delete a join request with status 204', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');
    const user = await registerAndVerify('Bob', 'bob@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Delete Join Request Group',
        description: 'Group for deleting requests',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    // Bob creates join request
    await request(app)
      .post(`/groups/join-requests/${groupId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(201);

    // Delete Bob's join request
    await request(app)
      .delete(`/groups/join-requests/${groupId}/${user.user.id}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify join request no longer exists
    const result = await pool.query(
      `SELECT * FROM "GroupJoinRequests"
       WHERE group_id = $1
       AND user_id = $2`,
      [groupId, user.user.id],
    );

    expect(result.rows).toHaveLength(0);
  });

  // EP: Invalid partition - join request does not exist
  test('should return 404 when join request does not exist', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    // Create group
    const createResponse = await request(app)
      .post(`/groups/create/${creator.user.id}`)
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        name: 'Missing Delete Join Request Group',
        description: 'Group for missing delete request',
        school: 'SOC',
        module: 'ST0526',
      })
      .expect(201);

    const groupId = createResponse.body.id;

    const response = await request(app)
      .delete(`/groups/join-requests/${groupId}/999999`)
      .set('Authorization', `Bearer ${creator.token}`)
      .expect(404);

    expect(response.body.message).toBe('Join request not found');
  });

  // EP: Invalid partition - user is not authenticated
  test('should return 401 when user is not authenticated', async () => {
    await request(app).delete('/groups/join-requests/1/1').expect(401);
  });
});
