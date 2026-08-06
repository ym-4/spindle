const pool = require('../../src/models/db');
const {
  getGroupFilesByGroupID,
  insertGroupFiles,
  updateGroupFileFolderByID,
  deleteGroupFilesByID,
  getGroupFoldersByGroupID,
  insertGroupFolder,
} = require('../../src/models/GroupFiles.model');

// Mocking
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------
// Unit Test 1 - Get Files by group
// ---------------------------------------------
describe('GroupFiles.model - getGroupFilesByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all files for a group from the database', async () => {
    const fakeFiles = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'Unorganised',
      },
      {
        id: 2,
        user_id: 2,
        group_id: 5,
        name: 'file2',
        file_path: '/img2',
        folder_name: 'Notes',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFiles,
    });

    const result = await getGroupFilesByGroupID({
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupFiles" WHERE group_id = $1', [5]);
    expect(result).toEqual(fakeFiles);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 file for a group from the database', async () => {
    const fakeFiles = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'Unorganised',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFiles,
    });

    const result = await getGroupFilesByGroupID({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupFiles" WHERE group_id = $1', [5]);
    expect(result).toEqual(fakeFiles);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no files exist', async () => {
    const fakeFiles = [];

    pool.query.mockResolvedValue({
      rows: fakeFiles,
    });

    const result = await getGroupFilesByGroupID({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupFiles" WHERE group_id = $1', [5]);
    expect(result).toEqual(fakeFiles);
  });

  // Boundary: group_id < 0 (below accepted range)
  test('should return no files from the database', async () => {
    const fakeFiles = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get files for group_id (-1)
    const result = await getGroupFilesByGroupID({
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "GroupFiles" WHERE group_id = $1', [-1]);
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getGroupFilesByGroupID({ group_id: 5 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 2 - Create Files
// ---------------------------------------------
describe('GroupFiles.model - insertGroupFiles', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: File created
  test('should insert new file to the database', async () => {
    const newFakeFiles = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'Unorganised',
      },
    ];

    pool.query.mockResolvedValue({
      rows: newFakeFiles,
    });

    // Create file
    const result = await insertGroupFiles({
      user_id: 2,
      group_id: 5,
      name: 'file1',
      file_path: '/img1',
      folder_name: 'Unorganised',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupFiles" (name, user_id, group_id, file_path, folder_name) VALUES ($1, $2, $3, $4, $5) RETURNING *',
      ['file1', 2, 5, '/img1', 'Unorganised'],
    );
    expect(result).toEqual(newFakeFiles);
  });

  // Boundary: null values
  test('should not insert new file to the database', async () => {
    pool.query.mockRejectedValue(
      new Error('null value in column "user_id" violates not-null constraint'),
    );

    await expect(
      insertGroupFiles({
        user_id: null,
        group_id: null,
        name: null,
        file_path: null,
        folder_name: null,
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroupFiles({
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'Unorganised',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 3 - Update file's folder
// ---------------------------------------------
describe('GroupFiles.model - updateGroupFileFolderByID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: File updated with new folder name
  test("should update file's folder name", async () => {
    const fakeFiles = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'New',
      },
    ];

    pool.query.mockResolvedValue({
      rows: [fakeFiles],
    });

    const result = await updateGroupFileFolderByID({
      id: 1,
      folder_name: 'New',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupFiles" SET folder_name = $2 WHERE id = $1 RETURNING *',
      [1, 'New'],
    );
    expect(result).toEqual([fakeFiles]);
  });

  // Invalid partition: File not found
  test('should not update file in the database', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateGroupFileFolderByID({
      id: -1,
      folder_name: 'New',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "GroupFiles" SET folder_name = $2 WHERE id = $1 RETURNING *',
      [-1, 'New'],
    );
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateGroupFileFolderByID({
        id: 1,
        folder_name: 'new',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 4 - Delete Files
// ---------------------------------------------
describe('GroupFiles.model - deleteGroupFilesByID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: deletes file
  test('should delete file from database', async () => {
    pool.query.mockResolvedValue({
      rows: [
        {
          id: 1,
          user_id: 2,
          group_id: 5,
          name: 'file1',
          file_path: '/img1',
          folder_name: 'Unorganised',
        },
      ],
    });

    const result = await deleteGroupFilesByID({
      id: 1,
      user_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "GroupFiles" WHERE id = $1 AND user_id = $2 RETURNING *',
      [1, 2],
    );
    expect(result).toEqual([
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'Unorganised',
      },
    ]);
  });

  // Invalid partition: file not found
  test('should not delete file from the database (Invalid file ID)', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteGroupFilesByID({
      id: -1,
      user_id: 2,
    });

    expect(result).toEqual([]);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "GroupFiles" WHERE id = $1 AND user_id = $2 RETURNING *',
      [-1, 2],
    );
  });

  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(deleteGroupFilesByID({ id: 1, user_id: 2 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 5 - Get Folders by group
// ---------------------------------------------
describe('GroupFiles.model - getGroupFoldersByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple rows returned from DB
  test('should return all folders for a group from the database', async () => {
    const fakeFolders = [
      {
        id: 1,
        created_by: 2,
        group_id: 5,
        name: 'folder1',
      },
      {
        id: 2,
        created_by: 5,
        group_id: 5,
        name: 'folder2',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolders,
    });

    const result = await getGroupFoldersByGroupID({
      group_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupFolders" WHERE group_id = $1',
      [5],
    );
    expect(result).toEqual(fakeFolders);
  });

  // Valid partition: 1 row returned from DB
  test('should return 1 folder for a group from the database', async () => {
    const fakeFolders = [
      {
        id: 1,
        created_by: 2,
        group_id: 5,
        name: 'folder1',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolders,
    });

    const result = await getGroupFoldersByGroupID({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupFolders" WHERE group_id = $1',
      [5],
    );
    expect(result).toEqual(fakeFolders);
  });

  // Boundary: zero rows – empty result set
  test('should return an empty array when no folders exist', async () => {
    const fakeFolders = [];

    pool.query.mockResolvedValue({
      rows: fakeFolders,
    });

    const result = await getGroupFoldersByGroupID({ group_id: 5 });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupFolders" WHERE group_id = $1',
      [5],
    );
    expect(result).toEqual(fakeFolders);
  });

  // Boundary: group_id < 0 (below accepted range)
  test('should return no folders from the database', async () => {
    const fakeFolders = [];

    pool.query.mockResolvedValue({
      rows: [],
    });

    // Get files for group_id (-1)
    const result = await getGroupFoldersByGroupID({
      group_id: -1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "GroupFolders" WHERE group_id = $1',
      [-1],
    );
    expect(result).toEqual([]);
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getGroupFoldersByGroupID({ group_id: 5 })).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------
// Unit Test 6 - Create Folders
// ---------------------------------------------
describe('GroupFiles.model - insertGroupFolder', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: File created
  test('should insert new file to the database', async () => {
    const newFakeFolder = [
      {
        id: 1,
        user_id: 2,
        group_id: 5,
        name: 'folder1',
      },
    ];

    pool.query.mockResolvedValue({
      rows: newFakeFolder,
    });

    // Create file
    const result = await insertGroupFolder({
      user_id: 2,
      group_id: 5,
      name: 'folder1',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "GroupFolders" (name, group_id, created_by) VALUES ($1, $2, $3) RETURNING *',
      ['folder1', 5, 2],
    );
    expect(result).toEqual(newFakeFolder);
  });

  // Boundary: null values
  test('should not insert new file to the database', async () => {
    pool.query.mockRejectedValue(
      new Error('null value in column "user_id" violates not-null constraint'),
    );

    await expect(
      insertGroupFolder({
        user_id: null,
        group_id: null,
        name: null,
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling: database error propagates to the caller
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertGroupFolder({
        user_id: 2,
        group_id: 5,
        name: 'file1',
        file_path: '/img1',
        folder_name: 'Unorganised',
      }),
    ).rejects.toThrow('connection lost');
  });
});
