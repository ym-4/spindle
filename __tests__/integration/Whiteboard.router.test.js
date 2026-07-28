const request = require('supertest');
const app = require('../../src/app');
const pool = require('../../src/models/db');

// ── DB Setup / Teardown ──────────────────────────────────

beforeEach(async () => {
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
  await pool.query('DELETE FROM "WhiteboardDrawings"');
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
  await pool.query('DELETE FROM "WhiteboardDrawings"');
  await pool.query('DELETE FROM "Something"');
  await pool.query('DELETE FROM "Person"');

  await pool.end();
});

// ── Helper ───────────────────────────────────────────────

async function registerAndVerify(name, email, password = 'secret') {
  const reg = await request(app).post('/auth/register').send({
    name,
    email,
    password,
  });

  const verify = await request(app).post('/auth/verify-email').send({
    email,
    code: reg.body.previewCode,
  });

  return {
    user: verify.body.user,
    token: verify.body.token,
  };
}

// -----------------------------------------------------------------------
// Integration Test 1 - GET /whiteboards
// (Get all whiteboards)
// -----------------------------------------------------------------------

describe('GET /whiteboards', () => {
  test('should get all whiteboards successfully', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create a whiteboard directly in the database
    await pool.query(
      `INSERT INTO "WhiteboardDrawings"
        ("user_id", "title", "mode", "drawing_data")
       VALUES ($1, $2, $3, $4)`,
      [user.user.id, 'Test Whiteboard', 'whiteboard', []],
    );

    // Get all whiteboards
    const response = await request(app)
      .get('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(200);

    expect(Array.isArray(response.body)).toBe(true);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: user.user.id,
          title: 'Test Whiteboard',
          mode: 'whiteboard',
        }),
      ]),
    );
  });

  test('should reject unauthenticated request', async () => {
    await request(app).get('/whiteboards').expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 2 - POST /whiteboards
// (Create whiteboard)
// -----------------------------------------------------------------------

describe('POST /whiteboards', () => {
  test('should create a whiteboard successfully', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Integration Test Whiteboard',
        mode: 'whiteboard',
      })
      .expect(201);

    expect(Array.isArray(response.body)).toBe(true);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user_id: user.user.id,
          title: 'Integration Test Whiteboard',
          mode: 'whiteboard',
        }),
      ]),
    );

    // Verify whiteboard exists in database
    const result = await pool.query(
      `SELECT * FROM "WhiteboardDrawings"
       WHERE user_id = $1
       AND title = $2`,
      [user.user.id, 'Integration Test Whiteboard'],
    );

    expect(result.rows).toHaveLength(1);
  });

  test('should return 400 when title is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        mode: 'whiteboard',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: title or mode is undefined');
  });

  test('should return 400 when mode is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Test Whiteboard',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: title or mode is undefined');
  });

  test('should return 400 when mode is invalid', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Test Whiteboard',
        mode: 'invalid',
      })
      .expect(400);

    expect(response.body.message).toBe('Error: Invalid mode');
  });

  test('should reject unauthenticated request', async () => {
    await request(app)
      .post('/whiteboards')
      .send({
        title: 'Test Whiteboard',
        mode: 'whiteboard',
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 3 - PUT /whiteboards/:id/drawing_data
// (Update whiteboard drawing data)
// -----------------------------------------------------------------------

describe('PUT /whiteboards/:id/drawing_data', () => {
  test('should update drawing data successfully', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create whiteboard
    const createResponse = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Update Test Whiteboard',
        mode: 'whiteboard',
      })
      .expect(201);

    const whiteboardId = createResponse.body[0].id;

    // Update drawing data
    const response = await request(app)
      .put(`/whiteboards/${whiteboardId}/drawing_data`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        drawing_data: [
          {
            type: 'rectangle',
            x: 100,
            y: 100,
          },
        ],
      })
      .expect(200);

    expect(response.body).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          id: whiteboardId,
          user_id: user.user.id,
        }),
      ]),
    );

    // Verify database
    const result = await pool.query(
      `SELECT * FROM "WhiteboardDrawings"
       WHERE id = $1`,
      [whiteboardId],
    );

    expect(result.rows).toHaveLength(1);

    expect(result.rows[0].drawing_data).toEqual([
      {
        type: 'rectangle',
        x: 100,
        y: 100,
      },
    ]);
  });

  test('should return 400 when drawing_data is missing', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create whiteboard
    const createResponse = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Missing Data Test',
        mode: 'whiteboard',
      })
      .expect(201);

    const whiteboardId = createResponse.body[0].id;

    const response = await request(app)
      .put(`/whiteboards/${whiteboardId}/drawing_data`)
      .set('Authorization', `Bearer ${user.token}`)
      .send({})
      .expect(400);

    expect(response.body.message).toBe('Error: drawing_data is undefined');
  });

  test('should return 403 when user is not the creator', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Creator creates whiteboard
    const createResponse = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Protected Whiteboard',
        mode: 'whiteboard',
      })
      .expect(201);

    const whiteboardId = createResponse.body[0].id;

    // Other user attempts update
    const response = await request(app)
      .put(`/whiteboards/${whiteboardId}/drawing_data`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .send({
        drawing_data: [],
      })
      .expect(403);

    expect(response.body.message).toBe('You are not the creator of this whiteboard');
  });

  test('should return 404 when whiteboard does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .put('/whiteboards/999999/drawing_data')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        drawing_data: [],
      })
      .expect(404);

    expect(response.body.message).toBe('Whiteboard not found');
  });

  test('should reject unauthenticated request', async () => {
    await request(app)
      .put('/whiteboards/1/drawing_data')
      .send({
        drawing_data: [],
      })
      .expect(401);
  });
});

// -----------------------------------------------------------------------
// Integration Test 4 - DELETE /whiteboards/:id
// (Delete whiteboard)
// -----------------------------------------------------------------------

describe('DELETE /whiteboards/:id', () => {
  test('should return 403 when user is not the creator', async () => {
    const creator = await registerAndVerify('Alice', 'alice@example.com');

    const otherUser = await registerAndVerify('Bob', 'bob@example.com');

    // Creator creates whiteboard
    const createResponse = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${creator.token}`)
      .send({
        title: 'Protected Whiteboard',
        mode: 'whiteboard',
      })
      .expect(201);

    const whiteboardId = createResponse.body[0].id;

    // Other user attempts delete
    const response = await request(app)
      .delete(`/whiteboards/${whiteboardId}`)
      .set('Authorization', `Bearer ${otherUser.token}`)
      .expect(403);

    expect(response.body.message).toBe('You are not the creator of this whiteboard');
  });

  test('should return 404 when whiteboard does not exist', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    const response = await request(app)
      .delete('/whiteboards/999999')
      .set('Authorization', `Bearer ${user.token}`)
      .expect(404);

    expect(response.body.message).toBe('Whiteboard not found');
  });

  test('should delete whiteboard successfully and return 204', async () => {
    const user = await registerAndVerify('Alice', 'alice@example.com');

    // Create whiteboard
    const createResponse = await request(app)
      .post('/whiteboards')
      .set('Authorization', `Bearer ${user.token}`)
      .send({
        title: 'Delete Me',
        mode: 'whiteboard',
      })
      .expect(201);

    const whiteboardId = createResponse.body[0].id;

    // Delete whiteboard
    await request(app)
      .delete(`/whiteboards/${whiteboardId}`)
      .set('Authorization', `Bearer ${user.token}`)
      .expect(204);

    // Verify whiteboard was deleted
    const result = await pool.query(
      `SELECT * FROM "WhiteboardDrawings"
       WHERE id = $1`,
      [whiteboardId],
    );

    expect(result.rows).toHaveLength(0);
  });

  test('should reject unauthenticated request', async () => {
    await request(app).delete('/whiteboards/1').expect(401);
  });
});
