const express = require('express');
const jwtMiddleware = require('../middlewares/jwtMiddleware');

const { 
  getAllComments,
  getCommentsByPostID,  
  insertComments,
  updateCommentsByID,
  deleteCommentsByID
} = require('../models/PostComments.model');

const router = express.Router();

// Get all comments
router.get('/', (req, res, next) => {
  getAllComments()
    .then((Comments) => res.status(200).json(Comments))
    .catch(next);
});

// Get Comments by post ID
router.get('/:post_id', (req, res, next) => {
  const data = {
    post_id: req.params.post_id
  }

  getCommentsByPostID(data)
    .then((Comments) => res.status(200).json(Comments))
    .catch(next);
});

// Creates new comment under a post (post_id)
router.post('/:post_id', 
  jwtMiddleware.verifyToken, 
  (req, res, next) => {
  // missing required information
  if (req.body == undefined || req.params.post_id == undefined || req.body.content == undefined) {
    res.status(400).json({"message": "Error: user_id, post_id or content is undefined"});
    return;
  }
  const data = {
    user_id: res.locals.userId,
    post_id: req.params.post_id,
    content: req.body.content
  }

// create Comments
insertComments(data)
    .then(results => res.status(201).json({
        "id": results.id, 
        "user_id": data.user_id,
        "commented_on": data.post_id, 
        "content": data.content 
    }))
    .catch((error) => {
        console.error("Error insertComments: " + error);
        res.status(500).json(error);
    })
});

// Update Comments (owner only) 
router.put('/:id', 
  jwtMiddleware.verifyToken,
  (req, res, next) => {
  
  const data = {
    id: req.params.id,
    user_id: res.locals.userId,
    content: req.body.content
  }

  updateCommentsByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Comments not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error updateCommentsByID: " + error);
        res.status(500).json(error);
    })
});

// delete Comments (owner only)
router.delete('/:id', 
  jwtMiddleware.verifyToken,
  (req, res, next) => {
    
   const data = {
    id: req.params.id,
    user_id: res.locals.userId
  }
  deleteCommentsByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Comments not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error deleteCommentsByID: " + error);
        res.status(500).json(error);
    })
});

module.exports = router;
