const request = require('supertest');
const { generatePandabotReply, getPandabotUserId } = require('../../src/services/pandabot');

jest.mock('../../src/services/pandabot', () => ({
  generatePandabotReply: jest.fn(),
  getPandabotUserId: jest.fn(),
  PANDABOT_EMAIL: 'pandabot@spindle.internal',
}));

jest.mock('../../src/models/PostComments.model', () => {
  const actual = jest.requireActual('../../src/models/PostComments.model');
  const mocked = {};
  Object.keys(actual).forEach((key) => {
    mocked[key] = jest.fn(actual[key]);
  });
  return mocked;
});

const app = require('../../src/app');
const pool = require('../../src/models/db');
const PostCommentsModel = require('../../src/models/PostComments.model');

// ── DB Setup / Teardown ──────────────────────────────────
// Tables are created via the Jest globalSetup (configs/jest-integration-setup.js)
// which runs scripts/reset.js before any test file executes.
beforeEach(async () => {
  // Clean slate for every test
  jest.clearAllMocks();
  await pool.query('DELETE FROM "Notifications"');
  await pool.query('DELETE FROM "CommentReactions"');
  await pool.query('DELETE FROM "SavedComments"');
  await pool.query('DELETE FROM "PostComments"');
  await pool.query('DELETE FROM "Posts"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
});

afterAll(async () => {
  await pool.query('DELETE FROM "Notifications"');
  await pool.query('DELETE FROM "CommentReactions"');
  await pool.query('DELETE FROM "SavedComments"');
  await pool.query('DELETE FROM "PostComments"');
  await pool.query('DELETE FROM "Posts"');
  await pool.query('DELETE FROM "UserSessions"');
  await pool.query('DELETE FROM "Person"');
  await pool.end();
});

// ── Helpers ───────────────────────────────────────────────
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

async function createTestUser(name = 'Test User', email = 'test@test.com', password = 'secret') {
  const { user, token } = await registerAndVerify(name, email, password);
  return { id: user.id, token, email, password };
}

async function createTestPost(userId, title = 'Test Post', category = 'general') {
  const { rows } = await pool.query(
    `INSERT INTO "Posts"
    (user_id, title, category, content)
    VALUES ($1, $2, $3, 'Content')
    RETURNING id`,
    [userId, title, category],
  );

  return { id: rows[0].id };
}

async function promoteToAdmin(user) {
  await pool.query(`UPDATE "Person" SET role = 'admin' WHERE id = $1`, [user.id]);
  const relogged = await loginAndVerify(user.email, user.password);
  user.token = relogged.token;
  return user;
}

async function waitFor(conditionFn, { timeout = 3000, interval = 100 } = {}) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const result = await conditionFn();
    if (result) return result;
    await new Promise((r) => setTimeout(r, interval));
  }
  throw new Error('Timed out waiting for condition');
}

// ─────────────────────────────────────────────────────────
// GET /comments
// ─────────────────────────────────────────────────────────
describe('GET /comments', () => {
  // Boundary: no posts returns an empty array
  test('should return 200 and an empty array when no comments exist', async () => {
    const res = await request(app).get('/comments');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Valid partition: existing comments are returned
  test('should return 200 and all comments', async () => {
    const user = await createTestUser('CommentAuthor', 'commentauthor@example.com');
    const post = await createTestPost(user.id);

    await pool.query(
      `INSERT INTO "PostComments"
      (user_id, post_id, content)
      VALUES
      ($1, $2, 'First comment'),
      ($1, $2, 'Second comment')`,
      [user.id, post.id],
    );

    const res = await request(app).get('/comments');

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(2);
    expect(res.body[0]).toHaveProperty('id');
    expect(res.body[0]).toHaveProperty('content');
    expect(res.body[0]).toHaveProperty('post_id');
    expect(res.body[0]).toHaveProperty('user_id');
  });
});

// ─────────────────────────────────────────────────────────
// GET /comments/:post_id
// ─────────────────────────────────────────────────────────
describe('GET /comments/:post_id', () => {
  // Valid partition: returns only comments belonging to the post
  test('should return 200 and the comments for that post', async () => {
    const user = await createTestUser('PostCommentsUser', 'postcomments@example.com');
    const post = await createTestPost(user.id);
    const otherPost = await createTestPost(user.id, 'Other Post');

    await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES
       ($1, $2, 'Comment on target post'),
       ($1, $3, 'Comment on other post')`,
      [user.id, post.id, otherPost.id],
    );

    const res = await request(app).get(`/comments/${post.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Comment on target post');
  });

  // Boundary: post exists but has no comments
  test('should return 200 and an empty array when the post has no comments', async () => {
    const user = await createTestUser('NoCommentsUser', 'nocomments@example.com');
    const post = await createTestPost(user.id);

    const res = await request(app).get(`/comments/${post.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Boundary: non-existent post id
  test('should return 200 and an empty array for a non-existent post', async () => {
    const res = await request(app).get('/comments/999999');

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });
});

// ─────────────────────────────────────────────────────────
// GET /comments/user/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /comments/user/:user_id', () => {
  // Valid partition: returns another user's comments on non-anonymous posts
  test("should return a user's comments with post context", async () => {
    const author = await createTestUser('ProfileCommentAuthor', 'profilecommentauthor@example.com');
    const post = await createTestPost(author.id, 'A Public Post');
    await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'Great post!')`,
      [author.id, post.id],
    );

    const viewer = await createTestUser('ProfileCommentViewer', 'profilecommentviewer@example.com');

    const res = await request(app)
      .get(`/comments/user/${author.id}`)
      .set('Authorization', `Bearer ${viewer.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].content).toBe('Great post!');
    expect(res.body[0].post_title).toBe('A Public Post');
  });

  // Boundary: comments on anonymous posts are excluded from the public view
  test('should exclude comments made on anonymous posts', async () => {
    const author = await createTestUser('AnonCommentAuthor', 'anoncommentauthor@example.com');
    const anonPost = await createTestPost(author.id, 'Anon Post');
    await pool.query(`UPDATE "Posts" SET is_anonymous = TRUE WHERE id = $1`, [anonPost.id]);
    await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'Anonymous-post comment')`,
      [author.id, anonPost.id],
    );

    const res = await request(app)
      .get(`/comments/user/${author.id}`)
      .set('Authorization', `Bearer ${author.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(0);
  });

  // Boundary: user has no comments at all
  test('should return an empty array for a user with no comments', async () => {
    const user = await createTestUser('NoCommentsUser', 'nocommentsuser@example.com');

    const res = await request(app)
      .get(`/comments/user/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Error handling: no auth token provided
  test('should return 401 when no auth token is provided', async () => {
    const user = await createTestUser('UnauthUserCommentsUser', 'unauthusercomments@example.com');

    const res = await request(app).get(`/comments/user/${user.id}`);

    expect(res.status).toBe(401);
  });
});

// ─────────────────────────────────────────────────────────
// POST /comments/:post_id
// ─────────────────────────────────────────────────────────
describe('POST /comments/:post_id', () => {
  // Valid partition: authenticated user creates a comment
  test('should return 201 and create a new comment', async () => {
    const author = await createTestUser('PostAuthor', 'postowner@example.com');
    const post = await createTestPost(author.id);

    const commenter = await createTestUser('Commenter', 'commenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'Nice post!');

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.content).toBe('Nice post!');
    expect(res.body.commented_on).toBe(String(post.id));
    expect(res.body.user_id).toBe(commenter.id);
    expect(res.body.parent_comment_id).toBeNull();
  });

  // Valid partition: reply to an existing comment with parent_comment_id
  test('should return 201 and create a reply to an existing comment', async () => {
    const author = await createTestUser('ReplyPostAuthor', 'replypostauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows: parentRows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Parent comment')
       RETURNING id`,
      [author.id, post.id],
    );
    const parentId = parentRows[0].id;

    const replier = await createTestUser('Replier', 'replier@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${replier.token}`)
      .field('content', 'A reply')
      .field('parent_comment_id', parentId);

    expect(res.status).toBe(201);
    expect(res.body.parent_comment_id).toBe(String(parentId));
  });

  // Invalid partition: content missing
  test('should return 400 when content is missing', async () => {
    const author = await createTestUser('NoContentAuthor', 'nocontentauthor@example.com');
    const post = await createTestPost(author.id);

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${author.token}`)
      .field('unrelated', 'value');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/content is undefined/i);
  });

  // Error handling: insertComments fails
  test('should return 500 when creating the comment fails', async () => {
    const author = await createTestUser('CommentFailAuthor', 'commentfailauthor@example.com');
    const post = await createTestPost(author.id);

    PostCommentsModel.insertComments.mockRejectedValueOnce(new Error('Insert boom'));

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${author.token}`)
      .field('content', 'This will explode');

    expect(res.status).toBe(500);
  });

  // Boundary: uploading a file attaches it to the new comment
  test('should attach a file when one is uploaded', async () => {
    const author = await createTestUser(
      'AttachNewCommentAuthor',
      'attachnewcommentauthor@example.com',
    );
    const post = await createTestPost(author.id);
    const commenter = await createTestUser('AttachCommenter', 'attachcommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'Comment with a file')
      .attach('attachment', Buffer.from('fake image bytes'), 'new-comment-file.png');

    expect(res.status).toBe(201);
    expect(res.body.attachment_url).toMatch(/^\/uploads\/comments\//);
  });

  // Error handling: comment creation still succeeds when @mention fails
  test('should still return 201 when @mention notification fails', async () => {
    const author = await createTestUser('MentionFailAuthor', 'mentionfailauthor@example.com');
    const post = await createTestPost(author.id);
    const commenter = await createTestUser(
      'MentionFailCommenter',
      'mentionfailcommenter@example.com',
    );

    const originalQuery = pool.query.bind(pool);
    const querySpy = jest.spyOn(pool, 'query').mockImplementation((text, params) => {
      if (typeof text === 'string' && text.includes('WHERE LOWER(name) = ANY($1)')) {
        return Promise.reject(new Error('mention lookup boom'));
      }
      return originalQuery(text, params);
    });

    try {
      const res = await request(app)
        .post(`/comments/${post.id}`)
        .set('Authorization', `Bearer ${commenter.token}`)
        .field('content', 'hey @someone check this out');

      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 300));
    } finally {
      querySpy.mockRestore();
    }
  });

  // Error handling: comment creation still succeeds when post-owner notification fails
  test('should still return 201 when post-owner notification fails', async () => {
    const author = await createTestUser(
      'OwnerNotifyFailAuthor',
      'ownernotifyfailauthor@example.com',
    );
    const post = await createTestPost(author.id);
    const commenter = await createTestUser(
      'OwnerNotifyFailCommenter',
      'ownernotifyfailcommenter@example.com',
    );

    const originalQuery = pool.query.bind(pool);
    const querySpy = jest.spyOn(pool, 'query').mockImplementation((text, params) => {
      if (
        typeof text === 'string' &&
        text.includes('SELECT display_name, name FROM "Person" WHERE id = $1') &&
        params?.[0] === commenter.id
      ) {
        return Promise.reject(new Error('owner notify lookup boom'));
      }
      return originalQuery(text, params);
    });

    try {
      const res = await request(app)
        .post(`/comments/${post.id}`)
        .set('Authorization', `Bearer ${commenter.token}`)
        .field('content', 'no mentions here, just a comment');

      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 300));
    } finally {
      querySpy.mockRestore();
    }
  });

  // Valid partition: commenting on someone else's post notifies the post owner
  test('should notify the post owner when a different user comments', async () => {
    const author = await createTestUser('NotifyOwnerSuccessAuthor', 'notifyownersuccessauthor@example.com');
    const post = await createTestPost(author.id);
    const commenter = await createTestUser(
      'NotifyOwnerSuccessCommenter',
      'notifyownersuccesscommenter@example.com',
    );

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'a comment with no mentions');

    expect(res.status).toBe(201);

    const notif = await waitFor(async () => {
      const { rows: notifRows } = await pool.query(
        `SELECT * FROM "Notifications" WHERE user_id = $1 AND type = 'comment'`,
        [author.id],
      );
      return notifRows[0];
    });

    expect(notif.title).toContain('commented on your post');
  });
});

// ─────────────────────────────────────────────────────────
// PUT /comments/:id
// ─────────────────────────────────────────────────────────
describe('PUT /comments/:id', () => {
  // Valid partition: owner updates their own comment
  test('should return 200 and update the comment', async () => {
    const author = await createTestUser('UpdateCommentAuthor', 'updatecommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Old content')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    // authenticate as the comment owner
    const res = await request(app)
      .put(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .field('content', 'Updated content');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);
    expect(res.body.content).toBe('Updated content');
  });

  // Boundary: uploading a file attaches it to the comment
  test('should attach a file when one is uploaded', async () => {
    const author = await createTestUser('AttachCommentAuthor', 'attachcommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Content')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const res = await request(app)
      .put(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .field('content', 'Content with attachment')
      .attach('attachment', Buffer.from('fake image bytes'), 'comment-file.png');

    expect(res.status).toBe(200);
    expect(res.body.attachment_url).toMatch(/^\/uploads\/comments\//);
  });

  // Boundary: remove_attachment=true clears the stored attachment reference
  test('should clear the attachment reference when remove_attachment is true', async () => {
    const author = await createTestUser(
      'ClearAttachCommentAuthor',
      'clearattachcommentauthor@example.com',
    );
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content, attachment_url)
       VALUES ($1, $2, 'Content', '/uploads/comments/old-file.png')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const res = await request(app)
      .put(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${author.token}`)
      .field('content', 'Content')
      .field('remove_attachment', 'true');

    expect(res.status).toBe(200);
    expect(res.body.attachment_url).toBeNull();
  });

  // Invalid partition: authenticated user does not own the comment
  test("should return 404 when updating another user's comment", async () => {
    const owner = await createTestUser('CommentOwner', 'commentowner@example.com');
    const post = await createTestPost(owner.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Protected content')
       RETURNING id`,
      [owner.id, post.id],
    );

    const commentId = rows[0].id;

    const stranger = await createTestUser('Stranger', 'stranger@example.com');

    const res = await request(app)
      .put(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${stranger.token}`)
      .field('content', 'Hijacked content');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/comments not found/i);
  });

  // Boundary: non-existent comment id
  test('should return 404 when the comment does not exist', async () => {
    const actor = await createTestUser('GhostUpdateUser', 'ghostupdate@example.com');

    const res = await request(app)
      .put('/comments/999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .field('content', 'Ghost content');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/comments not found/i);
  });

  // Error handling: updateCommentsByID fails unexpectedly
  test('should return 500 when updating the comment fails unexpectedly', async () => {
    const author = await createTestUser('UpdateFailAuthor', 'updatefailauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Content')
       RETURNING id`,
      [author.id, post.id],
    );

    PostCommentsModel.updateCommentsByID.mockRejectedValueOnce(new Error('Update boom'));

    const res = await request(app)
      .put(`/comments/${rows[0].id}`)
      .set('Authorization', `Bearer ${author.token}`)
      .field('content', 'New content');

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /comments/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /comments/:id', () => {
  // Valid partition: comment owner deletes their own comment
  test('should return 200 when the comment owner deletes their comment', async () => {
    const author = await createTestUser('DeleteCommentOwner', 'deletecommentowner@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Delete me')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const res = await request(app)
      .delete(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${author.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);

    const check = await pool.query('SELECT * FROM "PostComments" WHERE id = $1', [commentId]);
    expect(check.rows).toHaveLength(0);
  });

  // Valid partition: post owner deletes someone else's comment on their post
  test("should return 200 when the post owner deletes another user's comment", async () => {
    const postOwner = await createTestUser('DeletePostOwner', 'deletepostowner@example.com');
    const post = await createTestPost(postOwner.id);

    const commenter = await createTestUser('DeleteCommenter', 'deletecommenter@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Someone else''s comment')
       RETURNING id`,
      [commenter.id, post.id],
    );

    const commentId = rows[0].id;

    // authenticate as the post owner
    const res = await request(app)
      .delete(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${postOwner.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);
  });

  // Invalid partition: neither comment owner nor post owner
  test('should return 404 when the user is neither the comment owner nor the post owner', async () => {
    const postOwner = await createTestUser('ProtectedPostOwner', 'protectedpostowner@example.com');
    const post = await createTestPost(postOwner.id);

    const commenter = await createTestUser('ProtectedCommenter', 'protectedcommenter@example.com');

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Protected comment')
       RETURNING id`,
      [commenter.id, post.id],
    );

    const commentId = rows[0].id;

    const stranger = await createTestUser('RandomStranger', 'randomstranger@example.com');

    const res = await request(app)
      .delete(`/comments/${commentId}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  // Boundary: non-existent comment id
  test('should return 404 when the comment does not exist', async () => {
    const actor = await createTestUser('GhostDeleteUser', 'ghostdelete@example.com');

    const res = await request(app)
      .delete('/comments/999999')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not authorized|not found/i);
  });

  // Error handling: deleteCommentsByID fails
  test('should return 500 when deleting the comment fails', async () => {
    const author = await createTestUser(
      'DeleteCommentFailAuthor',
      'deletecommentfailauthor@example.com',
    );
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Content')
       RETURNING id`,
      [author.id, post.id],
    );

    PostCommentsModel.deleteCommentsByID.mockRejectedValueOnce(new Error('Delete boom'));

    const res = await request(app)
      .delete(`/comments/${rows[0].id}`)
      .set('Authorization', `Bearer ${author.token}`);

    expect(res.status).toBe(500);
  });
});

// ==================== Saved Comments ========================
// ─────────────────────────────────────────────────────────
// GET /comments/saved/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /comments/saved/:user_id', () => {
  // Valid partition: returns the comments a user has saved
  test('should return 200 and the saved comments for the user', async () => {
    const author = await createTestUser('SavedCommentAuthor', 'savedcommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows: commentRows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Save-worthy comment')
       RETURNING id`,
      [author.id, post.id],
    );

    const saver = await createTestUser('CommentSaver', 'commentsaver@example.com');

    await pool.query(`INSERT INTO "SavedComments" (user_id, comment_id) VALUES ($1, $2)`, [
      saver.id,
      commentRows[0].id,
    ]);

    const res = await request(app)
      .get(`/comments/saved/${saver.id}`)
      .set('Authorization', `Bearer ${saver.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  // Boundary: user has not saved anything
  test('should return 200 and an empty array when the user has no saved comments', async () => {
    const user = await createTestUser('NoSavedCommentsUser', 'nosavedcomments@example.com');

    const res = await request(app)
      .get(`/comments/saved/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: authenticated user requests another user's saved comments
  test("should return 403 when requesting another user's saved comments", async () => {
    const owner = await createTestUser('SavedOwnerUser', 'savedowneruser@example.com');
    const stranger = await createTestUser('SavedStrangerUser', 'savedstrangeruser@example.com');

    const res = await request(app)
      .get(`/comments/saved/${owner.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });
});

// ─────────────────────────────────────────────────────────
// POST /comments/saved
// ─────────────────────────────────────────────────────────
describe('POST /comments/saved', () => {
  // Valid partition: authenticated user saves a comment
  test('should return 201 and save the comment for the authenticated user', async () => {
    const author = await createTestUser('SaveCommentAuthor', 'savecommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Save me')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const saver = await createTestUser('SaverOfComment', 'saverofcomment@example.com');

    const res = await request(app)
      .post('/comments/saved')
      .set('Authorization', `Bearer ${saver.token}`)
      .send({ comment_id: commentId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.comment_id).toBe(commentId);
    expect(res.body.user_id).toBe(saver.id);
  });

  // Invalid partition: comment_id missing from body
  test('should return 400 when comment_id is missing', async () => {
    const actor = await createTestUser('NoCommentIdUser', 'nocommentid@example.com');

    const res = await request(app)
      .post('/comments/saved')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({});

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/comment_id/i);
  });

  // Boundary: saving the same comment twice
  test('should return 409 when the user has already saved the comment', async () => {
    const author = await createTestUser('DupSaveCommentAuthor', 'dupsavecommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Duplicate save target')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const saver = await createTestUser('DupCommentSaver', 'dupcommentsaver@example.com');

    await request(app)
      .post('/comments/saved')
      .set('Authorization', `Bearer ${saver.token}`)
      .send({ comment_id: commentId });
    const res = await request(app)
      .post('/comments/saved')
      .set('Authorization', `Bearer ${saver.token}`)
      .send({ comment_id: commentId });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already saved/i);
  });

  // Error handling: insertSavedComment fails
  test('should return 500 when saving a comment fails', async () => {
    const actor = await createTestUser('SaveFailUser', 'savefailuser@example.com');

    PostCommentsModel.insertSavedComment.mockRejectedValueOnce(new Error('Save boom'));

    const res = await request(app)
      .post('/comments/saved')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ comment_id: 999999 });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /comments/saved/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /comments/saved/:id', () => {
  // Valid partition: deletes an existing saved comment record
  test('should return 200 and delete the saved comment', async () => {
    const author = await createTestUser(
      'DeleteSaveCommentAuthor',
      'deletesavecommentauthor@example.com',
    );
    const post = await createTestPost(author.id);

    const { rows: commentRows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Content')
       RETURNING id`,
      [author.id, post.id],
    );

    const saver = await createTestUser('DeleteCommentSaver', 'deletecommentsaver@example.com');

    const { rows: saveRows } = await pool.query(
      `INSERT INTO "SavedComments" (user_id, comment_id)
       VALUES ($1, $2)
       RETURNING id`,
      [saver.id, commentRows[0].id],
    );

    const saveId = saveRows[0].id;

    const res = await request(app)
      .delete(`/comments/saved/${saveId}`)
      .set('Authorization', `Bearer ${saver.token}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saveId);

    const check = await pool.query('SELECT * FROM "SavedComments" WHERE id = $1', [saveId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent save id
  test('should return 404 when the saved comment does not exist', async () => {
    const actor = await createTestUser(
      'MissingSavedCommentUser',
      'missingsavedcommentuser@example.com',
    );

    const res = await request(app)
      .delete('/comments/saved/999999')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/save not found/i);
  });

  // Error handling: deleteSavedCommentByID fails
  test('should return 500 when unsaving a comment fails', async () => {
    const actor = await createTestUser('UnsaveFailUser', 'unsavefailuser@example.com');

    PostCommentsModel.deleteSavedCommentByID.mockRejectedValueOnce(new Error('Unsave boom'));

    const res = await request(app)
      .delete('/comments/saved/1')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(500);
  });
});

// ================== Comment Reactions ======================
// ─────────────────────────────────────────────────────────
// GET /comments/reaction/:user_id
// ─────────────────────────────────────────────────────────
describe('GET /comments/reaction/:user_id', () => {
  // Valid partition: returns the reactions belonging to a user
  test('should return 200 and the reactions for the user', async () => {
    const author = await createTestUser('ReactCommentAuthor', 'reactcommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows: commentRows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Reactable comment')
       RETURNING id`,
      [author.id, post.id],
    );

    const reactor = await createTestUser('CommentReactor', 'commentreactor@example.com');

    await pool.query(
      `INSERT INTO "CommentReactions" (comment_id, user_id, reaction_type)
       VALUES ($1, $2, 'like')`,
      [commentRows[0].id, reactor.id],
    );

    const res = await request(app)
      .get(`/comments/reaction/${reactor.id}`)
      .set('Authorization', `Bearer ${reactor.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reaction_type).toBe('like');
  });

  // Boundary: user has not reacted to anything
  test('should return 200 and an empty array when the user has no reactions', async () => {
    const user = await createTestUser('NoCommentReactionsUser', 'nocommentreactions@example.com');

    const res = await request(app)
      .get(`/comments/reaction/${user.id}`)
      .set('Authorization', `Bearer ${user.token}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
  });

  // Invalid partition: authenticated user requests another user's reactions
  test("should return 403 when requesting another user's reactions", async () => {
    const owner = await createTestUser('ReactionOwnerUser', 'reactionowneruser@example.com');
    const stranger = await createTestUser(
      'ReactionStrangerUser',
      'reactionstrangeruser@example.com',
    );

    const res = await request(app)
      .get(`/comments/reaction/${owner.id}`)
      .set('Authorization', `Bearer ${stranger.token}`);

    expect(res.status).toBe(403);
    expect(res.body.error).toMatch(/not authorized/i);
  });
});

// ─────────────────────────────────────────────────────────
// POST /comments/like
// ─────────────────────────────────────────────────────────
describe('POST /comments/like', () => {
  // Valid partition: authenticated user likes a comment
  test('should return 201 and create a like', async () => {
    const author = await createTestUser('LikeCommentAuthor', 'likecommentauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Likeable comment')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const liker = await createTestUser('CommentLiker', 'commentliker@example.com');

    const res = await request(app)
      .post('/comments/like')
      .set('Authorization', `Bearer ${liker.token}`)
      .send({ comment_id: commentId, reaction_type: 'like' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.comment_id).toBe(commentId);
    expect(res.body.user_id).toBe(liker.id);
    expect(res.body.reaction_type).toBe('like');
  });

  // Invalid partition: comment_id missing from body
  test('should return 400 when comment_id is missing', async () => {
    const actor = await createTestUser('NoCommentIdLiker', 'nocommentidliker@example.com');

    const res = await request(app)
      .post('/comments/like')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ reaction_type: 'like' });

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/comment_id/i);
  });

  // Boundary: reacting to the same comment twice
  test('should return 409 when the user has already reacted to the comment', async () => {
    const author = await createTestUser(
      'DupReactCommentAuthor',
      'dupreactcommentauthor@example.com',
    );
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Duplicate reaction target')
       RETURNING id`,
      [author.id, post.id],
    );

    const commentId = rows[0].id;

    const reactor = await createTestUser('DupCommentReactor', 'dupcommentreactor@example.com');

    await request(app)
      .post('/comments/like')
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ comment_id: commentId, reaction_type: 'like' });
    const res = await request(app)
      .post('/comments/like')
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ comment_id: commentId, reaction_type: 'dislike' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already reacted/i);
  });

  // Error handling: insertCommentLike fails
  test('should return 500 when liking a comment fails', async () => {
    const actor = await createTestUser('LikeFailUser', 'likefailuser@example.com');

    PostCommentsModel.insertCommentLike.mockRejectedValueOnce(new Error('Like boom'));

    const res = await request(app)
      .post('/comments/like')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ comment_id: 999999, reaction_type: 'like' });

    expect(res.status).toBe(500);
  });

  // Error handling: like still succeeds even if the notification fails
  test('should still return 201 when the comment-reaction notification fails', async () => {
    const author = await createTestUser('NotifyFailAuthor', 'notifyfailauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Notify-fail target')
       RETURNING id`,
      [author.id, post.id],
    );
    const commentId = rows[0].id;

    const liker = await createTestUser('NotifyFailLiker', 'notifyfailliker@example.com');

    const originalQuery = pool.query.bind(pool);
    const querySpy = jest.spyOn(pool, 'query').mockImplementation((text, params) => {
      if (typeof text === 'string' && text.includes('pc.user_id, pc.content, pc.post_id')) {
        return Promise.reject(new Error('lookup boom'));
      }
      return originalQuery(text, params);
    });

    try {
      const res = await request(app)
        .post('/comments/like')
        .set('Authorization', `Bearer ${liker.token}`)
        .send({ comment_id: commentId, reaction_type: 'like' });

      expect(res.status).toBe(201);

      await new Promise((r) => setTimeout(r, 300));
    } finally {
      querySpy.mockRestore();
    }
  });

  // Valid partition: reacting to someone else's comment sends them a notification
  test('should notify the comment owner when a different user dislikes their comment', async () => {
    const author = await createTestUser('NotifySuccessAuthor', 'notifysuccessauthor@example.com');
    const post = await createTestPost(author.id);

    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Notify-success target')
       RETURNING id`,
      [author.id, post.id],
    );
    const commentId = rows[0].id;

    const disliker = await createTestUser('NotifySuccessDisliker', 'notifysuccessdisliker@example.com');

    const res = await request(app)
      .post('/comments/like')
      .set('Authorization', `Bearer ${disliker.token}`)
      .send({ comment_id: commentId, reaction_type: 'dislike' });

    expect(res.status).toBe(201);

    const notif = await waitFor(async () => {
      const { rows: notifRows } = await pool.query(
        `SELECT * FROM "Notifications" WHERE user_id = $1 AND type = 'comment_reaction'`,
        [author.id],
      );
      return notifRows[0];
    });

    expect(notif.title).toContain('reacted 👎 to your comment');
  });
});

// ─────────────────────────────────────────────────────────
// PUT /comments/reaction/:id
// ─────────────────────────────────────────────────────────
describe('PUT /comments/reaction/:id', () => {
  // Valid partition: changes an existing reaction from like to dislike
  test('should return 200 and update the reaction type', async () => {
    const author = await createTestUser(
      'UpdateCommentReactionAuthor',
      'updatecommentreactionauthor@example.com',
    );
    const post = await createTestPost(author.id);

    const { rows: commentRows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Content')
       RETURNING id`,
      [author.id, post.id],
    );

    const reactor = await createTestUser(
      'UpdateCommentReactor',
      'updatecommentreactor@example.com',
    );

    const { rows: reactionRows } = await pool.query(
      `INSERT INTO "CommentReactions" (comment_id, user_id, reaction_type)
       VALUES ($1, $2, 'like')
       RETURNING id`,
      [commentRows[0].id, reactor.id],
    );

    const res = await request(app)
      .put(`/comments/reaction/${reactionRows[0].id}`)
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ user_id: reactor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(200);
    expect(res.body.reaction_type).toBe('dislike');
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const actor = await createTestUser(
      'MissingCommentReactionUser',
      'missingcommentreactionuser@example.com',
    );

    const res = await request(app)
      .put('/comments/reaction/999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ user_id: actor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
  });

  // Error handling: updateCommentReaction fails
  test('should return 500 when updating the reaction fails', async () => {
    const actor = await createTestUser(
      'ReactionUpdateFailUser',
      'reactionupdatefailuser@example.com',
    );

    PostCommentsModel.updateCommentReaction.mockRejectedValueOnce(
      new Error('Reaction update boom'),
    );

    const res = await request(app)
      .put('/comments/reaction/1')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ user_id: actor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// DELETE /comments/reaction/:id
// ─────────────────────────────────────────────────────────
describe('DELETE /comments/reaction/:id', () => {
  // Valid partition: deletes an existing reaction
  test('should return 200 and delete the reaction', async () => {
    const author = await createTestUser(
      'DeleteCommentReactionAuthor',
      'deletecommentreactionauthor@example.com',
    );
    const post = await createTestPost(author.id);

    const { rows: commentRows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content)
       VALUES ($1, $2, 'Content')
       RETURNING id`,
      [author.id, post.id],
    );

    const reactor = await createTestUser(
      'DeleteCommentReactor',
      'deletecommentreactor@example.com',
    );

    const { rows: reactionRows } = await pool.query(
      `INSERT INTO "CommentReactions" (comment_id, user_id, reaction_type)
       VALUES ($1, $2, 'like')
       RETURNING id`,
      [commentRows[0].id, reactor.id],
    );

    const reactionId = reactionRows[0].id;

    const res = await request(app)
      .delete(`/comments/reaction/${reactionId}`)
      .set('Authorization', `Bearer ${reactor.token}`)
      .send({ user_id: reactor.id });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reactionId);

    const check = await pool.query('SELECT * FROM "CommentReactions" WHERE id = $1', [reactionId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const actor = await createTestUser(
      'MissingCommentReactionDeleteUser',
      'missingcommentreactiondeleteuser@example.com',
    );

    const res = await request(app)
      .delete('/comments/reaction/999999')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ user_id: actor.id });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
  });

  // Error handling: deleteCommentReaction fails
  test('should return 500 when deleting the reaction fails', async () => {
    const actor = await createTestUser(
      'ReactionDeleteFailUser',
      'reactiondeletefailuser@example.com',
    );

    PostCommentsModel.deleteCommentReaction.mockRejectedValueOnce(
      new Error('Reaction delete boom'),
    );

    const res = await request(app)
      .delete('/comments/reaction/1')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ user_id: actor.id });

    expect(res.status).toBe(500);
  });
});

// ─────────────────────────────────────────────────────────
// POST /comments/:post_id — PandaBot auto-reply
// ─────────────────────────────────────────────────────────
describe('POST /comments/:post_id — PandaBot auto-reply', () => {
  async function createPandabotUser() {
    const { rows } = await pool.query(
      `INSERT INTO "Person" (name, email, hashed_password, role, email_verified)
       VALUES ('PandaBot', 'pandabot@spindle.internal', 'fakehash', 'user', TRUE)
       RETURNING id`,
    );
    return rows[0].id;
  }

  // Valid partition: a comment mentioning @pandabot gets a threaded bot reply
  test('should create a threaded PandaBot reply when a comment mentions @pandabot', async () => {
    const author = await createTestUser('BotPostAuthor', 'botpostauthor@example.com');
    const post = await createTestPost(author.id);
    const botUserId = await createPandabotUser();

    getPandabotUserId.mockResolvedValue(botUserId);
    generatePandabotReply.mockResolvedValue('Sounds like a solid plan tbh.');

    const commenter = await createTestUser('BotCommenter', 'botcommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'hey @pandabot what do you think?');

    expect(res.status).toBe(201);
    const triggerCommentId = res.body.id;

    const botReply = await waitFor(async () => {
      const { rows } = await pool.query(
        `SELECT * FROM "PostComments" WHERE user_id = $1 AND parent_comment_id = $2`,
        [botUserId, triggerCommentId],
      );
      return rows[0];
    });

    expect(botReply.content).toContain('Sounds like a solid plan tbh.');
    expect(botReply.content).toContain('@BotCommenter');
  });

  // Boundary: a comment with no @pandabot mention should never trigger the bot
  test('should not create a PandaBot reply when the comment does not mention @pandabot', async () => {
    const author = await createTestUser('NoBotPostAuthor', 'nobotpostauthor@example.com');
    const post = await createTestPost(author.id);
    await createPandabotUser();
    const commenter = await createTestUser('NoBotCommenter', 'nobotcommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'just a normal comment');

    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 300));

    const { rows } = await pool.query(`SELECT * FROM "PostComments" WHERE post_id = $1`, [post.id]);
    expect(rows).toHaveLength(1);
    expect(generatePandabotReply).not.toHaveBeenCalled();
  });
});

// ─────────────────────────────────────────────────────────
// POST /comments/:post_id — @mention notifications
// ─────────────────────────────────────────────────────────
describe('POST /comments/:post_id — @mention notifications', () => {
  // Valid partition: mentioning another user creates a 'mention' notification for them
  test('should create a notification for a mentioned user', async () => {
    const author = await createTestUser('MentionPostAuthor', 'mentionpostauthor@example.com');
    const post = await createTestPost(author.id);

    const mentioned = await createTestUser('alice', 'alice@example.com');
    const commenter = await createTestUser('MentionCommenter', 'mentioncommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'great point @alice!');

    expect(res.status).toBe(201);

    const notif = await waitFor(async () => {
      const { rows } = await pool.query(
        `SELECT * FROM "Notifications" WHERE user_id = $1 AND type = 'mention'`,
        [mentioned.id],
      );
      return rows[0];
    });

    expect(notif.title).toContain('mentioned you in a comment');
  });

  // Boundary: a user mentioning themselves should not get a notification
  test('should not notify a user who mentions themselves', async () => {
    const author = await createTestUser('SelfMentionAuthor', 'selfmentionauthor@example.com');
    const post = await createTestPost(author.id);

    const commenter = await createTestUser('bob', 'bob@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .set('Authorization', `Bearer ${commenter.token}`)
      .field('content', 'note to self @bob remember this');

    expect(res.status).toBe(201);

    await new Promise((r) => setTimeout(r, 300));

    const { rows } = await pool.query(
      `SELECT * FROM "Notifications" WHERE user_id = $1 AND type = 'mention'`,
      [commenter.id],
    );
    expect(rows).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────
// POST /comments/:id/report
// ─────────────────────────────────────────────────────────
describe('POST /comments/:id/report', () => {
  test('should submit a report using the authenticated user', async () => {
    const author = await createTestUser(
      'ReportedCommentAuthor',
      'reportedcommentauthor@example.com',
    );
    const post = await createTestPost(author.id);
    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'bad comment') RETURNING id`,
      [author.id, post.id],
    );
    const commentId = rows[0].id;

    const reporter = await createTestUser('CommentReporter', 'commentreporter@example.com');

    const res = await request(app)
      .post(`/comments/${commentId}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ reason: 'harassment' });

    expect(res.status).toBe(201);
    expect(res.body.user_id).toBe(reporter.id);
  });

  test('should return 400 when reason is missing', async () => {
    const author = await createTestUser('NoReasonAuthor', 'noreasonauthor@example.com');
    const post = await createTestPost(author.id);
    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'comment') RETURNING id`,
      [author.id, post.id],
    );

    const res = await request(app)
      .post(`/comments/${rows[0].id}/report`)
      .set('Authorization', `Bearer ${author.token}`)
      .send({});

    expect(res.status).toBe(400);
  });

  test('should return 409 when the same user reports the same comment twice', async () => {
    const author = await createTestUser('DupeReportAuthor', 'dupereportauthor@example.com');
    const post = await createTestPost(author.id);
    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'comment') RETURNING id`,
      [author.id, post.id],
    );
    const reporter = await createTestUser('DupeReporter', 'dupereporter@example.com');

    await request(app)
      .post(`/comments/${rows[0].id}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ reason: 'spam' });
    const res = await request(app)
      .post(`/comments/${rows[0].id}/report`)
      .set('Authorization', `Bearer ${reporter.token}`)
      .send({ reason: 'spam' });

    expect(res.status).toBe(409);
  });

  // Error handling: reporting a non-existent comment id
  test('should return 500 when reporting a comment that does not exist', async () => {
    const actor = await createTestUser(
      'BadFkReportCommentUser',
      'badfkreportcommentuser@example.com',
    );

    const res = await request(app)
      .post('/comments/999999999/report')
      .set('Authorization', `Bearer ${actor.token}`)
      .send({ reason: 'spam' });

    expect(res.status).toBe(500);
    expect(res.body.message).toMatch(/failed to submit report/i);
  });
});

// ─────────────────────────────────────────────────────────
// GET /comments/reports
// ─────────────────────────────────────────────────────────
describe('GET /comments/reports', () => {
  test('should return the report list for an admin', async () => {
    const admin = await createTestUser('CommentReportsAdmin', 'commentreportsadmin@example.com');
    await promoteToAdmin(admin);

    const res = await request(app)
      .get('/comments/reports')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('should return 403 for a non-admin user', async () => {
    const actor = await createTestUser('RegularCommentUser', 'regularcommentuser@example.com');

    const res = await request(app)
      .get('/comments/reports')
      .set('Authorization', `Bearer ${actor.token}`);

    expect(res.status).toBe(403);
  });

  test('should return 500 when fetching reports fails', async () => {
    const admin = await createTestUser(
      'CommentReportsFailAdmin',
      'commentreportsfailadmin@example.com',
    );
    await promoteToAdmin(admin);

    PostCommentsModel.getAllCommentReports.mockRejectedValueOnce(new Error('Reports boom'));

    const res = await request(app)
      .get('/comments/reports')
      .set('Authorization', `Bearer ${admin.token}`);

    expect(res.status).toBe(500);
  });
});