const pool = require('../../src/models/db');
const {
  getWhiteboardsByGroupId,
  getWhiteboardsByUserId,
  getWhiteboardsById,
  insertWhiteboards,
  updateWhiteboardsData,
  deleteWhiteboards,
} = require('../../src/models/Whiteboard.model');

// Mocking
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------
// Unit Test 1 - Get Whiteboards by group
// ---------------------------------------------
describe('Whiteboard.model - getWhiteboardsByGroupId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all whiteboards for a group from the database', async () => {
    const fakeWhiteboards = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        title: 'Board 1',
        mode: 'whiteboard',
        drawing_data: {},
      },
      {
        id: 2,
        user_id: 3,
        group_id: 5,
        title: 'Board 2',
        mode: 'pixel',
        drawing_data: {},
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsByGroupId({
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE group_id = $1',
      [5],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 whiteboard for a group from the database', async () => {
    const fakeWhiteboards = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        title: 'Board 1',
        mode: 'whiteboard',
        drawing_data: {},
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsByGroupId({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE group_id = $1',
      [5],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no whiteboards exist', async () => {
    const fakeWhiteboards = [];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsByGroupId({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE group_id = $1',
      [5],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Boundary: group_id < 0 (below accepted range)
  test('should return no whiteboards from the database', async () => {
    const fakeWhiteboards = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get whiteboard for group_id (-1)
    const result = await getWhiteboardsByGroupId({
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE group_id = $1',
      [-1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getWhiteboardsByGroupId({ group_id: 5 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 2 - Get Whiteboards by user
// ---------------------------------------------
describe('Whiteboard.model - getWhiteboardsByUserId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all whiteboards for a group from the database', async () => {
    const fakeWhiteboards = [
      {
        id: 1,
        user_id: 1,
        group_id: 5,
        title: 'Board 1',
        mode: 'whiteboard',
        drawing_data: {},
      },
      {
        id: 2,
        user_id: 1,
        group_id: 4,
        title: 'Board 2',
        mode: 'pixel',
        drawing_data: {},
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsByUserId({
      user_id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE user_id = $1',
      [1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 whiteboard for a group from the database', async () => {
    const fakeWhiteboards = [
      {
        id: 1,
        user_id: 1,
        group_id: 5,
        title: 'Board 1',
        mode: 'whiteboard',
        drawing_data: {},
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsByUserId({ user_id: 1 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE user_id = $1',
      [1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no whiteboards exist', async () => {
    const fakeWhiteboards = [];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsByUserId({ user_id: 1 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE user_id = $1',
      [1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Boundary: user_id < 0 (below accepted range)
  test('should return no whiteboards from the database', async () => {
    const fakeWhiteboards = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get whiteboard for id (-1)
    const result = await getWhiteboardsByUserId({
      user_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE user_id = $1',
      [-1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getWhiteboardsByUserId({ user_id: 1 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 3 - Get whiteboard by id
// ---------------------------------------------
describe('Whiteboard.model - getWhiteboardsById', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 whiteboard for a group from the database', async () => {
    const fakeWhiteboards = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        title: 'Board 1',
        mode: 'whiteboard',
        drawing_data: {},
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsById({ id: 1 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE id = $1',
      [1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no whiteboards exist', async () => {
    const fakeWhiteboards = [];

    pool.query.mockResolvedValue({
      rows: fakeWhiteboards,
    });

    const result = await getWhiteboardsById({ id: 1 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE id = $1',
      [1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Boundary: id < 0 (below accepted range)
  test('should return no whiteboards from the database', async () => {
    const fakeWhiteboards = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get whiteboard for id (-1)
    const result = await getWhiteboardsById({
      id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "WhiteboardDrawings" WHERE id = $1',
      [-1],
    );
    expect(result).toEqual(fakeWhiteboards);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getWhiteboardsById({ id: 1 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 4 - Create Whiteboard
// ---------------------------------------------
describe('Whiteboard.model - insertWhiteboards', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Whiteboard created (whiteboard)
  test('should insert new whiteboard to the database', async () => {
    const newFakeWhiteboard = {
      id: 10,
      user_id: 1,
      group_id: 5,
      title: 'Title 1',
      mode: 'whiteboard',
      drawing_data: [],
    };

    pool.query.mockResolvedValue({
      rows: newFakeWhiteboard,
    });

    // Create whiteboard
    const result = await insertWhiteboards({
      user_id: 1,
      group_id: 5,
      title: 'Title 1',
      mode: 'whiteboard',
      drawing_data: [],
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "WhiteboardDrawings" (user_id, group_id, title, mode, drawing_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [1, 5, 'Title 1', 'whiteboard', []],
    );
    expect(result).toEqual(newFakeWhiteboard);
  });

  // Valid partition: Whiteboard created (pixel)
  test('should insert new pixel whiteboard to the database', async () => {
    const newFakeWhiteboard = {
      id: 10,
      user_id: 1,
      group_id: 5,
      title: 'Title 1',
      mode: 'pixel',
      drawing_data: [],
    };

    pool.query.mockResolvedValue({
      rows: newFakeWhiteboard,
    });

    // Create pixel whiteboard
    const result = await insertWhiteboards({
      user_id: 1,
      group_id: 5,
      title: 'Title 1',
      mode: 'pixel',
      drawing_data: [],
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "WhiteboardDrawings" (user_id, group_id, title, mode, drawing_data) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      [1, 5, 'Title 1', 'pixel', []],
    );
    expect(result).toEqual(newFakeWhiteboard);
  });

  // Boundary: null values
  test('should not insert new whiteboard to the database', async () => {
    pool.query.mockRejectedValue(
      new Error('null value in column "user_id" violates not-null constraint'),
    );

    await expect(
      insertWhiteboards({
        group_id: null,
        user_id: null,
        title: null,
        mode: null,
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertWhiteboards({
        user_id: 1,
        group_id: 5,
        title: 'Title 1',
        mode: 'pixel',
        drawing_data: [],
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 5 - Update whiteboard drawing data
// ---------------------------------------------
describe('Whiteboard.model - updateWhiteboardsData', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Whiteboard updated with new drawing data
  test('should update whiteboard drawing data', async () => {
    const fakeUpdatedWhiteboard = {
      id: 1,
      drawing_data: { shapes: [] },
    };

    pool.query.mockResolvedValue({
      rows: [fakeUpdatedWhiteboard],
    });

    const result = await updateWhiteboardsData({
      id: 1,
      drawing_data: { shapes: [] },
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "WhiteboardDrawings" SET drawing_data = $1 WHERE id = $2 RETURNING *',
      [{ shapes: [] }, 1],
    );
    expect(result).toEqual([fakeUpdatedWhiteboard]);
  });

  // Invalid partition: Whiteboard not found
  test('should not update whiteboard in the database', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateWhiteboardsData({
      id: -1,
      drawing_data: { shapes: [] },
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "WhiteboardDrawings" SET drawing_data = $1 WHERE id = $2 RETURNING *',
      [{ shapes: [] }, -1],
    );
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateWhiteboardsData({
        user_id: 1,
        group_id: 5,
        title: 1,
        mode: 'pixel',
        drawing_data: [1, 2, 3],
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 6 - Delete whiteboard
// ---------------------------------------------
describe('Whiteboard.model - deleteWhiteboards', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: deletes whiteboard
  test('should delete whiteboard from database', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          user_id: 1,
          group_id: 5,
          title: 'Title 1',
          mode: 'whiteboard',
          drawing_data: [],
        },
      ],
    });

    const result = await deleteWhiteboards({
      id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "WhiteboardDrawings" WHERE id = $1 AND user_id = $2 RETURNING *',
      [1],
    );
    expect(result).toEqual([
      { drawing_data: [], group_id: 5, id: 1, mode: 'whiteboard', title: 'Title 1', user_id: 1 },
    ]);
  });

  // Invalid partition: whiteboard not found
  test('should not delete whiteboard from the database (Invalid Whiteboard ID)', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteWhiteboards({
      id: -1,
    });

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "WhiteboardDrawings" WHERE id = $1 AND user_id = $2 RETURNING *',
      [-1],
    );
  });

  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteWhiteboards({ id: 1 })).rejects.toThrow('connection lost');
  });
});
