const pool = require('../../src/models/db');
const { searchAll } = require('../../src/models/Search.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── searchAll ─────────────────────────────────────────────
describe('Search.model - searchAll (query term handling)', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: plain keyword query is passed as $1
  test('should wrap a plain keyword query in % for ILIKE', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'react',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('p.title ILIKE $1 OR p.content ILIKE $1');
    expect(params).toEqual(['%react%']);
  });

  test('should also match posts via a tag name using the same $1 term', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'react',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('EXISTS (');
    expect(sql).toContain('FROM "PostTags" pt');
    expect(sql).toContain('JOIN "Tags" t ON t.id = pt.tag_id');
    expect(sql).toContain('t.name ILIKE $1');
    expect(params).toEqual(['%react%']);
  });

  // Valid partition: '#' prefix for a tag search
  test('should strip # from the query before building the search term', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: '#node',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['%node%']);
  });

  // Boundary: empty string query, shortest valid input
  test('should produce a "%%" search term when the query is an empty string', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({ query: '', category: null, date_from: null, date_to: null, sort: 'newest' });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['%%']);
  });

  // Boundary: query is just '#'
  test('should produce an empty search term when the query is only "#"', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({ query: '#', category: null, date_from: null, date_to: null, sort: 'newest' });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['%%']);
  });

  // Boundary: whitespace only query is treated as content
  test('should preserve whitespace only queries as it is', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: '   ',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['%   %']);
  });

  // Invalid partition: query is null
  test('should throw when query is null', async () => {
    await expect(
      searchAll({ query: null, category: null, date_from: null, date_to: null, sort: 'newest' }),
    ).rejects.toThrow();

    expect(pool.query).not.toHaveBeenCalled();
  });

  // Invalid partition: query is undefined
  test('should throw when query is undefined', async () => {
    await expect(
      searchAll({ category: null, date_from: null, date_to: null, sort: 'newest' }),
    ).rejects.toThrow();

    expect(pool.query).not.toHaveBeenCalled();
  });

  // Invalid partition: query is the wrong type (e.g. number instead of string)
  test('should throw when query is not a string', async () => {
    await expect(
      searchAll({ query: 12345, category: null, date_from: null, date_to: null, sort: 'newest' }),
    ).rejects.toThrow();

    expect(pool.query).not.toHaveBeenCalled();
  });
});

// ── searchAll (category filter) ──────────────────────────
describe('Search.model - searchAll (category filter)', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: a single category adds one placeholder after the search term
  test('should append a single category placeholder starting at $2', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: ['tech'],
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND p.category IN ($2)');
    expect(params).toEqual(['%foo%', 'tech']);
  });

  // Valid partition: multiple categories add one placeholder per category, in order
  test('should append one placeholder per category for multiple categories', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: ['tech', 'sports'],
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND p.category IN ($2, $3)');
    expect(params).toEqual(['%foo%', 'tech', 'sports']);
  });

  // Boundary: category filter appears on both the posts and the comments
  test('should apply the same category filter to both the posts and comments legs', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: ['tech'],
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql] = pool.query.mock.calls[0];
    const occurrences = sql.split('AND p.category IN ($2)').length - 1;
    expect(occurrences).toBe(2);
  });

  // Boundary: empty category array should not add a filter
  test('should skip the category filter when the category array is empty', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({ query: 'foo', category: [], date_from: null, date_to: null, sort: 'newest' });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain('p.category IN');
    expect(params).toEqual(['%foo%']);
  });

  // Boundary: category is null
  test('should skip the category filter when category is null', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).not.toContain('p.category IN');
    expect(params).toEqual(['%foo%']);
  });

  // Invalid partition: category provided as the wrong type (e.g. string instead of array)
  test('should throw when category is not an array', async () => {
    await expect(
      searchAll({ query: 'foo', category: 'tech', date_from: null, date_to: null, sort: 'newest' }),
    ).rejects.toThrow();

    expect(pool.query).not.toHaveBeenCalled();
  });
});

// ── searchAll (date filters) ─────────────────────────────
describe('Search.model - searchAll (date filters)', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: date_from only
  test('should append a date_from filter when only date_from is provided', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: '2024-01-01',
      date_to: null,
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND p.created_at  >= $2');
    expect(sql).toContain('AND pc.created_at >= $2');
    expect(params).toEqual(['%foo%', '2024-01-01']);
  });

  // Valid partition: date_to only
  test('should append a date_to filter when only date_to is provided', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: '2024-12-31',
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND p.created_at  <= $2');
    expect(sql).toContain('AND pc.created_at <= $2');
    expect(params).toEqual(['%foo%', '2024-12-31']);
  });

  // Valid partition: date_from and date_to, at $2 and $3 respectively
  test('should append date_from at $2 and date_to at $3 when both are provided', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: '2024-01-01',
      date_to: '2024-12-31',
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND p.created_at  >= $2');
    expect(sql).toContain('AND p.created_at  <= $3');
    expect(params).toEqual(['%foo%', '2024-01-01', '2024-12-31']);
  });

  // Boundary: category filter combined with date filters shifts placeholder indices correctly
  test('should shift date placeholders after category placeholders', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: ['tech'],
      date_from: '2024-01-01',
      date_to: '2024-12-31',
      sort: 'newest',
    });

    const [sql, params] = pool.query.mock.calls[0];
    expect(sql).toContain('AND p.category IN ($2)');
    expect(sql).toContain('AND p.created_at  >= $3');
    expect(sql).toContain('AND p.created_at  <= $4');
    expect(params).toEqual(['%foo%', 'tech', '2024-01-01', '2024-12-31']);
  });

  // Boundary: date_from and date_to are the same value
  test('should accept date_from equal to date_to (zero-width window)', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: '2024-06-01',
      date_to: '2024-06-01',
      sort: 'newest',
    });

    const [, params] = pool.query.mock.calls[0];
    expect(params).toEqual(['%foo%', '2024-06-01', '2024-06-01']);
  });
});

// ── searchAll (sort) ──────────────────────────────────────
describe('Search.model - searchAll (sort)', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: sort by newest
  test('should order by created_at DESC when sort is "newest"', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at DESC NULLS LAST');
  });

  // Valid partition: sort by oldest
  test('should order by created_at ASC when sort is "oldest"', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'oldest',
    });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at ASC  NULLS LAST');
  });

  // Valid partition: sort by relevance
  test('should order by created_at DESC when sort is "relevance"', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'relevance',
    });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at DESC NULLS LAST');
  });

  // Invalid partition: unrecognized sort string falls back to the default
  test('should default to created_at DESC when sort is an unrecognized value', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'banana',
    });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at DESC NULLS LAST');
  });

  // Boundary: sort is missing/undefined
  test('should default to created_at DESC when sort is missing', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    await searchAll({
      query: 'foo',
      category: null,
      date_from: null,
      date_to: null,
      sort: undefined,
    });

    const [sql] = pool.query.mock.calls[0];
    expect(sql).toContain('ORDER BY created_at DESC NULLS LAST');
  });
});

// ── searchAll (results) ──────────────────────────────────
describe('Search.model - searchAll (results)', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: rows from posts, comments, groups, users and tags are all returned
  test('should return the rows from the database unmodified', async () => {
    const fakeRows = [
      { result_type: 'post', id: 1, title: 'React tips' },
      { result_type: 'comment', id: 2, title: 'reacting to this' },
      { result_type: 'group', id: 3, title: 'React Devs' },
      { result_type: 'user', id: 4, title: 'react_lover' },
    ];
    pool.query.mockResolvedValue({ rows: fakeRows });

    const result = await searchAll({
      query: 'react',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    expect(result).toEqual(fakeRows);
  });

  // Boundary: no results
  test('should return an empty array when nothing matches', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await searchAll({
      query: 'nonexistentterm',
      category: null,
      date_from: null,
      date_to: null,
      sort: 'newest',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(result).toEqual([]);
  });
});

// ── searchAll - error handling ───────────────────────────
describe('Search.model - searchAll (error handling)', () => {
  afterEach(() => jest.clearAllMocks());

  // Error handling: connection timeout propagates to the caller
  test('should propagate a connection timeout error', async () => {
    pool.query.mockRejectedValue(new Error('connection timeout'));

    await expect(
      searchAll({ query: 'react', category: null, date_from: null, date_to: null, sort: 'newest' }),
    ).rejects.toThrow('connection timeout');
  });

  // Error handling: the connection is lost mid-query
  test('should propagate a connection-lost error', async () => {
    const err = new Error('Connection terminated unexpectedly');
    err.code = 'ECONNRESET';
    pool.query.mockRejectedValue(err);

    await expect(
      searchAll({ query: 'react', category: null, date_from: null, date_to: null, sort: 'newest' }),
    ).rejects.toThrow('Connection terminated unexpectedly');
  });

  // Error handling: a DB level constraint/type violation propagates
  test('should propagate a database constraint/type violation error', async () => {
    const err = new Error('invalid input syntax for type timestamp');
    err.code = '22007';
    pool.query.mockRejectedValue(err);

    await expect(
      searchAll({
        query: 'react',
        category: null,
        date_from: 'not-a-date',
        date_to: null,
        sort: 'newest',
      }),
    ).rejects.toThrow('invalid input syntax for type timestamp');
  });
});
