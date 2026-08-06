const pool = require('../../src/models/db');
const {
  findOrCreateTag,
  getAllTags,
  // To fix linting:
  // 5:3  error  'getListingsByTag' is assigned a value but never used. Allowed unused vars must match /^_/u  no-unused-vars
  // 6:3  error  'setListingTags' is assigned a value but never used. Allowed unused vars must match /^_/u    no-unused-vars
  // getListingsByTag,
  // setListingTags,
} = require('../../src/models/Tags.model');

// ── Mocking ──────────────────────────────────────────────
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ── findOrCreateTag ─────────────────────────────────────
describe('Tags.model - findOrCreateTag', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: a new tag name is inserted and returned
  test('should normalize the tag name, insert it, and return the created row', async () => {
    const fakeRow = { id: 7, name: 'react' };
    pool.query.mockResolvedValue({ rows: [fakeRow] });

    const result = await findOrCreateTag('  React  ');

    expect(pool.query).toHaveBeenCalledWith(expect.stringContaining('INSERT INTO "Tags"'), [
      'react',
    ]);
    expect(result).toEqual(fakeRow);
  });

  // Boundary: tag name already exists
  test('should trim and lowercase the tag name before querying the database', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 2, name: 'node' }] });

    await findOrCreateTag(' Node ');

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['node']);
  });

  // Boundary: an empty string after trimming still passes through as an empty value
  test('should pass an empty normalized tag name through to the database query', async () => {
    pool.query.mockResolvedValue({ rows: [{ id: 99, name: '' }] });

    const result = await findOrCreateTag('   ');

    expect(pool.query).toHaveBeenCalledWith(expect.any(String), ['']);
    expect(result).toEqual({ id: 99, name: '' });
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection timeout'));

    await expect(findOrCreateTag('react')).rejects.toThrow('connection timeout');
  });
});

// ── getAllTags ───────────────────────────────────────────
describe('Tags.model - getAllTags', () => {
  afterEach(() => jest.clearAllMocks());

  // Valid partition: existing tags are returned in sorted order
  test('should return all tags from the database ordered by name', async () => {
    const fakeTags = [
      { id: 1, name: 'alpha' },
      { id: 2, name: 'beta' },
    ];
    pool.query.mockResolvedValue({ rows: fakeTags });

    const result = await getAllTags();

    expect(pool.query).toHaveBeenCalledWith('SELECT "id", "name" FROM "Tags" ORDER BY "name"');
    expect(result).toEqual(fakeTags);
  });

  // Boundary: no tags exist yet
  test('should return an empty array when no tags exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllTags();

    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('database unavailable'));

    await expect(getAllTags()).rejects.toThrow('database unavailable');
  });
});
