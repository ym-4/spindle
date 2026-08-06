const express = require('express');

// Import functions needed
const {
  getAllWhiteboards,
  getWhiteboardsByGroupId,
  getWhiteboardsByUserId,
  getWhiteboardsByUserIdAndGroup,
  getWhiteboardsById,
  insertWhiteboards,
  updateWhiteboardsData,
  updateWhiteboardsName,
  deleteWhiteboards,
} = require('../models/Whiteboard.model');

const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();

// Get all Whiteboards
router.get('/', authenticateJWT, (req, res, next) => {
  getAllWhiteboards()
    .then((whiteboards) => res.status(200).json(whiteboards))
    .catch(next);
});

// Get all Whiteboards by groups
router.get('/group/:group_id', authenticateJWT, (req, res, next) => {
  const data = {
    group_id: req.params.group_id,
  };

  getWhiteboardsByGroupId(data)
    .then((whiteboards) => res.status(200).json(whiteboards))
    .catch(next);
});

// Get all Whiteboards by user
router.get('/user', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
  };

  getWhiteboardsByUserId(data)
    .then((whiteboards) => res.status(200).json(whiteboards))
    .catch(next);
});

// Get all Whiteboards by group and user
router.get('/user/:group_id', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
    group_id: req.params.group_id,
  };

  getWhiteboardsByUserIdAndGroup(data)
    .then((whiteboards) => res.status(200).json(whiteboards))
    .catch(next);
});

// Get Whiteboard by id
router.get('/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
  };

  getWhiteboardsById(data)
    .then((whiteboards) => res.status(200).json(whiteboards))
    .catch(next);
});

// Create empty whiteboard
// Request body: group_id (optional), title, mode
router.post('/', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.title == undefined || req.body.mode == undefined) {
    res.status(400).json({ message: 'Error: title or mode is undefined' });
    return;
  }

  if (req.body.mode !== 'whiteboard' && req.body.mode !== 'pixel') {
    return res.status(400).json({ message: 'Error: Invalid mode' });
  }

  const data = {
    user_id: req.user.id,
    group_id: req.body.group_id || null,
    title: req.body.title,
    mode: req.body.mode,
  };

  // Check that group with the same name doesn't already exist
  insertWhiteboards(data)
    .then((whiteboards) => res.status(201).json(whiteboards))
    .catch(next);
});

// Update whiteboard drawing data
router.put('/:id/drawing_data', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.drawing_data == undefined) {
    res.status(400).json({ message: 'Error: drawing_data is undefined' });
    return;
  }

  const data = {
    drawing_data: req.body.drawing_data,
    user_id: req.user.id,
    id: req.params.id,
  };

  // Check that user created the whiteboard
  getWhiteboardsById(data)
    .then((whiteboard) => {
      if (whiteboard.length == 0) {
        return res.status(404).json({
          message: 'Whiteboard not found',
        });
      }

      if (whiteboard[0].user_id === data.user_id) {
        updateWhiteboardsData(data)
          .then((results) => {
            return res.status(200).json(results);
          })
          .catch(next);
      } else {
        return res.status(403).json({ message: 'You are not the creator of this whiteboard' });
      }
    })
    .catch(next);
});

// Update whiteboard title
router.put('/:id/title', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.title == undefined) {
    res.status(400).json({ message: 'Error: title is undefined' });
    return;
  }

  const data = {
    title: req.body.title,
    user_id: req.user.id,
    id: req.params.id,
  };

  // Check that user created the whiteboard
  getWhiteboardsById(data)
    .then((whiteboard) => {
      if (whiteboard.length == 0) {
        return res.status(404).json({
          message: 'Whiteboard not found',
        });
      }
      if (whiteboard[0].user_id === data.user_id) {
        updateWhiteboardsName(data)
          .then((results) => {
            return res.status(200).json(results);
          })
          .catch(next);
      } else {
        return res.status(403).json({ message: 'You are not the creator of this whiteboard' });
      }
    })
    .catch(next);
});

// Delete whiteboard
router.delete('/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.user.id,
  };

  // Check that user created the whiteboard
  getWhiteboardsById(data)
    .then((whiteboard) => {
      if (whiteboard.length == 0) {
        return res.status(404).json({
          message: 'Whiteboard not found',
        });
      }
      if (whiteboard[0].user_id === data.user_id) {
        deleteWhiteboards(data)
          .then((results) => {
            if (!results) {
              return res.status(404).json({
                message: 'Whiteboard not found',
              });
            } else {
              res.status(204).send();
            }
          })
          .catch(next);
      } else {
        return res.status(403).json({ message: 'You are not the creator of this whiteboard' });
      }
    })
    .catch(next);
});

module.exports = router;
