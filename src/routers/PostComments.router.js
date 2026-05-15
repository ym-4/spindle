const express = require('express');
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

// Get Comments by ID
router.get('/:id', (req, res, next) => {
  const data = {
    post_id: req.params.id
  }

  getCommentsByPostID(data)
    .then((Comments) => res.status(200).json(Comments))
    .catch(next);
});

// Creates new comment
router.post('/', (req, res, next) => {
  // missing required information
  if (req.body == undefined  || req.body.user_id == undefined || req.body.title == undefined || req.body.category == undefined || req.body.content == undefined) {
    res.status(400).json({"message": "Error: user_id, title, category or content is undefined"});
    return;
  }
  const data = {
    
  }

// create Comments
insertComments(data)
    .then(results => res.status(201).json({
        "id": results.id, 
        "user_id": data.user_id,
        "title": data.title, 
        "category": data.category,
        "content": data.content 
    }))
    .catch((error) => {
        console.error("Error insertComments: " + error);
        res.status(500).json(error);
    })
});

// Update Comments (owner only) 
router.put('/:id', (req, res, next) => {
  const data = {
    
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
router.delete('/:id', (req, res, next) => {
   const data = {
    id: req.params.id
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
