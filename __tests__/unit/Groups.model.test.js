const pool = require('../../src/models/db');
const {
  getAllGroups,
  getGroupsByGroupID,
  getGroupsBySchool,
  insertGroup,
  updateGroupPublicity,
  deleteGroup,
} = require('../../src/models/Groups.model');

// Mocking
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------
// Unit Test 1 - Get all groups
// ---------------------------------------------------------
describe('Groups.model - getAllGroups', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all groups from the database', async () => {
    const fakeGroups = [
      {
        id: 1,
        name: 'group1',
        creator_id: 1,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      },
      {
        id: 2,
        name: 'group2',
        creator_id: 2,
        description: 'Algorithms and data structures.',
        school: 'MAD',
        module: 'CS2040',
        public: false,
      },
    ];

    pool.query.mockResolvedValue({ rows: fakeGroups });

    const result = await getAllGroups();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups"');
    expect(result).toEqual(fakeGroups);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no groups exist', async () => {
    pool.query.mockResolvedValue({ rows: [] });

    const result = await getAllGroups();

    expect(result).toEqual([]);
  });

  // Error handling: DB connection failure propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection refused'));

    await expect(getAllGroups()).rejects.toThrow('connection refused');
  });
});

// ---------------------------------------------------------
// Unit Test 2 - Get group by id
// ---------------------------------------------------------
describe('Groups.model - getGroupsByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 group from the database', async () => {
    const fakeGroups = [
      {
        id: 1,
        name: 'group1',
        creator_id: 1,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeGroups,
    });

    const result = await getGroupsByGroupID({ group_id: 1 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE id = $1', [1]);
    expect(result).toEqual(fakeGroups);
  });

  // Boundary: group not found
  test('should return an empty array when no group exist', async () => {
    const fakeGroups = [];

    pool.query.mockResolvedValue({
      rows: fakeGroups,
    });

    const result = await getGroupsByGroupID({ group_id: 1 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE id = $1', [1]);
    expect(result).toEqual(fakeGroups);
  });

  // Boundary: id < 0 (below accepted range)
  test('should return no groups from the database', async () => {
    const fakeGroups = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get groups for id (-1)
    const result = await getGroupsByGroupID({
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE id = $1', [-1]);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getGroupsByGroupID({ group_id: 1 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 3 - Get group by school
// ---------------------------------------------------------
describe('Groups.model - getGroupsBySchool', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all groups for a school from the database', async () => {
    const fakeGroups = [
      {
        name: 'group1',
        creator_id: 1,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      },
      {
        name: 'group2',
        creator_id: 2,
        description: 'Algorithms and data structures.',
        school: 'MAD',
        module: 'CS2040',
        public: false,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeGroups,
    });

    const result = await getGroupsBySchool({
      school: 'SOC',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE school = $1', ['SOC']);
    expect(result).toEqual(fakeGroups);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 file for a group from the database', async () => {
    const fakeGroups = [
      {
        id: 1,
        name: 'group1',
        creator_id: 1,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeGroups,
    });

    const result = await getGroupsBySchool({ school: 'SOC' });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE school = $1', ['SOC']);
    expect(result).toEqual(fakeGroups);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no groups exist', async () => {
    const fakeGroups = [];

    pool.query.mockResolvedValue({
      rows: fakeGroups,
    });

    const result = await getGroupsBySchool({ school: 'SOC' });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE school = $1', ['SOC']);
    expect(result).toEqual(fakeGroups);
  });

  // Boundary: Invalid school
  test('should return no groups from the database', async () => {
    const fakeGroups = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get groups for school (invalid)
    const result = await getGroupsBySchool({
      school: 'invalid',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Groups" WHERE school = $1', [
      'invalid',
    ]);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getGroupsBySchool({ school: 'SOC' })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 4 - Create group
// ---------------------------------------------------------
describe('Groups.model - insertGroup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: Group created
  test('should insert new group to the database', async () => {
    const newFakeGroup = {
      id: 1,
      name: 'group1',
      creator_id: 1,
      description: 'General CS study group.',
      school: 'SOC',
      module: 'CS1010',
      public: true,
    };

    pool.query.mockResolvedValue({
      rows: newFakeGroup,
    });

    // Create group
    const result = await insertGroup({
      name: 'group1',
      creator_id: 1,
      description: 'General CS study group.',
      school: 'SOC',
      module: 'CS1010',
      public: true,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "Groups" (name, creator_id, description, school, module) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      ['group1', 1, 'General CS study group.', 'SOC', 'CS1010'],
    );
    expect(result).toEqual(newFakeGroup);
  });

  // Boundary: null values
  test('should not insert new group to the database', async () => {
    const newFakeGroup = {
      id: 1,
      name: 'group1',
      creator_id: 1,
      description: 'General CS study group.',
      school: 'SOC',
      module: 'CS1010',
      public: true,
    };

    pool.query.mockRejectedValue(
      new Error('null value in column "creator_id" violates not-null constraint'),
    );

    await expect(
      insertGroup({
        name: null,
        creator_id: null,
        description: null,
        school: null,
        module: null,
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroup({
        name: 'group1',
        creator_id: 1,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 5 - Update group publicity
// ---------------------------------------------------------
describe('Groups.model - updateGroupPublicity', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: group publicity updated
  test('should update groups drawing data', async () => {
    const fakeGroups = [
      {
        id: 1,
        name: 'group1',
        creator_id: 1,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      },
    ];

    pool.query.mockResolvedValue({
      rows: [fakeGroups],
    });

    const result = await updateGroupPublicity({
      group_id: 1,
      public: true,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Groups" SET public = $2 WHERE id = $1 RETURNING *',
      [1, true],
    );
    expect(result).toEqual([fakeGroups]);
  });

  // Invalid partition: Group not found
  test("should not update group's publicity in the database", async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateGroupPublicity({
      group_id: -1,
      public: true,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Groups" SET public = $2 WHERE id = $1 RETURNING *',
      [-1, true],
    );
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateGroupPublicity({
        group_id: 1,
        public: true,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 6 - Delete group
// ---------------------------------------------------------
describe('Groups.model - deleteGroup', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: deletes group
  test('should delete group from database', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          name: 'group1',
          creator_id: 2,
          description: 'General CS study group.',
          school: 'SOC',
          module: 'CS1010',
          public: true,
        },
      ],
    });

    const result = await deleteGroup({
      group_id: 1,
      creator_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Groups" WHERE id = $1 AND creator_id = $2 RETURNING *',
      [1, 2],
    );
    expect(result).toEqual([
      {
        id: 1,
        name: 'group1',
        creator_id: 2,
        description: 'General CS study group.',
        school: 'SOC',
        module: 'CS1010',
        public: true,
      },
    ]);
  });

  // Invalid partition: Group not found
  test('should not delete groups from the database (Invalid Group ID)', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteGroup({
      group_id: -1,
      creator_id: 2,
    });

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Groups" WHERE id = $1 AND creator_id = $2 RETURNING *',
      [-1, 2],
    );
  });

  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteGroup({ group_id: 1, user_id: 2 })).rejects.toThrow('connection lost');
  });
});
