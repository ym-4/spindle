const pool = require('../../src/models/db');
const {
  getAllGroups,
  getGroupsByGroupID,
  getGroupsBySchool,
  insertGroup,
  updateGroupPublicity,
  deleteGroup,
  getGroupJoinRequestsByGroupId,
  updateGroupJoinRequest,
  insertGroupJoinRequest,
  getGroupMemberByGroupID,
  insertGroupMember,
  updateMemberRoleToAdmin,
  getAllGroupAdmin,
  deleteGroupMemberByUserId,
  getAllGroupDiscussionByGroupID,
  insertGroupDiscussion,
  updateGroupDiscussion,
  deleteGroupDiscussionByID,
  getGroupAnnouncementsByGroupID,
  insertGroupAnnouncement,
  updateGroupAnnouncement,
  deleteAnnouncementByID,
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
    expect(result).toEqual(fakeGroups);
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
  test('should return 1 group for a group from the database', async () => {
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
    expect(result).toEqual(fakeGroups);
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
  test('should update groups publicity', async () => {
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

    await expect(deleteGroup({ group_id: 1, creator_id: 2 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 7 - Get join requests by group
// ---------------------------------------------------------
describe('Groups.model - getGroupJoinRequestsByGroupId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple join requests returned from DB
  test('should return all join requests for a group', async () => {
    const fakeGroupJoinRequests = [
      {
        id: 1,
        group_id: 1,
        user_id: 2,
        status: 'pending',
      },
      {
        id: 2,
        group_id: 1,
        user_id: 3,
        status: 'pending',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeGroupJoinRequests,
    });

    const result = await getGroupJoinRequestsByGroupId({
      group_id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupJoinRequests" WHERE group_id = $1',
      [1],
    );
    expect(result).toEqual(fakeGroupJoinRequests);
  });

  // Boundary: no join requests found
  test('should return an empty array when no join requests exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getGroupJoinRequestsByGroupId({
      group_id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupJoinRequests" WHERE group_id = $1',
      [1],
    );
    expect(result).toEqual([]);
  });

  // Boundary: invalid group ID
  test('should return an empty array for an invalid group ID', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getGroupJoinRequestsByGroupId({
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupJoinRequests" WHERE group_id = $1',
      [-1],
    );
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getGroupJoinRequestsByGroupId({
        group_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 8 - Accept join requests
// ---------------------------------------------------------
describe('Groups.model - updateGroupJoinRequest (accept)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: join request accepted
  test('should accept a group join request', async () => {
    const fakeJoinRequest = [
      {
        id: 1,
        group_id: 1,
        user_id: 2,
        status: 'accepted',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeJoinRequest,
    });

    const result = await updateGroupJoinRequest({
      group_id: 1,
      user_id: 2,
      status: 'accepted',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupJoinRequests" SET status = $3 WHERE group_id = $1 AND user_id = $2 RETURNING *',
      [1, 2, 'accepted'],
    );
    expect(result).toEqual(fakeJoinRequest);
  });

  // Boundary: join request does not exist
  test('should return an empty array when join request does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateGroupJoinRequest({
      group_id: 999,
      user_id: 999,
      status: 'accepted',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateGroupJoinRequest({
        group_id: 1,
        user_id: 2,
        status: 'accepted',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 9 - Decline join requests
// ---------------------------------------------------------
describe('Groups.model - updateGroupJoinRequest (decline)', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: join request declined
  test('should decline a group join request', async () => {
    const fakeJoinRequest = [
      {
        id: 1,
        group_id: 1,
        user_id: 2,
        status: 'denied',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeJoinRequest,
    });

    const result = await updateGroupJoinRequest({
      group_id: 1,
      user_id: 2,
      status: 'denied',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupJoinRequests" SET status = $3 WHERE group_id = $1 AND user_id = $2 RETURNING *',
      [1, 2, 'denied'],
    );
    expect(result).toEqual(fakeJoinRequest);
  });

  // Boundary: join request does not exist
  test('should return an empty array when join request does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateGroupJoinRequest({
      group_id: 999,
      user_id: 999,
      status: 'denied',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateGroupJoinRequest({
        group_id: 1,
        user_id: 2,
        status: 'denied',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 10 - Create join request
// ---------------------------------------------------------
describe('Groups.model - insertGroupJoinRequest', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: join request created
  test('should create a new group join request', async () => {
    const fakeJoinRequest = [
      {
        id: 1,
        group_id: 1,
        user_id: 2,
        status: 'pending',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeJoinRequest,
    });

    const result = await insertGroupJoinRequest({
      group_id: 1,
      user_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupJoinRequests" (group_id, user_id) VALUES ($1, $2) RETURNING *',
      [1, 2],
    );
    expect(result).toEqual(fakeJoinRequest);
  });

  // Boundary: duplicate join request
  test('should reject duplicate join requests', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertGroupJoinRequest({
        group_id: 1,
        user_id: 2,
      }),
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroupJoinRequest({
        group_id: 1,
        user_id: 2,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 11 - Get group members
// ---------------------------------------------------------
describe('Groups.model - getGroupMemberByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple members
  test('should return all members of a group', async () => {
    const fakeMembers = [
      {
        group_id: 1,
        user_id: 2,
        role: 'user',
      },
      {
        group_id: 1,
        user_id: 3,
        role: 'admin',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeMembers,
    });

    const result = await getGroupMemberByGroupID({
      group_id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupMembers" WHERE group_id = $1',
      [1],
    );
    expect(result).toEqual(fakeMembers);
  });

  // Boundary: no members
  test('should return an empty array when group has no members', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getGroupMemberByGroupID({
      group_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getGroupMemberByGroupID({
        group_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 12 - Insert group member
// ---------------------------------------------------------
describe('Groups.model - insertGroupMember', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: member created
  test('should insert a new group member', async () => {
    const fakeMember = [
      {
        group_id: 1,
        user_id: 2,
        role: 'user',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeMember,
    });

    const result = await insertGroupMember({
      group_id: 1,
      user_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      `INSERT INTO "GroupMembers" (group_id, user_id, role) VALUES ($1, $2, 'user') RETURNING *`,
      [1, 2],
    );
    expect(result).toEqual(fakeMember);
  });

  // Boundary: duplicate membership
  test('should reject duplicate group membership', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertGroupMember({
        group_id: 1,
        user_id: 2,
      }),
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroupMember({
        group_id: 1,
        user_id: 2,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 13 - Update member role
// ---------------------------------------------------------
describe('Groups.model - updateMemberRoleToAdmin', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: user promoted to admin
  test('should promote a member to admin', async () => {
    const fakeMember = [
      {
        group_id: 1,
        user_id: 2,
        role: 'admin',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeMember,
    });

    const result = await updateMemberRoleToAdmin({
      group_id: 1,
      user_being_promoted_user_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      `UPDATE "GroupMembers" SET role = 'admin' WHERE group_id = $1 AND user_id = $2 RETURNING *`,
      [1, 2],
    );
    expect(result).toEqual(fakeMember);
  });

  // Boundary: member not found
  test('should return an empty array when member does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateMemberRoleToAdmin({
      group_id: 999,
      user_being_promoted_user_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateMemberRoleToAdmin({
        group_id: 1,
        user_being_promoted_user_id: 2,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 14 - Get group admin
// ---------------------------------------------------------
describe('Groups.model - getAllGroupAdmin', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple admins
  test('should return all admins in a group', async () => {
    const fakeAdmins = [
      {
        group_id: 1,
        user_id: 2,
        role: 'admin',
      },
      {
        group_id: 1,
        user_id: 3,
        role: 'admin',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeAdmins,
    });

    const result = await getAllGroupAdmin({
      group_id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      `SELECT * FROM "GroupMembers" WHERE group_id = $1 AND role = 'admin'`,
      [1],
    );
    expect(result).toEqual(fakeAdmins);
  });

  // Boundary: no admins
  test('should return an empty array when group has no admins', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getAllGroupAdmin({
      group_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getAllGroupAdmin({
        group_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 15 - Delete membership
// ---------------------------------------------------------
describe('Groups.model - deleteGroupMemberByUserId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: member deleted
  test('should delete a member from a group', async () => {
    const fakeMember = [
      {
        group_id: 1,
        user_id: 2,
        role: 'user',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeMember,
    });

    const result = await deleteGroupMemberByUserId({
      group_id: 1,
      user_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      `DELETE FROM "GroupMembers" WHERE group_id = $1 AND user_id = $2 RETURNING *`,
      [1, 2],
    );
    expect(result).toEqual(fakeMember);
  });

  // Boundary: member not found
  test('should return an empty array when member does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteGroupMemberByUserId({
      group_id: 999,
      user_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      deleteGroupMemberByUserId({
        group_id: 1,
        user_id: 2,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 16 - Get group message by group
// ---------------------------------------------------------
describe('getAllGroupDiscussionByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple messages
  test('should return all group messages for a group', async () => {
    const mockRows = [
      {
        id: 1,
        group_id: 10,
        user_id: 5,
        channel_name: 'general',
        message: 'Hello group!',
      },
      {
        id: 2,
        group_id: 10,
        user_id: 6,
        channel_name: 'general',
        message: 'Hello!',
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await getAllGroupDiscussionByGroupID({
      group_id: 10,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupDiscussions" WHERE group_id = $1 ORDER BY created_at ASC',
      [10],
    );

    expect(result).toEqual(mockRows);
  });

  // Boundary: no messages
  test('should return an empty array when no messages are found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await getAllGroupDiscussionByGroupID({
      group_id: 10,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getAllGroupDiscussionByGroupID({
        group_id: 10,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 17 - Create group message
// ---------------------------------------------------------
describe('insertGroupDiscussion', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: message created
  test('should create a new group message', async () => {
    const mockRows = [
      {
        id: 1,
        group_id: 10,
        user_id: 5,
        message: 'This is a new message',
        channel_name: 'general',
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await insertGroupDiscussion({
      group_id: 10,
      user_id: 5,
      message: 'This is a new message',
      channel_name: 'general',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupDiscussions" (group_id, user_id, message, channel_name) VALUES ($1, $2, $3, $4) RETURNING *',
      [10, 5, 'This is a new message', 'general'],
    );

    expect(result).toEqual(mockRows);
  });

  // Invalid partition: message not created

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroupDiscussion({
        group_id: 10,
        user_id: 5,
        message: 'This is a new message',
        channel_name: 'general',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 18 - Update group message
// ---------------------------------------------------------
describe('updateGroupDiscussion', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: updates message
  test('should update an existing group message', async () => {
    const mockRows = [
      {
        id: 1,
        group_id: 10,
        user_id: 5,
        message: 'Updated message',
        channel_name: 'general',
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await updateGroupDiscussion({
      id: 1,
      message: 'Updated message',
    });

    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupDiscussions" SET message = $2 WHERE id = $1 RETURNING *',
      [1, 'Updated message'],
    );

    expect(result).toEqual(mockRows);
  });

  // Invalid partition: message does not exist
  test('should return an empty array when the message does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await updateGroupDiscussion({
      id: 999,
      message: 'Updated message',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateGroupDiscussion({
        id: 1,
        message: 'Updated message',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 19 - Delete group message
// ---------------------------------------------------------
describe('deleteGroupDiscussionByID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: deletes message
  test('should delete a group message belonging to the user', async () => {
    const mockRows = [
      {
        id: 1,
        group_id: 10,
        user_id: 5,
        message: 'Message to delete',
        channel_name: 'general',
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: mockRows });

    const result = await deleteGroupDiscussionByID({
      id: 1,
      user_id: 5,
    });

    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "GroupDiscussions" WHERE id = $1 AND user_id = $2 RETURNING *',
      [1, 5],
    );

    expect(result).toEqual(mockRows);
  });

  // Invalid partition: message does not belong to user
  test('should return an empty array when the message does not belong to the user', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] });

    const result = await deleteGroupDiscussionByID({
      id: 1,
      user_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      deleteGroupDiscussionByID({
        id: 1,
        user_id: 5,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 20 - Get group announcements
// ---------------------------------------------------------
describe('getGroupAnnouncementsByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple announcements
  test('should return all announcements for a group', async () => {
    const mockRows = [
      {
        announcement_id: 1,
        group_id: 10,
        user_id: 5,
        text: 'Group meeting tomorrow',
      },
      {
        announcement_id: 2,
        group_id: 10,
        user_id: 6,
        text: 'Assignment deadline is Friday',
      },
    ];

    // First query is ensureGroupAnnouncementsTable()
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: mockRows });

    const result = await getGroupAnnouncementsByGroupID({
      group_id: 10,
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "GroupAnnouncements"'),
    );

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'SELECT * FROM "GroupAnnouncements" WHERE group_id = $1',
      [10],
    );

    expect(result).toEqual(mockRows);
  });

  // Boundary: no announcements
  test('should return an empty array when no announcements are found', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    const result = await getGroupAnnouncementsByGroupID({
      group_id: 10,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getGroupAnnouncementsByGroupID({
        group_id: 10,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 21 - Create group announcements
// ---------------------------------------------------------
describe('insertGroupAnnouncement', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: creates announcement
  test('should create a new group announcement', async () => {
    const mockRows = [
      {
        announcement_id: 1,
        group_id: 10,
        user_id: 5,
        text: 'Important group announcement',
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: mockRows });

    const result = await insertGroupAnnouncement({
      group_id: 10,
      user_id: 5,
      text: 'Important group announcement',
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "GroupAnnouncements"'),
    );

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'INSERT INTO "GroupAnnouncements" (group_id, user_id, text) VALUES ($1, $2, $3) RETURNING *',
      [10, 5, 'Important group announcement'],
    );

    expect(result).toEqual(mockRows);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroupAnnouncement({
        group_id: 10,
        user_id: 5,
        text: 'Important group announcement',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 22 - Update group announcements
// ---------------------------------------------------------
describe('updateGroupAnnouncement', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: updates announcement
  test('should update an existing group announcement', async () => {
    const mockRows = [
      {
        announcement_id: 1,
        group_id: 10,
        user_id: 5,
        text: 'Updated group announcement',
      },
    ];

    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: mockRows });

    const result = await updateGroupAnnouncement({
      announcement_id: 1,
      text: 'Updated group announcement',
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "GroupAnnouncements"'),
    );

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'UPDATE "GroupAnnouncements" SET text = $1 WHERE announcement_id = $2 RETURNING *',
      ['Updated group announcement', 1],
    );

    expect(result).toEqual(mockRows);
  });

  // Invalid partition: announcement not found
  test('should return an empty array when the announcement does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    const result = await updateGroupAnnouncement({
      announcement_id: 999,
      text: 'Updated group announcement',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      updateGroupAnnouncement({
        announcement_id: 1,
        text: 'Updated group announcement',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 23 - Delete group announcements
// ---------------------------------------------------------
describe('deleteAnnouncementByID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: deletes announcement
  test('should delete a group announcement by ID', async () => {
    const mockRows = [
      {
        announcement_id: 1,
        group_id: 10,
        user_id: 5,
        text: 'Announcement to delete',
      },
    ];

    // First query is ensureGroupAnnouncementsTable()
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: mockRows });

    const result = await deleteAnnouncementByID({
      announcement_id: 1,
    });

    expect(pool.query).toHaveBeenNthCalledWith(
      1,
      expect.stringContaining('CREATE TABLE IF NOT EXISTS "GroupAnnouncements"'),
    );

    expect(pool.query).toHaveBeenNthCalledWith(
      2,
      'DELETE FROM "GroupAnnouncements" WHERE announcement_id = $1 RETURNING *',
      [1],
    );

    expect(result).toEqual(mockRows);
  });

  // Invalid partition: announcement not found
  test('should return an empty array when the announcement does not exist', async () => {
    pool.query.mockResolvedValueOnce({ rows: [] }).mockResolvedValueOnce({ rows: [] });

    const result = await deleteAnnouncementByID({
      announcement_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query
      .mockResolvedValueOnce({ rows: [] })
      .mockRejectedValueOnce(new Error('connection lost'));

    await expect(
      deleteAnnouncementByID({
        announcement_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});
