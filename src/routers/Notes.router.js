// Import functions needed
const express = require('express');

const {
  getNotesByGroupID,
  getNoteByID,
  getNoteByTitleAndGroupID,
  getNotesByFolderID,
  insertNote,
  updateNote,
  updateNoteContent,
  deleteNote,
  getNoteFoldersByGroupID,
  getNoteFoldersByGroupIDAndName,
  getNoteFoldersByID,
  insertNoteFolder,
  updateFolderColor,
  updateFolderIcon,
  updateFolderName,
  deleteNoteFolder,
  getAllNoteLinks,
  getNoteLinksBySourceAndTargetNoteId,
  getNoteLinksBySourceNoteId,
  getNoteLinksByTargetNoteId,
  insertNoteLinks,
  deleteNoteLinks,
} = require('../models/Notes.model');

const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();

// -------------------------------------------------------------
// Notes
// -------------------------------------------------------------

// GET Notes by group id
router.get('/group/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getNotesByGroupID(data)
    .then((notes) => res.status(200).json(notes))
    .catch(next);
});

// GET Notes by group and title (Is this needed?)
router.get('/group/:group_id/:title', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
    title: req.params.title,
  };

  getNoteByTitleAndGroupID(data)
    .then((notes) => res.status(200).json(notes))
    .catch(next);
});

// GET Notes by folder id
router.get('/folder/:folder_id', (req, res, next) => {
  const data = {
    folder_id: req.params.folder_id,
  };

  getNotesByFolderID(data)
    .then((notes) => res.status(200).json(notes))
    .catch(next);
});

// GET Notes by id
router.get('/note/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
  };

  getNoteByID(data)
    .then((notes) => {
      if (notes.length == 0) {
        return res.status(404).json({ message: 'Note not found' });
      } else {
        res.status(200).json(notes);
      }
    })
    .catch(next);
});

// Create new Note
// Need: user_id, title, group_id (optional)
// Title and group unique
router.post('/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.title == undefined) {
    res.status(400).json({ message: 'Error: title is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    title: req.body.title,
    group_id: req.params.group_id,
  };

  // Check that note with the same name and group does not already exist
  getNoteByTitleAndGroupID(data)
    .then((notes) => {
      // A note with the same title and group already exists
      if (notes.length > 0) {
        res.status(409).json({ message: 'Error: Note with the same title already exists' });

        // Create the note
      } else {
        insertNote(data)
          .then((results) => {
            res.status(201).json(results);
          })
          .catch(next);
      }
    })
    .catch(next);
});

// Update note (everything except content)
router.put('/:id/group/:group_id', authenticateJWT, (req, res, next) => {
  if (
    req.body == undefined ||
    (req.body.folder_id === undefined &&
      req.body.title === undefined &&
      req.body.template === undefined &&
      req.body.is_pinned === undefined &&
      req.body.is_archived === undefined)
  ) {
    res.status(400).json({ message: 'Error: Missing required fields' });
    return;
  }

  const data = {
    id: req.params.id,
    group_id: req.params.group_id,
    user_id: req.user.id,
    is_archived: req.body.is_archived,
    is_pinned: req.body.is_pinned,
    template: req.body.template,
    title: req.body.title,
    folder_id: req.body.folder_id,
  };

  let note = [];

  // Make sure user is the owner of note
  getNoteByID(data)
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Note not found' });
      }

      if (results[0].user_id == data.user_id) {
        note = results[0];

        // Check that note with the same name and group does not already exist
        getNoteByTitleAndGroupID(data)
          .then((notes) => {
            // A note with the same title and group already exists
            if (notes.length > 0) {
              if (notes[0].id == data.id) {
                if (data.title === undefined) {
                  data.title = note.title;
                }

                if (data.is_archived === undefined) {
                  data.is_archived = note.is_archived;
                }

                if (data.is_pinned === undefined) {
                  data.is_pinned = note.is_pinned;
                }

                if (data.template === undefined) {
                  data.template = note.template;
                }

                if (data.folder_id === undefined) {
                  data.folder_id = note.folder_id;
                }

                updateNote(data)
                  .then((results) => {
                    res.status(200).json(results);
                  })
                  .catch(next);
              } else {
                res.status(409).json({ message: 'Error: Note with the same title already exists' });
              }

              // Update the note
            } else {
              if (data.title === undefined) {
                data.title = note.title;
              }

              if (data.is_archived === undefined) {
                data.is_archived = note.is_archived;
              }

              if (data.is_pinned === undefined) {
                data.is_pinned = note.is_pinned;
              }

              if (data.template === undefined) {
                data.template = note.template;
              }

              if (data.folder_id === undefined) {
                data.folder_id = note.folder_id;
              }

              updateNote(data)
                .then((results) => {
                  res.status(200).json(results);
                })
                .catch(next);
            }
          })
          .catch(next);
      } else {
        res.status(403).json({ message: 'Error: You did not create this note' });
        return;
      }
    })
    .catch(next);
});

// Update note content
router.put('/:id/content', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.content == undefined) {
    res.status(400).json({ message: 'Error: content is undefined' });
    return;
  }

  const data = {
    id: req.params.id,
    content: req.body.content,
  };

  updateNoteContent(data)
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Note not found' });
      } else {
        res.status(200).json(results);
      }
    })
    .catch(next);
});

// Delete note
router.delete('/note/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.user.id,
  };

  getNoteByID(data)
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Note not found' });
      } else {
        if (results[0].user_id == data.user_id) {
          deleteNote(data)
            .then((results) => {
              if (results.length == 0) {
                return res.status(404).json({ message: 'Note not found' });
              } else {
                res.status(204).send();
              }
            })
            .catch(next);
        } else {
          return res.status(403).json({ message: 'You did not create this note' });
        }
      }
    })
    .catch(next);
});

// -------------------------------------------------------------
// Note Folders
// -------------------------------------------------------------

// GET Note Folders by group id
router.get('/folders/group/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getNoteFoldersByGroupID(data)
    .then((notes) => res.status(200).json(notes))
    .catch(next);
});

// Create new Note Folder
// Need: name, group_id
router.post('/folders/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.name == undefined) {
    res.status(400).json({ message: 'Error: name is undefined' });
    return;
  }

  const data = {
    name: req.body.name,
    group_id: req.params.group_id,
  };

  // Check that note folder with the same name and group does not already exist
  getNoteFoldersByGroupIDAndName(data)
    .then((folder) => {
      // A note folder with the same title and group already exists
      if (folder.length > 0) {
        res.status(409).json({ message: 'Error: Folder with the same title already exists' });

        // Create the folder
      } else {
        insertNoteFolder(data)
          .then((results) => {
            res.status(201).json(results);
          })
          .catch(next);
      }
    })
    .catch(next);
});

// Update folder color
router.put('/folders/:id/color', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.color == undefined) {
    res.status(400).json({ message: 'Error: color is undefined' });
    return;
  }

  const data = {
    id: req.params.id,
    color: req.body.color,
  };

  updateFolderColor(data)
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// Update folder icon
router.put('/folders/:id/icon', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.icon == undefined) {
    res.status(400).json({ message: 'Error: icon is undefined' });
    return;
  }

  const data = {
    id: req.params.id,
    icon: req.body.icon,
  };

  updateFolderIcon(data)
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// Update folder name
router.put('/folders/:id/name', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.name == undefined || req.body.group_id == undefined) {
    res.status(400).json({ message: 'Error: name or group_id is undefined' });
    return;
  }

  const data = {
    id: req.params.id,
    name: req.body.name,
    group_id: req.body.group_id,
  };

  // Check that note folder with the same name and group does not already exist
  getNoteFoldersByGroupIDAndName(data)
    .then((folder) => {
      // A note folder with the same title and group already exists
      if (folder.length > 0) {
        if (folder[0].id == data.id) {
          // Update the folder
          updateFolderName(data)
            .then((results) => res.status(200).json(results))
            .catch(next);
        } else {
          res.status(409).json({ message: 'Error: Folder with the same title already exists' });
        }

        // Update the folder
      } else {
        updateFolderName(data)
          .then((results) => res.status(200).json(results))
          .catch(next);
      }
    })
    .catch(next);
});

// Delete folder
router.delete('/folders/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
  };

  deleteNoteFolder(data)
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Note folder not found' });
      } else {
        res.status(204).send();
      }
    })
    .catch(next);
});

// -------------------------------------------------------------
// Note Links
// -------------------------------------------------------------

// Get all Note links
router.get('/links/', (req, res, next) => {
  getAllNoteLinks()
    .then((links) => res.status(200).json(links))
    .catch(next);
});

/* 
  source_note_id -----------> target_note_id
*/

// GET Note Links by source_note_id
// Get note links referenced by a note (Get notes that are referenced by this note)
router.get('/links/source/:source_note_id', (req, res, next) => {
  const data = {
    source_note_id: req.params.source_note_id,
  };

  getNoteLinksBySourceNoteId(data)
    .then((links) => res.status(200).json(links))
    .catch(next);
});

// GET Note Links by target_note_id
// Get note links that references a note (Get notes that are reference this note)
router.get('/links/target/:target_note_id', (req, res, next) => {
  const data = {
    target_note_id: req.params.target_note_id,
  };

  getNoteLinksByTargetNoteId(data)
    .then((links) => res.status(200).json(links))
    .catch(next);
});

// Create new Note Link
// Need: name, group_id
router.post('/links/:source_note_id/:target_note_id', authenticateJWT, (req, res, next) => {
  const data = {
    source_note_id: req.params.source_note_id,
    target_note_id: req.params.target_note_id,
  };

  // Check that notes exist
  getNoteByID({ id: data.source_note_id })
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Note not found' });
      } else {
        getNoteByID({ id: data.target_note_id })
          .then((results) => {
            if (results.length == 0) {
              return res.status(404).json({ message: 'Note not found' });
            } else {
              // Check that link doesn't already exist
              getNoteLinksBySourceAndTargetNoteId(data)
                .then((links) => {
                  if (links.length > 0) {
                    res.status(409).json({ message: 'Error: Note link already exists' });
                  } else {
                    insertNoteLinks(data)
                      .then((results) => res.status(201).json(results))
                      .catch(next);
                  }
                })
                .catch(next);
            }
          })
          .catch(next);
      }
    })
    .catch(next);
});

// Delete link
router.delete('/links/:source_note_id/:target_note_id', authenticateJWT, (req, res, next) => {
  const data = {
    source_note_id: req.params.source_note_id,
    target_note_id: req.params.target_note_id,
  };

  deleteNoteLinks(data)
    .then((results) => {
      if (results.length == 0) {
        return res.status(404).json({ message: 'Link not found' });
      } else {
        res.status(204).send();
      }
    })
    .catch(next);
});

module.exports = router;
