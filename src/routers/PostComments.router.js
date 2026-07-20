const express = require('express');
const { authenticateJWT } = require('../middlewares/auth.middleware');

const {
  getAllComments,
  getCommentsByPostID,
  insertComments,
  updateCommentsByID,
  deleteCommentsByID,
  getSavedCommentsByUserID,
  insertSavedComment,
  deleteSavedCommentByID,
  getCommentReactionByUserID,
  insertCommentLike,
  updateCommentReaction,
  deleteCommentReaction,
  deleteCommentByPostOwner,
  insertCommentReport,
} = require('../models/PostComments.model');

const router = express.Router();

// Get all comments
router.get('/', (req, res, next) => {
  getAllComments()
    .then((Comments) => res.status(200).json(Comments))
    .catch(next);
});

// comments interactions
// saving comments
// GET saved comments by user
router.get('/saved/:user_id', authenticateJWT, (req, res, next) => {
  getSavedCommentsByUserID({ user_id: req.params.user_id })
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// Save a comment
router.post('/saved', authenticateJWT, (req, res, next) => {
  if (!req.body?.comment_id) {
    return res.status(400).json({ message: 'Error: comment_id is undefined' });
  }
  const data = {
    user_id: req.user.id,
    comment_id: req.body.comment_id,
  };

  insertSavedComment(data)
    .then((results) =>
      res.status(201).json({
        id: results.id,
        user_id: data.user_id,
        comment_id: data.comment_id,
      }),
    )
    .catch((error) => {
      console.error('Error insertSaved: ' + error);
      res.status(500).json(error);
    });
});

// Unsave a comment
router.delete('/saved/:id', (req, res, next) => {
  const data = { id: req.params.id };
  deleteSavedCommentByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Save not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error deleteSavedByID: ' + error);
      res.status(500).json(error);
    });
});

// get comment reactions by user
router.get('/reaction/:user_id', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.params.user_id,
  };

  getCommentReactionByUserID(data)
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// Insert comment reaction
router.post('/like', authenticateJWT, (req, res, next) => {
  if (!req.body?.comment_id) {
    return res.status(400).json({ message: 'Error: comment_id is undefined' });
  }
  const data = {
    comment_id: req.body.comment_id,
    user_id: req.user.id,
    reaction_type: req.body.reaction_type,
  };
  insertCommentLike(data)
    .then((results) =>
      res.status(201).json({
        id: results.id,
        comment_id: data.comment_id,
        user_id: data.user_id,
        reaction_type: data.reaction_type,
      }),
    )
    .catch((error) => {
      console.error('Error insertCommentLike: ' + error);
      res.status(500).json(error);
    });
});

// Update comment reaction
router.put('/reaction/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.body.user_id,
    reaction_type: req.body.reaction_type,
  };
  updateCommentReaction(data)
    .then((results) => {
      if (!results) return res.status(404).json({ error: 'Reaction not found' });
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error updateCommentReaction: ' + error);
      res.status(500).json(error);
    });
});

// Delete comment reaction
router.delete('/reaction/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.body.user_id,
  };
  deleteCommentReaction(data)
    .then((results) => {
      if (!results) return res.status(404).json({ error: 'Reaction not found' });
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error deleteCommentReaction: ' + error);
      res.status(500).json(error);
    });
});

// Get Comments by post ID
router.get('/:post_id', (req, res, next) => {
  const data = {
    post_id: req.params.post_id,
  };

  getCommentsByPostID(data)
    .then((Comments) => res.status(200).json(Comments))
    .catch(next);
});

// Creates new comment under a post (post_id)
router.post('/:post_id', authenticateJWT, (req, res, next) => {
  if (!req.body || !req.params.post_id || !req.body.content) {
    return res.status(400).json({ message: 'Error: post_id or content is undefined' });
  }

  const data = {
    user_id: req.user.id,
    post_id: req.params.post_id,
    content: req.body.content,
    parent_comment_id: req.body.parent_comment_id || null,
  };

  insertComments(data)
    .then((results) =>
      res.status(201).json({
        id: results.id,
        user_id: data.user_id,
        commented_on: data.post_id,
        content: data.content,
        parent_comment_id: data.parent_comment_id,
      }),
    )
    .catch((error) => {
      console.error('Error insertComments: ' + error);
      res.status(500).json(error);
    });
});

// Update Comments (owner only)
router.put('/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.user.id,
    content: req.body.content,
  };

  updateCommentsByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Comments not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error updateCommentsByID: ' + error);
      res.status(500).json(error);
    });
});

// delete Comments (owner or post owner)
router.delete('/:id', authenticateJWT, (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.user.id,
  };
  // First try as comment owner
  deleteCommentsByID(data)
    .then((results) => {
      if (results) return res.status(200).json(results);
      // If not comment owner, try as post owner
      return deleteCommentByPostOwner(data).then((r) => {
        if (!r) return res.status(404).json({ error: 'Comment not found or not authorized.' });
        res.status(200).json(r);
      });
    })
    .catch((error) => {
      console.error('Error deleteCommentsByID: ' + error);
      res.status(500).json(error);
    });
});

module.exports = router;
