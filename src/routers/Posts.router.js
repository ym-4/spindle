const express = require('express');
const { 
  getAllPost, 
  getPostByID, 
  getPostByCategory, 
  insertPost,
  updatePostByID,
  deletePostByID
} = require('../models/Posts.model');

const router = express.Router();

// Get all post
router.get('/', (req, res, next) => {
  getAllPost()
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// Get post by ID
router.get('/:id', (req, res, next) => {
  const data = {
    id: req.params.id
  }

  getPostByID(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// Get post by Category
router.get('/tag/:category', (req, res, next) => {
  const data = {
    category: req.params.category
  }

  getPostByCategory(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});


// Creates new post 
router.post('/', (req, res, next) => {
  // missing required information
  if (req.body == undefined  || req.body.user_id == undefined || req.body.title == undefined || req.body.category == undefined || req.body.content == undefined) {
    res.status(400).json({"message": "Error: user_id, title, category or content is undefined"});
    return;
  }
  const data = {
    user_id: req.body.user_id,
    title: req.body.title, 
    category: req.body.category, 
    content: req.body.content
  }

// create post
insertPost(data)
    .then(results => res.status(201).json({
        "id": results.id, 
        "user_id": data.user_id,
        "title": data.title, 
        "category": data.category,
        "content": data.content 
    }))
    .catch((error) => {
        console.error("Error insertPost: " + error);
        res.status(500).json(error);
    })
});

// Update post (owner only) 
router.put('/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
    title: req.body.title,
    content: req.body.content
  }

  updatePostByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error updatePostByID: " + error);
        res.status(500).json(error);
    })
});

// delete post (owner only)
router.delete('/:id', (req, res, next) => {
   const data = {
    id: req.params.id
  }
  deletePostByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error deletePostByID: " + error);
        res.status(500).json(error);
    })
});

//==================== post interactions ===========================



module.exports = router;
