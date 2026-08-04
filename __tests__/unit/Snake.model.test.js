const pool = require('../../src/models/db');
const {
  upsertSnakeScore,
  getTopSnakeScores,
  getSnakeScoreByUserID,
} = require('../../src/models/Snake.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── upsertSnakeScore ─────────────────────────────────────
describe('Snake.model - upsertSnakeScore', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: a new best score is inserted/updated and returned
  test('should upsert the score and return the resulting best_score row', async () => {
    const fakeRow = { best_score: 42, is_new_best: true };
    pool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await upsertSnakeScore({ user_id: 5, score: 42 });

    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('INSERT INTO "SnakeScores"'),
      [5, 42],
    );
    expect(pool.query).toHaveBeenCalledWith(
      expect.stringContaining('ON CONFLICT (user_id)'),
      [5, 42],
    );
    expect(result).toEqual(fakeRow);
  });

  // Boundary: score = 0
  test('should pass score = 0 to the query (boundary value)', async () => {
    const fakeRow = { best_score: 0, is_new_best: true };
    pool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await upsertSnakeScore({ user_id: 5, score: 0 });

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [5, 0]);
    expect(result).toEqual(fakeRow);
  });

  // Boundary: submitted score is not an new high score
  test('should return the row as given when the submitted score is not the new best', async () => {
    const fakeRow = { best_score: 100, is_new_best: false };
    pool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await upsertSnakeScore({ user_id: 5, score: 10 });

    expect(result).toEqual(fakeRow);
  });

  // Error handling: foreign key violation (unknown user_id) propagates to the caller
  test('should propagate foreign key errors', async () => {
    pool.query.mockRejectedValue(
      new Error('insert or update on table "SnakeScores" violates foreign key constraint'),
    );

    await expect(upsertSnakeScore({ user_id: 999999, score: 10 })).rejects.toThrow('foreign key');
  });

  // Error handling: database connection loss propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(upsertSnakeScore({ user_id: 5, score: 10 })).rejects.toThrow('connection lost');
  });
});

// ── getTopSnakeScores ────────────────────────────────────
describe('Snake.model - getTopSnakeScores', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: returns the leaderboard using the default limit
  test('should return the top scores using the default limit of 10', async () => {
    const fakeRows = [
      { user_id: 1, name: 'Alice', best_score: 99 },
      { user_id: 2, name: 'Bob', best_score: 50 },
    ];
    pool.query.mockResolvedValue({ rows: fakeRows });

    const result = await getTopSnakeScores();

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('ORDER BY'), [10]);
    expect(result).toEqual(fakeRows);
  });

  // Valid partition: a custom limit is respected
  test('should pass a custom limit to the query', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await getTopSnakeScores(3);

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [3]);
  });

  // Boundary: no scores exist yet
  test('should return an empty array when no scores exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getTopSnakeScores(10);

    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection timeout'));

    await expect(getTopSnakeScores(10)).rejects.toThrow('connection timeout');
  });
});

// ── getSnakeScoreByUserID ────────────────────────────────
describe('Snake.model - getSnakeScoreByUserID', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: user has an existing best score
  test("should return the user's best score", async () => {
    pool.query.mockResolvedValue({ rows: [{ best_score: 77 }] });

    const result = await getSnakeScoreByUserID(5);

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('WHERE user_id = $1'), [5]);
    expect(result).toBe(77);
  });

  // Boundary: user has no score row yet — should default to 0, not undefined
  test('should default to 0 when the user has no score row', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getSnakeScoreByUserID(5);

    expect(result).toBe(0);
  });

  // Boundary: user_id = 0
  test('should pass user_id = 0 to the query (boundary value)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getSnakeScoreByUserID(0);

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), [0]);
    expect(result).toBe(0);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getSnakeScoreByUserID(5)).rejects.toThrow('connection lost');
  });
});
