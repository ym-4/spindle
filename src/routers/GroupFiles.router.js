const express = require('express');
const fs = require('fs');
const path = require('path');

// Import functions needed
const {
  getGroupFilesByGroupID,
  getGroupFilesByID,
  insertGroupFiles,
  deleteGroupFilesByID,
  updateGroupFileFolderByID,
  getGroupFoldersByGroupID,
  insertGroupFolder,
  deleteGroupFolderByID,
  moveFilesToUnorganised,
} = require('../models/GroupFiles.model');

const { authenticateJWT } = require('../middlewares/auth.middleware');
const upload = require('../middlewares/fileUpload');

const router = express.Router();

// GET Group files by group
router.get('/files/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getGroupFilesByGroupID(data)
    .then((files) => res.status(200).json(files))
    .catch(next);
});

// POST Group files
router.post('/files/:group_id', authenticateJWT, upload.single('file'), (req, res, next) => {
  if (!req.file) {
    return res.status(400).json({
      message: 'No file uploaded',
    });
  }

  if (req.body == undefined || req.body.folder_name == undefined) {
    res.status(400).json({ message: 'Error: name, file_path or folder_name is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    group_id: req.params.group_id,
    folder_name: req.body.folder_name,
    name: req.file.originalname,
    file_path: req.file.filename,
  };

  insertGroupFiles(data)
    .then((results) => {
      res.status(201).json(results);
    })
    .catch(next);
});

// PUT Group files (Update folder_name)
router.put('/files/:id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.folder_name == undefined) {
    res.status(400).json({ message: 'Error: folder_name is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    id: req.params.id,
    folder_name: req.body.folder_name,
  };

  // Prevents update of file if user is not the creator
  getGroupFilesByID(data)
    .then((results) => {
      if (results[0].user_id != data.user_id) {
        return res.status(403).json({ message: 'You did not upload this file' });
      }
    })
    .then(() => {
      updateGroupFileFolderByID(data)
        .then((results) => {
          if (results.length === 0) {
            return res.status(404).json({
              message: 'File not found',
            });
          }

          res.status(200).json(results);
        })
        .catch(next);
    });
});

// DELETE Group files by id (only file creator)
router.delete('/files/:id', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
    id: req.params.id,
  };

  // Prevents deletion of file if user is not the creator
  getGroupFilesByID(data)
    .then((results) => {
      if (results.length === 0) {
        return res.status(404).json({
          message: 'File not found',
        });
      }

      if (results[0].user_id != data.user_id) {
        return res.status(403).json({
          message: 'You did not upload this file',
        });
      }

      const filePath = path.join(__dirname, '../uploads/group_files', results[0].file_path);

      return deleteGroupFilesByID(data).then(() => {
        fs.unlink(filePath, () => {
          // Ignore if file already doesn't exist
        });

        res.sendStatus(204);
      });
    })
    .catch(next);
});

// GET Group folders  by group
router.get('/folders/:group_id', (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getGroupFoldersByGroupID(data)
    .then((files) => res.status(200).json(files))
    .catch(next);
});

// POST Group folders
router.post('/folders/:group_id', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.name == undefined) {
    res.status(400).json({ message: 'Error: name is undefined' });
    return;
  }

  const data = {
    user_id: req.user.id,
    group_id: req.params.group_id,
    name: req.body.name,
  };

  insertGroupFolder(data)
    .then((results) => {
      res.status(201).json(results);
    })
    .catch(next);
});

// DELETE Group folder
router.delete('/folders/:id', authenticateJWT, async (req, res, next) => {
  try {
    const folder = (
      await getGroupFoldersByGroupID({
        group_id: req.query.group_id,
      })
    ).find((f) => f.id == req.params.id);

    if (!folder) {
      return res.status(404).json({
        message: 'Folder not found',
      });
    }

    await moveFilesToUnorganised({
      group_id: folder.group_id,
      folder_name: folder.name,
    });

    await deleteGroupFolderByID({
      id: folder.id,
    });

    res.sendStatus(204);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
