const pool = require('../../src/models/db');
const {
  getAllComments,
  getCommentsByPostID,
  getCommentsByUserID,
  insertComments,
  updateCommentsByID,
  deleteCommentsByID,
  getSavedCommentsByUserID,
  insertSavedComment,
  deleteSavedCommentByID,
  getCommentReactionByUserID,
  insertCommentLike,
  updateCommentReaction,
  deleteCommentReaction,
  deleteCommentByPostOwner,
  insertCommentReport,
  getAllCommentReports,
} = require('../../src/models/PostComments.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── getAllComments ───────────────────────────────────────
describe('PostComments.model - getAllComments', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: multiple comments returned from the database
  test('should return all comments', async () => {
    const fakeComments = [
      { id: 1, post_id: 10, content: 'First comment' },
      { id: 2, post_id: 10, content: 'Second comment' },
    ];

    pool.query.mockResolvedValue({ rows: fakeComments });

    const result = await getAllComments();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "PostComments"');
    expect(result).toEqual(fakeComments);
  });

  // Boundary: zero rows returned from the database
  test('should return an empty array when no comments exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllComments();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection timeout'));

    await expect(getAllComments()).rejects.toThrow('connection timeout');
  });
});

// ── getCommentsByPostID ──────────────────────────────────
describe('PostComments.model - getCommentsByPostID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns comments for the given post with author name
  test('should return all comments for the given post', async () => {
    const fakeComments = [
      { id: 1, post_id: 10, content: 'First comment', author_name: 'Alice' },
      { id: 2, post_id: 10, content: 'Reply comment', author_name: 'Bob' },
    ];

    pool.query.mockResolvedValue({ rows: fakeComments });

    const result = await getCommentsByPostID({ post_id: 10 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE pc.post_id = $1'), [10]);
    expect(result).toEqual(fakeComments);
  });

  // Boundary: post exists but has no comments
  test('should return an empty array when the post has no comments', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getCommentsByPostID({ post_id: 999 });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE pc.post_id = $1'),
      [999],
    );
    expect(result).toEqual([]);
  });

  // Boundary: post_id = 0
  test('should pass post_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getCommentsByPostID({ post_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE pc.post_id = $1'), [0]);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getCommentsByPostID({ post_id: 1 })).rejects.toThrow('connection lost');
  });
});

// ── getCommentsByUserID ──────────────────────────────────
describe('PostComments.model - getCommentsByUserID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns a user's comments on non-anonymous posts
  test("should return the user's comments with post context", async () => {
    const fakeRows = [
      { id: 1, content: 'Nice post!', post_title: 'My Post', post_is_anonymous: false },
    ];
    pool.query.mockResolvedValue({ rows: fakeRows });

    const result = await getCommentsByUserID({ user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('AND p.is_anonymous = FALSE'),
      [5],
    );
    expect(result).toEqual(fakeRows);
  });

  // Boundary: user has no comments
  test('should return an empty array when the user has no comments', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getCommentsByUserID({ user_id: 999 });

    expect(result).toEqual([]);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getCommentsByUserID({ user_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [0]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getCommentsByUserID({ user_id: 5 })).rejects.toThrow('connection lost');
  });
});

// ── insertComments ───────────────────────────────────────
describe('PostComments.model - insertComments', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a top-level comment with all fields provided
  test('should insert a comment and return the created comment id', async () => {
    const fakeComment = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakeComment] });

    const result = await insertComments({
      user_id: 5,
      post_id: 10,
      content: 'Nice post!',
      parent_comment_id: null,
      attachment_url: 'attachment.png',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PostComments" (user_id, post_id, content, parent_comment_id, attachment_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [5, 10, 'Nice post!', null, 'attachment.png'],
    );

    expect(result).toEqual(fakeComment);
  });

  // Valid partition: insert a reply using parent_comment_id
  test('should insert a reply comment referencing its parent', async () => {
    const fakeComment = { id: 2 };
    pool.query.mockResolvedValue({ rows: [fakeComment] });

    const result = await insertComments({
      user_id: 5,
      post_id: 10,
      content: 'A reply',
      parent_comment_id: 1,
      attachment_url: null,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PostComments" (user_id, post_id, content, parent_comment_id, attachment_url) VALUES ($1, $2, $3, $4, $5) RETURNING id',
      [5, 10, 'A reply', 1, null],
    );

    expect(result).toEqual(fakeComment);
  });

  // Boundary: optional fields omitted - defaults should be used
  test('should default parent_comment_id and attachment_url to null when omitted', async () => {
    const fakeComment = { id: 3 };
    pool.query.mockResolvedValue({ rows: [fakeComment] });

    const result = await insertComments({
      user_id: 5,
      post_id: 10,
      content: 'Top-level comment',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      5,
      10,
      'Top-level comment',
      null,
      null,
    ]);

    expect(result).toEqual(fakeComment);
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "PostComments" violates foreign key constraint'),
    );

    await expect(
      insertComments({
        user_id: 999,
        post_id: 999,
        content: 'Orphan comment',
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertComments({
        user_id: 5,
        post_id: 10,
        content: 'Content',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── updateCommentsByID ───────────────────────────────────
describe('PostComments.model - updateCommentsByID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: owner updates their own comment
  test('should update the comment and return the updated row', async () => {
    const updatedComment = {
      id: 1,
      content: 'Updated content',
      attachment_url: null,
    };

    pool.query.mockResolvedValue({ rows: [updatedComment] });

    const result = await updateCommentsByID({
      id: 1,
      user_id: 5,
      content: 'Updated content',
      attachment_url: null,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostComments" SET "content" = $1, "attachment_url" = $2 WHERE "id" = $3 AND "user_id" = $4 RETURNING *',
      ['Updated content', null, 1, 5],
    );

    expect(result).toEqual(updatedComment);
  });

  // Boundary: id/user_id combination does not match any row
  test('should return undefined when the comment does not belong to the user', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateCommentsByID({
      id: 1,
      user_id: 999,
      content: 'Hijacked content',
      attachment_url: null,
    });

    expect(result).toBeUndefined();
  });

  // Boundary: id = 0
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateCommentsByID({
      id: 0,
      user_id: 0,
      content: 'Content',
      attachment_url: null,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostComments" SET "content" = $1, "attachment_url" = $2 WHERE "id" = $3 AND "user_id" = $4 RETURNING *',
      ['Content', null, 0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateCommentsByID({
        id: 1,
        user_id: 5,
        content: 'Content',
        attachment_url: null,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── deleteCommentsByID ───────────────────────────────────
describe('PostComments.model - deleteCommentsByID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: owner deletes their own comment
  test('should delete the comment and return the deleted row', async () => {
    const deletedComment = { id: 1, content: 'Delete me' };

    pool.query.mockResolvedValue({ rows: [deletedComment] });

    const result = await deleteCommentsByID({ id: 1, user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "PostComments" WHERE "id" = $1 AND "user_id" = $2 RETURNING *',
      [1, 5],
    );

    expect(result).toEqual(deletedComment);
  });

  // Boundary: id/user_id does not match any row (not the owner, or does not exist)
  test('should return undefined when the comment does not belong to the user', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteCommentsByID({ id: 1, user_id: 999 });

    expect(result).toBeUndefined();
  });

  // Boundary: id = 0
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteCommentsByID({ id: 0, user_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "PostComments" WHERE "id" = $1 AND "user_id" = $2 RETURNING *',
      [0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteCommentsByID({ id: 1, user_id: 5 })).rejects.toThrow('connection lost');
  });
});

// =========================
// Saved Comments
// =========================
// ── getSavedCommentsByUserID ─────────────────────────────
describe('PostComments.model - getSavedCommentsByUserID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: user has multiple saved comments
  test('should return all saved comments for a user', async () => {
    const savedComments = [
      { save_id: 1, comment_id: 10, post_title: 'Post A', author_name: 'Alice' },
      { save_id: 2, comment_id: 20, post_title: 'Post B', author_name: 'Bob' },
    ];

    pool.query.mockResolvedValue({ rows: savedComments });

    const result = await getSavedCommentsByUserID({ user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE sc.user_id = $1'), [5]);
    expect(result).toEqual(savedComments);
  });

  // Boundary: user has no saved comments
  test('should return an empty array when the user has no saved comments', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getSavedCommentsByUserID({ user_id: 999 });

    expect(result).toEqual([]);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getSavedCommentsByUserID({ user_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE sc.user_id = $1'), [0]);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getSavedCommentsByUserID({ user_id: 1 })).rejects.toThrow('connection lost');
  });
});

// ── insertSavedComment ───────────────────────────────────
describe('PostComments.model - insertSavedComment', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: save a comment and return the created save id
  test('should insert a saved comment and return the created save id', async () => {
    const fakeSave = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakeSave] });

    const result = await insertSavedComment({ user_id: 5, comment_id: 10 });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "SavedComments" (user_id, comment_id) VALUES ($1, $2) RETURNING id',
      [5, 10],
    );

    expect(result).toEqual(fakeSave);
  });

  // Boundary: id values = 0 are passed to query
  test('should pass id values of 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await insertSavedComment({ user_id: 0, comment_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "SavedComments" (user_id, comment_id) VALUES ($1, $2) RETURNING id',
      [0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: duplicate save violates the UNIQUE constraint
  test('should propagate unique constraint errors when a comment is saved twice', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(insertSavedComment({ user_id: 5, comment_id: 10 })).rejects.toThrow(
      'unique constraint',
    );
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "SavedComments" violates foreign key constraint'),
    );

    await expect(insertSavedComment({ user_id: 999, comment_id: 999 })).rejects.toThrow(
      'foreign key',
    );
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(insertSavedComment({ user_id: 5, comment_id: 10 })).rejects.toThrow(
      'connection lost',
    );
  });
});

// ── deleteSavedCommentByID ───────────────────────────────
describe('PostComments.model - deleteSavedCommentByID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: owner deletes their own saved comment
  test('should delete the saved comment for its owner and return the deleted row', async () => {
    const fakeRow = { id: 1, user_id: 5, comment_id: 10 };
    pool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await deleteSavedCommentByID({ id: 1, user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "SavedComments" WHERE "id" = $1 AND user_id = $2 RETURNING *',
      [1, 5],
    );
    expect(result).toEqual(fakeRow);
  });

  // Boundary: id = 0
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await deleteSavedCommentByID({ id: 0, user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "SavedComments" WHERE "id" = $1 AND user_id = $2 RETURNING *',
      [0, 5],
    );
  });

  // Boundary: save doesn't exist, or belongs to a different user
  test('should return undefined when the save does not belong to the user', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteSavedCommentByID({ id: 1, user_id: 999 });

    expect(result).toBeUndefined();
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteSavedCommentByID({ id: 1, user_id: 5 })).rejects.toThrow('connection lost');
  });
});

// =========================
// Comment Reactions
// =========================
// ── getCommentReactionByUserID ───────────────────────────
describe('PostComments.model - getCommentReactionByUserID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: user has multiple comment reactions
  test('should return all comment reactions for a user', async () => {
    const reactions = [
      { id: 1, comment_id: 10, user_id: 5, reaction_type: 'like' },
      { id: 2, comment_id: 20, user_id: 5, reaction_type: 'dislike' },
    ];

    pool.query.mockResolvedValue({ rows: reactions });

    const result = await getCommentReactionByUserID({ user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "CommentReactions" WHERE user_id = $1',
      [5],
    );

    expect(result).toEqual(reactions);
  });

  // Boundary: user has no comment reactions
  test('should return an empty array when the user has no reactions', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getCommentReactionByUserID({ user_id: 999 });

    expect(result).toEqual([]);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getCommentReactionByUserID({ user_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "CommentReactions" WHERE user_id = $1',
      [0],
    );

    expect(result).toEqual([]);
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getCommentReactionByUserID({ user_id: 1 })).rejects.toThrow('connection lost');
  });
});

// ── insertCommentLike ────────────────────────────────────
describe('PostComments.model - insertCommentLike', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a reaction and return the created reaction id
  test('should insert a comment reaction and return the created reaction id', async () => {
    const fakeReaction = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakeReaction] });

    const result = await insertCommentLike({
      comment_id: 10,
      user_id: 5,
      reaction_type: 'like',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "CommentReactions" (comment_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id',
      [10, 5, 'like'],
    );

    expect(result).toEqual(fakeReaction);
  });

  // Boundary: id values = 0 are passed to query
  test('should pass id values of 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await insertCommentLike({
      comment_id: 0,
      user_id: 0,
      reaction_type: 'dislike',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "CommentReactions" (comment_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id',
      [0, 0, 'dislike'],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: duplicate reaction violates the UNIQUE constraint
  test('should propagate unique constraint errors when a user reacts to the same comment twice', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertCommentLike({
        comment_id: 10,
        user_id: 5,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('unique constraint');
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "CommentReactions" violates foreign key constraint'),
    );

    await expect(
      insertCommentLike({
        comment_id: 999,
        user_id: 999,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertCommentLike({
        comment_id: 10,
        user_id: 5,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── updateCommentReaction ────────────────────────────────
describe('PostComments.model - updateCommentReaction', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: update a reaction and return the updated reaction
  test('should update the reaction type and return the updated reaction', async () => {
    const updatedReaction = {
      id: 1,
      comment_id: 10,
      user_id: 5,
      reaction_type: 'dislike',
    };

    pool.query.mockResolvedValue({ rows: [updatedReaction] });

    const result = await updateCommentReaction({
      id: 1,
      user_id: 5,
      reaction_type: 'dislike',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "CommentReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 AND "id" = $3 RETURNING *',
      ['dislike', 5, 1],
    );

    expect(result).toEqual(updatedReaction);
  });

  // Valid partition: verify parameterised SQL structure
  test('should execute a parameterised update query', async () => {
    const updatedReaction = { id: 1 };

    pool.query.mockResolvedValue({ rows: [updatedReaction] });

    await updateCommentReaction({
      id: 1,
      user_id: 5,
      reaction_type: 'like',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];

    expect(sql).toContain('UPDATE "CommentReactions" SET');
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual(['like', 5, 1]);
  });

  // Boundary: non-existent reaction returns undefined
  test('should return undefined when the reaction does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateCommentReaction({
      id: 999,
      user_id: 5,
      reaction_type: 'like',
    });

    expect(result).toBeUndefined();
  });

  // Boundary: id = 0
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateCommentReaction({
      id: 0,
      user_id: 0,
      reaction_type: 'dislike',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "CommentReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 AND "id" = $3 RETURNING *',
      ['dislike', 0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateCommentReaction({
        id: 1,
        user_id: 5,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── deleteCommentReaction ────────────────────────────────
describe('PostComments.model - deleteCommentReaction', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: deletes an existing reaction
  test('should delete the reaction and return the deleted row', async () => {
    const deletedReaction = { id: 1, comment_id: 10, user_id: 5, reaction_type: 'like' };

    pool.query.mockResolvedValue({ rows: [deletedReaction] });

    const result = await deleteCommentReaction({ id: 1, user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "CommentReactions" WHERE "id" = $1 AND "user_id" = $2 RETURNING *',
      [1, 5],
    );

    expect(result).toEqual(deletedReaction);
  });

  // Boundary: id/user_id combination does not match any row
  test('should return undefined when the reaction does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteCommentReaction({ id: 999, user_id: 5 });

    expect(result).toBeUndefined();
  });

  // Boundary: id = 0
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteCommentReaction({ id: 0, user_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "CommentReactions" WHERE "id" = $1 AND "user_id" = $2 RETURNING *',
      [0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteCommentReaction({ id: 1, user_id: 5 })).rejects.toThrow('connection lost');
  });
});

// ── deleteCommentByPostOwner ─────────────────────────────
describe('PostComments.model - deleteCommentByPostOwner', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: post owner deletes a comment on their own post
  test('should delete the comment and return the deleted row', async () => {
    const deletedComment = { id: 1, post_id: 10, user_id: 99, content: 'Someone else comment' };

    pool.query.mockResolvedValue({ rows: [deletedComment] });

    const result = await deleteCommentByPostOwner({ id: 1, user_id: 5 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "PostComments" WHERE id = $1 AND post_id IN (SELECT id FROM "Posts" WHERE user_id = $2) RETURNING *',
      [1, 5],
    );

    expect(result).toEqual(deletedComment);
  });

  // Boundary: comment does not belong to a post owned by user
  test('should return null when the comment is not on a post owned by the user', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteCommentByPostOwner({ id: 1, user_id: 999 });

    expect(result).toBeNull();
  });

  // Boundary: id = 0
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deleteCommentByPostOwner({ id: 0, user_id: 0 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "PostComments" WHERE id = $1 AND post_id IN (SELECT id FROM "Posts" WHERE user_id = $2) RETURNING *',
      [0, 0],
    );
    expect(result).toBeNull();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteCommentByPostOwner({ id: 1, user_id: 5 })).rejects.toThrow(
      'connection lost',
    );
  });
});

// ── insertCommentReport ───────────────────────────────────
describe('PostComments.model - insertCommentReport', () => {
  afterEach(() => jest.clearAllMocks());

  test('should insert a report and return it', async () => {
    const fakeReport = { id: 1, comment_id: 5, user_id: 2, reason: 'spam' };
    pool.query.mockResolvedValue({ rows: [fakeReport] });

    const result = await insertCommentReport({ comment_id: 5, user_id: 2, reason: 'spam' });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "CommentReports"'),
      [5, 2, 'spam', ''],
    );
    expect(result).toEqual(fakeReport);
  });

  test('should default description to an empty string when omitted', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 1 }] });

    await insertCommentReport({ comment_id: 5, user_id: 2, reason: 'spam' });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [5, 2, 'spam', '']);
  });

  test('should propagate duplicate-report constraint errors', async () => {
    const err = new Error('duplicate key value');
    err.code = '23505';
    pool.query.mockRejectedValue(err);

    await expect(
      insertCommentReport({ comment_id: 5, user_id: 2, reason: 'spam' }),
    ).rejects.toThrow('duplicate key value');
  });
});

// ── getAllCommentReports ──────────────────────────────────
describe('PostComments.model - getAllCommentReports', () => {
  afterEach(() => jest.clearAllMocks());

  test('should exclude dismissed reports by default', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getAllCommentReports(false);

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('WHERE (cr.dismissed IS NULL OR cr.dismissed = FALSE)'),
    );
  });

  test('should include dismissed reports when requested', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getAllCommentReports(true);

    expect(pool.query).toHaveBeenCalledWith(expect.not.stringContaining('WHERE (cr.dismissed'));
  });

  test('should return an empty array when there are no reports', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllCommentReports(false);

    expect(result).toEqual([]);
  });

  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getAllCommentReports(false)).rejects.toThrow('connection lost');
  });
});
