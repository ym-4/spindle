const pool = require('../../src/models/db');
const {
  getNotesByGroupID,
  insertNote,
  updateNoteContent,
  updateNote,
  deleteNote,
  getNoteFoldersByGroupID,
  insertNoteFolder,
  updateFolderColor,
  updateFolderName,
  updateFolderIcon,
  deleteNoteFolder,
  getAllNoteLinks,
  getNoteLinksBySourceNoteId,
  getNoteLinksByTargetNoteId,
  insertNoteLinks,
  deleteNoteLinks,
} = require('../../src/models/Notes.model');

// Mocking
jest.mock('../../src/models/db', () => ({
  query: jest.fn(),
  end: jest.fn(),
}));

afterAll(() => {
  jest.restoreAllMocks();
});

// ---------------------------------------------------------
// Unit Test 1 - Get notes by group
// ---------------------------------------------------------
describe('Notes.model - getNotesByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple notes returned from DB
  test('should return all notes for a group', async () => {
    const fakeNotes = [
      {
        id: 1,
        user_id: 5,
        group_id: 10,
        title: 'Group Notes',
        content: 'This is the first note.',
      },
      {
        id: 2,
        user_id: 6,
        group_id: 10,
        title: 'Meeting Notes',
        content: 'This is the second note.',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeNotes,
    });

    const result = await getNotesByGroupID({
      group_id: 10,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Notes" WHERE group_id = $1', [10]);
    expect(result).toEqual(fakeNotes);
  });

  // Boundary: no notes found
  test('should return an empty array when no notes exist for the group', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getNotesByGroupID({
      group_id: 999,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "Notes" WHERE group_id = $1', [999]);
    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getNotesByGroupID({
        group_id: 10,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 2 - Create note
// ---------------------------------------------------------
describe('Notes.model - insertNote', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: note created
  test('should create a new note', async () => {
    const fakeNote = [
      {
        id: 1,
        user_id: 5,
        group_id: 10,
        title: 'New Note',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeNote,
    });

    const result = await insertNote({
      user_id: 5,
      group_id: 10,
      title: 'New Note',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "Notes" (user_id, group_id, title) VALUES ($1, $2, $3) RETURNING *',
      [5, 10, 'New Note'],
    );
    expect(result).toEqual(fakeNote);
  });

  // Boundary: null values
  test('should reject invalid note data', async () => {
    pool.query.mockRejectedValue(
      new Error('null value in column "user_id" violates not-null constraint'),
    );

    await expect(
      insertNote({
        user_id: null,
        group_id: 10,
        title: 'New Note',
      }),
    ).rejects.toThrow('not-null constraint');
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertNote({
        user_id: 5,
        group_id: 10,
        title: 'New Note',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 3 - Update note content
// ---------------------------------------------------------
describe('Notes.model - updateNoteContent', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: note content updated
  test('should update an existing note content', async () => {
    const fakeNote = [
      {
        id: 1,
        content: 'Updated note content',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeNote,
    });

    const result = await updateNoteContent({
      id: 1,
      content: 'Updated note content',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Notes" SET content = $1 WHERE id = $2 RETURNING *',
      ['Updated note content', 1],
    );
    expect(result).toEqual(fakeNote);
  });

  // Boundary: note does not exist
  test('should return an empty array when the note does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateNoteContent({
      id: 999,
      content: 'Updated note content',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateNoteContent({
        id: 1,
        content: 'Updated note content',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 4 - Update note info
// ---------------------------------------------------------
describe('Notes.model - updateNote', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: note information updated
  test('should update an existing note information', async () => {
    const fakeNote = [
      {
        id: 1,
        folder_id: 2,
        title: 'Updated Note',
        template: 'default',
        is_pinned: true,
        is_archived: false,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeNote,
    });

    const result = await updateNote({
      id: 1,
      folder_id: 2,
      title: 'Updated Note',
      template: 'default',
      is_pinned: true,
      is_archived: false,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "Notes" SET folder_id = $1, title = $2, template = $3, is_pinned = $4, is_archived = $5 WHERE id = $6 RETURNING *',
      [2, 'Updated Note', 'default', true, false, 1],
    );
    expect(result).toEqual(fakeNote);
  });

  // Boundary: note does not exist
  test('should return an empty array when the note does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateNote({
      id: 999,
      folder_id: 2,
      title: 'Updated Note',
      template: 'default',
      is_pinned: true,
      is_archived: false,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateNote({
        id: 1,
        folder_id: 2,
        title: 'Updated Note',
        template: 'default',
        is_pinned: true,
        is_archived: false,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 5 - Delete note
// ---------------------------------------------------------
describe('Notes.model - deleteNote', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: note deleted
  test('should delete a note belonging to the user', async () => {
    const fakeNote = [
      {
        id: 1,
        user_id: 5,
        group_id: 10,
        title: 'Note to delete',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeNote,
    });

    const result = await deleteNote({
      id: 1,
      user_id: 5,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "Notes" WHERE id = $1 AND user_id = $2 RETURNING *',
      [1, 5],
    );
    expect(result).toEqual(fakeNote);
  });

  // Invalid partition: note does not belong to user
  test('should return an empty array when the note does not belong to the user', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteNote({
      id: 1,
      user_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      deleteNote({
        id: 1,
        user_id: 5,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 6 - Get note folders by group
// ---------------------------------------------------------
describe('Notes.model - getNoteFoldersByGroupID', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple folders returned
  test('should return all note folders for a group', async () => {
    const fakeFolders = [
      {
        id: 1,
        group_id: 10,
        name: 'School',
      },
      {
        id: 2,
        group_id: 10,
        name: 'Projects',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolders,
    });

    const result = await getNoteFoldersByGroupID({
      group_id: 10,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "NoteFolders" WHERE group_id = $1',
      [10],
    );
    expect(result).toEqual(fakeFolders);
  });

  // Boundary: no folders found
  test('should return an empty array when no note folders exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getNoteFoldersByGroupID({
      group_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getNoteFoldersByGroupID({
        group_id: 10,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 7 - Create note folder
// ---------------------------------------------------------
describe('Notes.model - insertNoteFolder', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: folder created
  test('should create a new note folder', async () => {
    const fakeFolder = [
      {
        id: 1,
        group_id: 10,
        name: 'School',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolder,
    });

    const result = await insertNoteFolder({
      group_id: 10,
      name: 'School',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "NoteFolders" (group_id, name) VALUES ($1, $2) RETURNING *',
      [10, 'School'],
    );
    expect(result).toEqual(fakeFolder);
  });

  // Boundary: duplicate folder name
  test('should reject duplicate note folders when the database rejects them', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertNoteFolder({
        group_id: 10,
        name: 'School',
      }),
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertNoteFolder({
        group_id: 10,
        name: 'School',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 8 - Update note folder color
// ---------------------------------------------------------
describe('Notes.model - updateFolderColor', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: folder color updated
  test('should update note folder color', async () => {
    const fakeFolder = [
      {
        id: 1,
        color: '#FF0000',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolder,
    });

    const result = await updateFolderColor({
      id: 1,
      color: '#FF0000',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "NoteFolders" SET color = $1 WHERE id = $2 RETURNING *',
      ['#FF0000', 1],
    );
    expect(result).toEqual(fakeFolder);
  });

  // Boundary: folder does not exist
  test('should return an empty array when the folder does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateFolderColor({
      id: 999,
      color: '#FF0000',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateFolderColor({
        id: 1,
        color: '#FF0000',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 9 - Update note folder name
// ---------------------------------------------------------
describe('Notes.model - updateFolderName', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: folder name updated
  test('should update note folder name', async () => {
    const fakeFolder = [
      {
        id: 1,
        name: 'Updated Folder',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolder,
    });

    const result = await updateFolderName({
      id: 1,
      name: 'Updated Folder',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "NoteFolders" SET name = $1 WHERE id = $2 RETURNING *',
      ['Updated Folder', 1],
    );
    expect(result).toEqual(fakeFolder);
  });

  // Boundary: folder does not exist
  test('should return an empty array when the folder does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateFolderName({
      id: 999,
      name: 'Updated Folder',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateFolderName({
        id: 1,
        name: 'Updated Folder',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 10 - Update note folder icon
// ---------------------------------------------------------
describe('Notes.model - updateFolderIcon', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: folder icon updated
  test('should update note folder icon', async () => {
    const fakeFolder = [
      {
        id: 1,
        icon: 'folder',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolder,
    });

    const result = await updateFolderIcon({
      id: 1,
      icon: 'folder',
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'UPDATE "NoteFolders" SET icon = $1 WHERE id = $2 RETURNING *',
      ['folder', 1],
    );
    expect(result).toEqual(fakeFolder);
  });

  // Boundary: folder does not exist
  test('should return an empty array when the folder does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await updateFolderIcon({
      id: 999,
      icon: 'folder',
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      updateFolderIcon({
        id: 1,
        icon: 'folder',
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 11 - Delete note folder
// ---------------------------------------------------------
describe('Notes.model - deleteNoteFolder', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: folder deleted
  test('should delete a note folder', async () => {
    const fakeFolder = [
      {
        id: 1,
        group_id: 10,
        name: 'Folder to delete',
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeFolder,
    });

    const result = await deleteNoteFolder({
      id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "NoteFolders" WHERE id = $1 RETURNING *',
      [1],
    );
    expect(result).toEqual(fakeFolder);
  });

  // Boundary: folder does not exist
  test('should return an empty array when the folder does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteNoteFolder({
      id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      deleteNoteFolder({
        id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 12 - Get all note links
// ---------------------------------------------------------
describe('Notes.model - getAllNoteLinks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple links returned
  test('should return all note links', async () => {
    const fakeLinks = [
      {
        source_note_id: 1,
        target_note_id: 2,
      },
      {
        source_note_id: 1,
        target_note_id: 3,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeLinks,
    });

    const result = await getAllNoteLinks();

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith('SELECT * FROM "NoteLinks"');
    expect(result).toEqual(fakeLinks);
  });

  // Boundary: no links found
  test('should return an empty array when no note links exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getAllNoteLinks();

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(getAllNoteLinks()).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 13 - Get note links by source note ID
// ---------------------------------------------------------
describe('Notes.model - getNoteLinksBySourceNoteId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple links returned
  test('should return all note links referenced by a source note', async () => {
    const fakeLinks = [
      {
        source_note_id: 1,
        target_note_id: 2,
      },
      {
        source_note_id: 1,
        target_note_id: 3,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeLinks,
    });

    const result = await getNoteLinksBySourceNoteId({
      source_note_id: 1,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "NoteLinks" WHERE source_note_id = $1',
      [1],
    );
    expect(result).toEqual(fakeLinks);
  });

  // Boundary: no links found
  test('should return an empty array when no source links exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getNoteLinksBySourceNoteId({
      source_note_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getNoteLinksBySourceNoteId({
        source_note_id: 1,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 14 - Get note links by target note ID
// ---------------------------------------------------------
describe('Notes.model - getNoteLinksByTargetNoteId', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: multiple links returned
  test('should return all note links referencing a target note', async () => {
    const fakeLinks = [
      {
        source_note_id: 1,
        target_note_id: 3,
      },
      {
        source_note_id: 2,
        target_note_id: 3,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeLinks,
    });

    const result = await getNoteLinksByTargetNoteId({
      target_note_id: 3,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'SELECT * FROM "NoteLinks" WHERE target_note_id = $1',
      [3],
    );
    expect(result).toEqual(fakeLinks);
  });

  // Boundary: no links found
  test('should return an empty array when no target links exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await getNoteLinksByTargetNoteId({
      target_note_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      getNoteLinksByTargetNoteId({
        target_note_id: 3,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 15 - Create note links
// ---------------------------------------------------------
describe('Notes.model - insertNoteLinks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: note link created
  test('should create a new note link', async () => {
    const fakeLink = [
      {
        source_note_id: 1,
        target_note_id: 2,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeLink,
    });

    const result = await insertNoteLinks({
      source_note_id: 1,
      target_note_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'INSERT INTO "NoteLinks" (source_note_id, target_note_id) VALUES ($1, $2) RETURNING *',
      [1, 2],
    );
    expect(result).toEqual(fakeLink);
  });

  // Boundary: duplicate link
  test('should reject duplicate note links when the database rejects them', async () => {
    pool.query.mockRejectedValue(new Error('duplicate key value violates unique constraint'));

    await expect(
      insertNoteLinks({
        source_note_id: 1,
        target_note_id: 2,
      }),
    ).rejects.toThrow('duplicate key value violates unique constraint');
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      insertNoteLinks({
        source_note_id: 1,
        target_note_id: 2,
      }),
    ).rejects.toThrow('connection lost');
  });
});

// ---------------------------------------------------------
// Unit Test 16 - Delete note links
// ---------------------------------------------------------
describe('Notes.model - deleteNoteLinks', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  // Valid partition: note link deleted
  test('should delete a note link', async () => {
    const fakeLink = [
      {
        source_note_id: 1,
        target_note_id: 2,
      },
    ];

    pool.query.mockResolvedValue({
      rows: fakeLink,
    });

    const result = await deleteNoteLinks({
      source_note_id: 1,
      target_note_id: 2,
    });

    expect(pool.query).toHaveBeenCalledTimes(1);
    expect(pool.query).toHaveBeenCalledWith(
      'DELETE FROM "NoteLinks" WHERE source_note_id = $1 AND target_note_id = $2  RETURNING *',
      [1, 2],
    );
    expect(result).toEqual(fakeLink);
  });

  // Boundary: note link does not exist
  test('should return an empty array when the note link does not exist', async () => {
    pool.query.mockResolvedValue({
      rows: [],
    });

    const result = await deleteNoteLinks({
      source_note_id: 999,
      target_note_id: 999,
    });

    expect(result).toEqual([]);
  });

  // Error handling
  test('should propagate database errors', async () => {
    pool.query.mockRejectedValue(new Error('connection lost'));

    await expect(
      deleteNoteLinks({
        source_note_id: 1,
        target_note_id: 2,
      }),
    ).rejects.toThrow('connection lost');
  });
});
