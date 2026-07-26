const pool = require('../../src/models/db');
const {
  getAllPost,
  getPostByID,
  getPostByCategory,
  insertPost,
  updatePostByID,
  deletePostByID,
  insertPoll,
  insertPollOption,
  updatePollQuestion,
  getPollByPostID,
  insertPollVote,
  getSavedByUserID,
  insertSaved,
  getReactionByUserID,
  insertLike,
  updateReaction,
} = require('../../src/models/Posts.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

beforeEach(() => {
  pool.query.mockClear();
});

afterAll(() => {
  jest.restoreAllMocks();
});

// ── getAllPost ───────────────────────────────────────────
describe('Posts.model - getAllPost', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: multiple posts returned from the database
  test('should return all posts', async () => {
    const fakePosts = [
      {
        id: 1,
        title: 'First Post',
        category: 'general',
      },
      {
        id: 2,
        title: 'Second Post',
        category: 'confession',
      },
    ];

    pool.query.mockResolvedValue({ rows: fakePosts });

    const result = await getAllPost();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('SELECT'));
    expect(result).toEqual(fakePosts);
  });

  // Boundary: zero rows returned from the database
  test('should return an empty array when no posts exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllPost();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection timeout'));

    await expect(getAllPost()).rejects.toThrow('connection timeout');
  });
});

// ── getPostByID ──────────────────────────────────────────
describe('Posts.model - getPostByID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: existing post id returns the matching post
  test('should return the requested post', async () => {
    const fakePost = {
      id: 1,
      title: 'Test Post',
      category: 'general',
    };

    pool.query.mockResolvedValue({ rows: [fakePost] });

    const result = await getPostByID({ id: 1 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.id = $1'), [1]);
    expect(result).toEqual(fakePost);
  });

  // Boundary: non-existent id returns undefined
  test('should return undefined when post id does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getPostByID({ id: 999 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.id = $1'), [999]);
    expect(result).toBeUndefined();
  });

  // Boundary: id = 0 is below the normal valid range
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getPostByID({ id: 0 });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.id = $1'), [0]);
    expect(result).toBeUndefined();
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getPostByID({ id: 1 })).rejects.toThrow('connection lost');
  });
});

// ── getPostByCategory ────────────────────────────────────
describe('Posts.model - getPostByCategory', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: existing category returns matching posts
  test('should return all posts in the specified category', async () => {
    const fakePosts = [
      {
        id: 1,
        title: 'General Post',
        category: 'general',
      },
      {
        id: 2,
        title: 'Another General Post',
        category: 'general',
      },
    ];

    pool.query.mockResolvedValue({ rows: fakePosts });

    const result = await getPostByCategory({ category: 'general' });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.category = $1'), [
      'general',
    ]);
    expect(result).toEqual(fakePosts);
  });

  // Valid partition: category alias "q&a" is mapped to "qna"
  test('should map "q&a" to "qna" before querying the database', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getPostByCategory({ category: 'q&a' });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.category = $1'), [
      'qna',
    ]);
  });

  // Boundary: no posts exist in the specified category
  test('should return an empty array when no posts exist for the category', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getPostByCategory({ category: 'events' });

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE p.category = $1'), [
      'events',
    ]);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('database connection failed'));

    await expect(getPostByCategory({ category: 'general' })).rejects.toThrow(
      'database connection failed',
    );
  });
});

// ── insertPost ───────────────────────────────────────────
describe('Posts.model - insertPost', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a post with all fields provided
  test('should insert a post and return the created post id', async () => {
    const fakePost = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakePost] });

    const postData = {
      user_id: 1,
      title: 'Test Post',
      category: 'general',
      content: 'This is a test post.',
      attachment_url: 'attachment.png',
      gif_url: 'gif.gif',
      is_anonymous: false,
      visibility: 'everyone',
      pinned: false,
    };

    const result = await insertPost(postData);

    expect(pool.query).toHaveBeenCalledWith(
      `INSERT INTO "Posts" (user_id, title, category, content, attachment_url, gif_url, is_anonymous, visibility, pinned) 
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [
        1,
        'Test Post',
        'general',
        'This is a test post.',
        'attachment.png',
        'gif.gif',
        false,
        'everyone',
        false,
      ],
    );

    expect(result).toEqual(fakePost);
  });

  // Boundary: optional fields omitted - defaults should be used
  test('should use default visibility and pinned values when omitted', async () => {
    const fakePost = { id: 2 };
    pool.query.mockResolvedValue({ rows: [fakePost] });

    const postData = {
      user_id: 2,
      title: 'Default Values',
      category: 'confession',
      content: 'Testing defaults',
      attachment_url: null,
      gif_url: null,
      is_anonymous: true,
    };

    const result = await insertPost(postData);

    expect(pool.query).toHaveBeenCalledWith(
      `INSERT INTO "Posts" (user_id, title, category, content, attachment_url, gif_url, is_anonymous, visibility, pinned) 
  VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING id`,
      [2, 'Default Values', 'confession', 'Testing defaults', null, null, true, 'everyone', false],
    );

    expect(result).toEqual(fakePost);
  });

  // Boundary: empty title is passed directly to the query
  test('should pass an empty title to the query (boundary – shortest valid input)', async () => {
    const fakePost = { id: 3 };
    pool.query.mockResolvedValue({ rows: [fakePost] });

    await insertPost({
      user_id: 1,
      title: '',
      category: 'general',
      content: 'Content',
      attachment_url: null,
      gif_url: null,
      is_anonymous: false,
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      1,
      '',
      'general',
      'Content',
      null,
      null,
      false,
      'everyone',
      false,
    ]);
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "Posts" violates foreign key constraint'),
    );

    await expect(
      insertPost({
        user_id: 999,
        title: 'Test',
        category: 'general',
        content: 'Content',
        attachment_url: null,
        gif_url: null,
        is_anonymous: false,
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertPost({
        user_id: 1,
        title: 'Test',
        category: 'general',
        content: 'Content',
        attachment_url: null,
        gif_url: null,
        is_anonymous: false,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── updatePostByID ───────────────────────────────────────
describe('Posts.model - updatePostByID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: update a post with valid values
  test('should update a post and return the updated row', async () => {
    const updatedPost = {
      id: 1,
      title: 'Updated Title',
      content: 'Updated content',
      category: 'general',
    };

    pool.query.mockResolvedValue({ rows: [updatedPost] });

    const result = await updatePostByID({
      id: 1,
      title: 'Updated Title',
      content: 'Updated content',
      category: 'general',
      attachment_url: 'image.png',
      gif_url: 'gif.gif',
      visibility: 'everyone',
    });

    expect(pool.query).toHaveBeenCalledWith(
      `UPDATE "Posts" SET "title" = $1, "content" = $2, "category" = $3, "attachment_url" = $4, "gif_url" = $5, "visibility" = $6, "updated_at" = CURRENT_TIMESTAMP 
     WHERE "id" = $7 RETURNING *`,
      ['Updated Title', 'Updated content', 'general', 'image.png', 'gif.gif', 'everyone', 1],
    );

    expect(result).toEqual(updatedPost);
  });

  // Valid partition: verify parameterised SQL structure
  test('should execute a parameterised update query', async () => {
    const updatedPost = { id: 1 };

    pool.query.mockResolvedValue({ rows: [updatedPost] });

    await updatePostByID({
      id: 1,
      title: 'Title',
      content: 'Content',
      category: 'general',
      attachment_url: null,
      gif_url: null,
      visibility: 'friends',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];

    expect(sql).toContain('UPDATE "Posts" SET');
    expect(sql).toContain('RETURNING *');
    expect(params).toContain(1);
  });

  // Boundary: default visibility is used
  test('should use default visibility when visibility is not provided', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await updatePostByID({
      id: 1,
      title: 'Updated',
      content: 'Updated',
      category: 'general',
      attachment_url: null,
      gif_url: null,
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'Updated',
      'Updated',
      'general',
      null,
      null,
      'everyone',
      1,
    ]);
  });

  // Boundary: non-existent id returns undefined
  test('should return undefined when id does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updatePostByID({
      id: 999,
      title: 'Ghost',
      content: 'Ghost',
      category: 'general',
      attachment_url: null,
      gif_url: null,
      visibility: 'everyone',
    });

    expect(result).toBeUndefined();
  });

  // Boundary: id = 0 is technically valid input – tests edge of numeric range
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updatePostByID({
      id: 0,
      title: 'Test',
      content: 'Content',
      category: 'general',
      attachment_url: null,
      gif_url: null,
      visibility: 'everyone',
    });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [
      'Test',
      'Content',
      'general',
      null,
      null,
      'everyone',
      0,
    ]);

    expect(result).toBeUndefined();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('syntax error'));

    await expect(
      updatePostByID({
        id: 1,
        title: 'Bad',
        content: 'Bad',
        category: 'general',
        attachment_url: null,
        gif_url: null,
        visibility: 'everyone',
      }),
    ).rejects.toThrow('syntax error');
  });
});

// ── deletePostByID ───────────────────────────────────────
describe('Posts.model - deletePostByID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: delete an existing post and return the deleted row
  test('should delete a post and return the deleted post', async () => {
    const deletedPost = {
      id: 3,
      title: 'Deleted Post',
      category: 'general',
    };

    pool.query.mockResolvedValue({ rows: [deletedPost] });

    const result = await deletePostByID({ id: 3 });

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM "Posts" WHERE "id" = $1 RETURNING *', [3]);
    expect(result).toEqual(deletedPost);
  });

  // Boundary: non-existent id returns undefined
  test('should return undefined when id does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deletePostByID({ id: 999 });

    expect(result).toBeUndefined();
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deletePostByID({ id: 1 })).rejects.toThrow('connection lost');
  });

  // Boundary: id = 0 is below the valid range
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deletePostByID({ id: 0 });

    expect(pool.query).toHaveBeenCalledWith('DELETE FROM "Posts" WHERE "id" = $1 RETURNING *', [0]);
    expect(result).toBeUndefined();
  });

  // Boundary: negative id – below the valid range
  test('should pass negative id to the query (boundary – below valid range)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await deletePostByID({ id: -1 });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Posts" WHERE "id" = $1 RETURNING *',
      [-1],
    );
    expect(result).toBeUndefined();
  });
});

// =========================
// Polls
// =========================
// ── insertPoll ───────────────────────────────────────────
describe('Posts.model - insertPoll', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a poll and return the created poll id
  test('should insert a poll and return the created poll id', async () => {
    const fakePoll = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakePoll] });

    const result = await insertPoll({
      post_id: 5,
      question: 'What is your favourite programming language?',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PostPolls" (post_id, question) VALUES ($1, $2) RETURNING id',
      [5, 'What is your favourite programming language?'],
    );
    expect(result).toEqual(fakePoll);
  });

  // Boundary: empty question is passed to query
  test('should pass an empty question to the query (boundary – shortest valid input)', async () => {
    const fakePoll = { id: 2 };
    pool.query.mockResolvedValue({ rows: [fakePoll] });

    const result = await insertPoll({
      post_id: 1,
      question: '',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PostPolls" (post_id, question) VALUES ($1, $2) RETURNING id',
      [1, ''],
    );
    expect(result).toEqual(fakePoll);
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "PostPolls" violates foreign key constraint'),
    );

    await expect(
      insertPoll({
        post_id: 999,
        question: 'Favourite language?',
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertPoll({
        post_id: 1,
        question: 'Favourite language?',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── insertPollOption ─────────────────────────────────────
describe('Posts.model - insertPollOption', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a poll option and return the created option id
  test('should insert a poll option and return the created option id', async () => {
    const fakeOption = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakeOption] });

    const result = await insertPollOption({
      poll_id: 10,
      option_text: 'JavaScript',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, $2) RETURNING id',
      [10, 'JavaScript'],
    );
    expect(result).toEqual(fakeOption);
  });

  // Boundary: empty option text is passed to query
  test('should pass an empty option text to the query (boundary – shortest valid input)', async () => {
    const fakeOption = { id: 2 };
    pool.query.mockResolvedValue({ rows: [fakeOption] });

    const result = await insertPollOption({
      poll_id: 5,
      option_text: '',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PollOptions" (poll_id, option_text) VALUES ($1, $2) RETURNING id',
      [5, ''],
    );
    expect(result).toEqual(fakeOption);
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "PollOptions" violates foreign key constraint'),
    );

    await expect(
      insertPollOption({
        poll_id: 999,
        option_text: 'Python',
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertPollOption({
        poll_id: 1,
        option_text: 'Java',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── updatePollQuestion ───────────────────────────────────
describe('Posts.model - updatePollQuestion', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: update a poll question and return the updated poll
  test('should update the poll question and return the updated poll', async () => {
    const updatedPoll = {
      id: 1,
      post_id: 5,
      question: 'Updated question?',
    };

    pool.query.mockResolvedValue({ rows: [updatedPoll] });

    const result = await updatePollQuestion({
      post_id: 5,
      question: 'Updated question?',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostPolls" SET question = $1 WHERE post_id = $2 RETURNING *',
      ['Updated question?', 5],
    );

    expect(result).toEqual(updatedPoll);
  });

  // Boundary: empty question is passed to query
  test('should pass an empty question to the query (boundary – shortest valid input)', async () => {
    const updatedPoll = {
      id: 1,
      post_id: 5,
      question: '',
    };

    pool.query.mockResolvedValue({ rows: [updatedPoll] });

    const result = await updatePollQuestion({
      post_id: 5,
      question: '',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostPolls" SET question = $1 WHERE post_id = $2 RETURNING *',
      ['', 5],
    );

    expect(result).toEqual(updatedPoll);
  });

  // Boundary: non-existent post id returns null
  test('should return null when post id does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updatePollQuestion({
      post_id: 999,
      question: 'Updated question',
    });

    expect(result).toBeNull();
  });

  // Boundary: post_id = 0 is below the valid range
  test('should pass post_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updatePollQuestion({
      post_id: 0,
      question: 'Test',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostPolls" SET question = $1 WHERE post_id = $2 RETURNING *',
      ['Test', 0],
    );

    expect(result).toBeNull();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updatePollQuestion({
        post_id: 1,
        question: 'Updated question',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── getPollByPostID ──────────────────────────────────────
describe('Posts.model - getPollByPostID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: poll exists with multiple options
  test('should return a poll with its options and vote counts', async () => {
    const poll = {
      id: 1,
      post_id: 5,
      question: 'Favourite language?',
    };

    const options = [
      {
        id: 1,
        option_text: 'JavaScript',
        vote_count: 4,
      },
      {
        id: 2,
        option_text: 'Python',
        vote_count: 7,
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: [poll] }).mockResolvedValueOnce({ rows: options });

    const result = await getPollByPostID({
      post_id: 5,
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      'SELECT * FROM "PostPolls" WHERE post_id = $1',
      [5],
    );

    expect(pool.query).toHaveBeenNthCalledWith(2, expect.stringContaining('SELECT'), [1]);

    expect(result).toEqual({
      ...poll,
      options,
    });
  });

  // Boundary: poll exists but has no options
  test('should return a poll with an empty options array', async () => {
    const poll = {
      id: 2,
      post_id: 8,
      question: 'Empty poll',
    };

    pool.query.mockResolvedValueOnce({ rows: [poll] }).mockResolvedValueOnce({ rows: [] });

    const result = await getPollByPostID({
      post_id: 8,
    });

    expect(result).toEqual({
      ...poll,
      options: [],
    });
  });

  // Boundary: poll does not exist
  test('should return null when no poll exists for the given post id', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getPollByPostID({
      post_id: 999,
    });

    expect(result).toBeNull();

    expect(pool.query).toHaveBeenCalledTimes(1);
  });

  // Boundary: post_id = 0
  test('should pass post_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getPollByPostID({
      post_id: 0,
    });

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "PostPolls" WHERE post_id = $1', [0]);

    expect(result).toBeNull();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getPollByPostID({
        post_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── insertPollVote ───────────────────────────────────────
describe('Posts.model - insertPollVote', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a vote and return the created vote
  test('should insert a poll vote and return the created vote', async () => {
    const fakeVote = {
      id: 1,
      poll_id: 2,
      option_id: 5,
      user_id: 10,
    };

    pool.query.mockResolvedValue({ rows: [fakeVote] });

    const result = await insertPollVote({
      poll_id: 2,
      option_id: 5,
      user_id: 10,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PollVotes" (poll_id, option_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [2, 5, 10],
    );

    expect(result).toEqual(fakeVote);
  });

  // Boundary: id values = 0 are passed to query
  test('should pass id values of 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await insertPollVote({
      poll_id: 0,
      option_id: 0,
      user_id: 0,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PollVotes" (poll_id, option_id, user_id) VALUES ($1, $2, $3) RETURNING *',
      [0, 0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: duplicate vote violates the UNIQUE constraint
  test('should propagate unique constraint errors when a user votes twice', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertPollVote({
        poll_id: 1,
        option_id: 2,
        user_id: 3,
      }),
    ).rejects.toThrow('unique constraint');
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "PollVotes" violates foreign key constraint'),
    );

    await expect(
      insertPollVote({
        poll_id: 999,
        option_id: 999,
        user_id: 999,
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertPollVote({
        poll_id: 1,
        option_id: 2,
        user_id: 3,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// =========================
// Saves
// =========================
// ── getSavedByUserID ─────────────────────────────────────
describe('Posts.model - getSavedByUserID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: user has multiple saved posts
  test('should return all saved posts for a user', async () => {
    const savedPosts = [
      { id: 1, user_id: 5, post_id: 10 },
      { id: 2, user_id: 5, post_id: 15 },
    ];

    pool.query.mockResolvedValue({ rows: savedPosts });

    const result = await getSavedByUserID({
      user_id: 5,
    });

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "SavedPosts" WHERE user_id = $1', [5]);

    expect(result).toEqual(savedPosts);
  });

  // Boundary: user has no saved posts
  test('should return an empty array when the user has no saved posts', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getSavedByUserID({
      user_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getSavedByUserID({
      user_id: 0,
    });

    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "SavedPosts" WHERE user_id = $1', [0]);

    expect(result).toEqual([]);
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getSavedByUserID({
        user_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── insertSaved ──────────────────────────────────────────
describe('Posts.model - insertSaved', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: create a saved post and return the created save id
  test('should insert a saved post and return the created save id', async () => {
    const fakeSave = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakeSave] });

    const result = await insertSaved({
      user_id: 5,
      post_id: 10,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2) RETURNING id',
      [5, 10],
    );

    expect(result).toEqual(fakeSave);
  });

  // Boundary: id values = 0 are passed to query
  test('should pass id values of 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await insertSaved({
      user_id: 0,
      post_id: 0,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "SavedPosts" (user_id, post_id) VALUES ($1, $2) RETURNING id',
      [0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: duplicate save violates the UNIQUE constraint
  test('should propagate unique constraint errors when a post is saved twice', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertSaved({
        user_id: 5,
        post_id: 10,
      }),
    ).rejects.toThrow('unique constraint');
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "SavedPosts" violates foreign key constraint'),
    );

    await expect(
      insertSaved({
        user_id: 999,
        post_id: 999,
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertSaved({
        user_id: 5,
        post_id: 10,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// =========================
// Reactions
// =========================
// ── getReactionByUserID ──────────────────────────────────
describe('Posts.model - getReactionByUserID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: user has multiple reactions
  test('should return all reactions for a user', async () => {
    const reactions = [
      {
        id: 1,
        post_id: 10,
        user_id: 5,
        reaction_type: 'like',
      },
      {
        id: 2,
        post_id: 15,
        user_id: 5,
        reaction_type: 'dislike',
      },
    ];

    pool.query.mockResolvedValue({ rows: reactions });

    const result = await getReactionByUserID({
      user_id: 5,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "PostReactions" where user_id = $1',
      [5],
    );

    expect(result).toEqual(reactions);
  });

  // Boundary: user has no reactions
  test('should return an empty array when the user has no reactions', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getReactionByUserID({
      user_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getReactionByUserID({
      user_id: 0,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "PostReactions" where user_id = $1',
      [0],
    );

    expect(result).toEqual([]);
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getReactionByUserID({
        user_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── insertLike ───────────────────────────────────────────
describe('Posts.model - insertLike', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: insert a reaction and return the created reaction id
  test('should insert a reaction and return the created reaction id', async () => {
    const fakeReaction = { id: 1 };
    pool.query.mockResolvedValue({ rows: [fakeReaction] });

    const result = await insertLike({
      post_id: 10,
      user_id: 5,
      reaction_type: 'like',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id',
      [10, 5, 'like'],
    );

    expect(result).toEqual(fakeReaction);
  });

  // Boundary: id values = 0 are passed to query
  test('should pass id values of 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await insertLike({
      post_id: 0,
      user_id: 0,
      reaction_type: 'dislike',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "PostReactions" (post_id, user_id, reaction_type) VALUES ($1, $2, $3) RETURNING id',
      [0, 0, 'dislike'],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: duplicate reaction violates the UNIQUE constraint
  test('should propagate unique constraint errors when a user reacts to the same post twice', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertLike({
        post_id: 10,
        user_id: 5,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('unique constraint');
  });

  // Error handling: foreign key violation propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "PostReactions" violates foreign key constraint'),
    );

    await expect(
      insertLike({
        post_id: 999,
        user_id: 999,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertLike({
        post_id: 10,
        user_id: 5,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ── updateReaction ───────────────────────────────────────
describe('Posts.model - updateReaction', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: update a reaction and return the updated reaction
  test('should update the reaction type and return the updated reaction', async () => {
    const updatedReaction = {
      id: 1,
      post_id: 10,
      user_id: 5,
      reaction_type: 'dislike',
    };

    pool.query.mockResolvedValue({ rows: [updatedReaction] });

    const result = await updateReaction({
      id: 1,
      user_id: 5,
      reaction_type: 'dislike',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 and "id" = $3 RETURNING *',
      ['dislike', 5, 1],
    );

    expect(result).toEqual(updatedReaction);
  });

  // Valid partition: verify parameterised SQL structure
  test('should execute a parameterised update query', async () => {
    const updatedReaction = { id: 1 };

    pool.query.mockResolvedValue({ rows: [updatedReaction] });

    await updateReaction({
      id: 1,
      user_id: 5,
      reaction_type: 'like',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);

    const [sql, params] = pool.query.mock.calls[0];

    expect(sql).toContain('UPDATE "PostReactions" SET');
    expect(sql).toContain('RETURNING *');
    expect(params).toEqual(['like', 5, 1]);
  });

  // Boundary: non-existent reaction returns undefined
  test('should return undefined when the reaction does not exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateReaction({
      id: 999,
      user_id: 5,
      reaction_type: 'like',
    });

    expect(result).toBeUndefined();
  });

  // Boundary: id = 0 is passed to query
  test('should pass id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await updateReaction({
      id: 0,
      user_id: 0,
      reaction_type: 'dislike',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "PostReactions" SET "reaction_type" = $1 WHERE "user_id" = $2 and "id" = $3 RETURNING *',
      ['dislike', 0, 0],
    );

    expect(result).toBeUndefined();
  });

  // Error handling: database errors propagate to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateReaction({
        id: 1,
        user_id: 5,
        reaction_type: 'like',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// reports model wip
