const request = require('supertest');
const { generatePandabotReply, getPandabotUserId } = require('../../src/services/pandabot');

let mockUserId = 1;

jest.mock('../../src/middlewares/auth.middleware', () => ({
  authenticateJWT: async (req, res, next) => {
    const pool = require('../../src/models/db');
    const { rows } = await pool.query('SELECT role FROM "Person" WHERE id = $1', [mockUserId]);
    req.user = {
      id: mockUserId,
      name: 'Test User',
      email: 'test@test.com',
      role: rows[0]?.role || 'user',
    };
    next();
  },
  requireAdmin: (req, res, next) => next(),
}));

jest.mock('../../src/services/pandabot', () => ({
  generatePandabotReply: jest.fn(),
  getPandabotUserId: jest.fn(),
  PANDABOT_EMAIL: 'pandabot@spindle.internal',
}));

const app = require('../../src/app');
const pool = require('../../src/models/db');

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

// ── Helper ───────────────────────────────────────────────
async function createTestUser(name = 'Test User', email = 'test@test.com') {
  const { rows } = await pool.query(
    `
    INSERT INTO "Person"
    (
      name,
      email,
      hashed_password,
      role,
      email_verified
    )
    VALUES
    (
      $1,
      $2,
      'fakehash',
      'user',
      TRUE
    )
    RETURNING id
    `,
    [name, email],
  );

  mockUserId = rows[0].id;

  return {
    id: mockUserId,
  };
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
  // Boundary: zero rows – empty table returns an empty array
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
// POST /comments/:post_id
// ─────────────────────────────────────────────────────────
describe('POST /comments/:post_id', () => {
  // Valid partition: authenticated user creates a comment
  test('should return 201 and create a new comment', async () => {
    const author = await createTestUser('PostAuthor', 'postowner@example.com');
    const post = await createTestPost(author.id);

    const commenter = await createTestUser('Commenter', 'commenter@example.com');

    const res = await request(app).post(`/comments/${post.id}`).field('content', 'Nice post!');

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

    await createTestUser('Replier', 'replier@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
      .field('content', 'A reply')
      .field('parent_comment_id', parentId);

    expect(res.status).toBe(201);
    expect(res.body.parent_comment_id).toBe(String(parentId));
  });

  // Invalid partition: content missing
  test('should return 400 when content is missing', async () => {
    const author = await createTestUser('NoContentAuthor', 'nocontentauthor@example.com');
    const post = await createTestPost(author.id);

    const res = await request(app).post(`/comments/${post.id}`).field('unrelated', 'value');

    expect(res.status).toBe(400);
    expect(res.body.message).toMatch(/content is undefined/i);
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
      .field('content', 'Updated content');

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);
    expect(res.body.content).toBe('Updated content');
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

    await createTestUser('Stranger', 'stranger@example.com');

    const res = await request(app)
      .put(`/comments/${commentId}`)
      .field('content', 'Hijacked content');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/comments not found/i);
  });

  // Boundary: non-existent comment id
  test('should return 404 when the comment does not exist', async () => {
    await createTestUser('GhostUpdateUser', 'ghostupdate@example.com');

    const res = await request(app).put('/comments/999999').field('content', 'Ghost content');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/comments not found/i);
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

    const res = await request(app).delete(`/comments/${commentId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(commentId);

    const check = await pool.query('SELECT * FROM "PostComments" WHERE id = $1', [commentId]);
    expect(check.rows).toHaveLength(0);
  });

  // Valid partition: post owner deletes someone else's comment on their post WIP
  //   test("should return 200 when the post owner deletes another user's comment", async () => {
  //     const postOwner = await createTestUser('DeletePostOwner', 'deletepostowner@example.com');
  //     const post = await createTestPost(postOwner.id);

  //     const commenter = await createTestUser('DeleteCommenter', 'deletecommenter@example.com');

  //     const { rows } = await pool.query(
  //       `INSERT INTO "PostComments" (user_id, post_id, content)
  //        VALUES ($1, $2, 'Someone else\'s comment')
  //        RETURNING id`,
  //       [commenter.id, post.id],
  //     );

  //     const commentId = rows[0].id;

  //     // authenticate as the post owner
  //     mockUserId = postOwner.id;

  //     const res = await request(app).delete(`/comments/${commentId}`);

  //     expect(res.status).toBe(200);
  //     expect(res.body.id).toBe(commentId);
  //   });

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

    await createTestUser('RandomStranger', 'randomstranger@example.com');

    const res = await request(app).delete(`/comments/${commentId}`);

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not authorized/i);
  });

  // Boundary: non-existent comment id
  test('should return 404 when the comment does not exist', async () => {
    await createTestUser('GhostDeleteUser', 'ghostdelete@example.com');

    const res = await request(app).delete('/comments/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/not authorized|not found/i);
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

    const res = await request(app).get(`/comments/saved/${saver.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  // Boundary: user has not saved anything
  test('should return 200 and an empty array when the user has no saved comments', async () => {
    const user = await createTestUser('NoSavedCommentsUser', 'nosavedcomments@example.com');

    const res = await request(app).get(`/comments/saved/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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

    const res = await request(app).post('/comments/saved').send({ comment_id: commentId });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.comment_id).toBe(commentId);
    expect(res.body.user_id).toBe(saver.id);
  });

  // Invalid partition: comment_id missing from body
  test('should return 400 when comment_id is missing', async () => {
    await createTestUser('NoCommentIdUser', 'nocommentid@example.com');

    const res = await request(app).post('/comments/saved').send({});

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

    await createTestUser('DupCommentSaver', 'dupcommentsaver@example.com');

    await request(app).post('/comments/saved').send({ comment_id: commentId });
    const res = await request(app).post('/comments/saved').send({ comment_id: commentId });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already saved/i);
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

    const res = await request(app).delete(`/comments/saved/${saveId}`);

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(saveId);

    const check = await pool.query('SELECT * FROM "SavedComments" WHERE id = $1', [saveId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent save id
  test('should return 404 when the saved comment does not exist', async () => {
    const res = await request(app).delete('/comments/saved/999999');

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/save not found/i);
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

    const res = await request(app).get(`/comments/reaction/${reactor.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].reaction_type).toBe('like');
  });

  // Boundary: user has not reacted to anything
  test('should return 200 and an empty array when the user has no reactions', async () => {
    const user = await createTestUser('NoCommentReactionsUser', 'nocommentreactions@example.com');

    const res = await request(app).get(`/comments/reaction/${user.id}`);

    expect(res.status).toBe(200);
    expect(res.body).toEqual([]);
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
      .send({ comment_id: commentId, reaction_type: 'like' });

    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty('id');
    expect(res.body.comment_id).toBe(commentId);
    expect(res.body.user_id).toBe(liker.id);
    expect(res.body.reaction_type).toBe('like');
  });

  // Invalid partition: comment_id missing from body
  test('should return 400 when comment_id is missing', async () => {
    await createTestUser('NoCommentIdLiker', 'nocommentidliker@example.com');

    const res = await request(app).post('/comments/like').send({ reaction_type: 'like' });

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

    await createTestUser('DupCommentReactor', 'dupcommentreactor@example.com');

    await request(app)
      .post('/comments/like')
      .send({ comment_id: commentId, reaction_type: 'like' });
    const res = await request(app)
      .post('/comments/like')
      .send({ comment_id: commentId, reaction_type: 'dislike' });

    expect(res.status).toBe(409);
    expect(res.body.message).toMatch(/already reacted/i);
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
      .send({ user_id: reactor.id, reaction_type: 'dislike' });

    expect(res.status).toBe(200);
    expect(res.body.reaction_type).toBe('dislike');
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const res = await request(app)
      .put('/comments/reaction/999999')
      .send({ user_id: 1, reaction_type: 'dislike' });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
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
      .send({ user_id: reactor.id });

    expect(res.status).toBe(200);
    expect(res.body.id).toBe(reactionId);

    const check = await pool.query('SELECT * FROM "CommentReactions" WHERE id = $1', [reactionId]);
    expect(check.rows).toHaveLength(0);
  });

  // Boundary: non-existent reaction id
  test('should return 404 when the reaction does not exist', async () => {
    const res = await request(app).delete('/comments/reaction/999999').send({ user_id: 1 });

    expect(res.status).toBe(404);
    expect(res.body.error).toMatch(/reaction not found/i);
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

    await createTestUser('BotCommenter', 'botcommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
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
    await createTestUser('NoBotCommenter', 'nobotcommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
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
    await createTestUser('MentionCommenter', 'mentioncommenter@example.com');

    const res = await request(app)
      .post(`/comments/${post.id}`)
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
// POST /comments/:post_id — @mention notifications
// ─────────────────────────────────────────────────────────
describe('POST /comments/:id/report', () => {
  test('should submit a report using the authenticated user, not a client-supplied one', async () => {
    const author = await createTestUser('ReportedCommentAuthor', 'reportedcommentauthor@example.com');
    const post = await createTestPost(author.id);
    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'bad comment') RETURNING id`,
      [author.id, post.id],
    );
    const commentId = rows[0].id;

    const reporter = await createTestUser('CommentReporter', 'commentreporter@example.com');

    const res = await request(app)
      .post(`/comments/${commentId}/report`)
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

    const res = await request(app).post(`/comments/${rows[0].id}/report`).send({});

    expect(res.status).toBe(400);
  });

  test('should return 409 when the same user reports the same comment twice', async () => {
    const author = await createTestUser('DupeReportAuthor', 'dupereportauthor@example.com');
    const post = await createTestPost(author.id);
    const { rows } = await pool.query(
      `INSERT INTO "PostComments" (user_id, post_id, content) VALUES ($1, $2, 'comment') RETURNING id`,
      [author.id, post.id],
    );
    await createTestUser('DupeReporter', 'dupereporter@example.com');

    await request(app).post(`/comments/${rows[0].id}/report`).send({ reason: 'spam' });
    const res = await request(app).post(`/comments/${rows[0].id}/report`).send({ reason: 'spam' });

    expect(res.status).toBe(409);
  });
});

// ─────────────────────────────────────────────────────────
// GET /comments/reports
// ─────────────────────────────────────────────────────────
describe('GET /comments/reports', () => {
  test('should return the report list for an admin', async () => {
    const admin = await createTestUser('CommentReportsAdmin', 'commentreportsadmin@example.com');
    await pool.query(`UPDATE "Person" SET role = 'admin' WHERE id = $1`, [admin.id]);
    mockUserId = admin.id;

    const res = await request(app).get('/comments/reports');

    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  test('should return 403 for a non-admin user', async () => {
    await createTestUser('RegularCommentUser', 'regularcommentuser@example.com');

    const res = await request(app).get('/comments/reports');

    expect(res.status).toBe(403);
  });
});