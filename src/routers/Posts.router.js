const express = require('express');
const upload = require('../middlewares/upload');

const fs = require("fs");
const path = require("path");

const { 
  getAllPost, 
  getPostByID, 
  getPostByCategory,
  getRelatedPosts, 
  insertPost,
  updatePostByID,
  deletePostByID,
  getSavedByUserID,
  insertSaved,
  deleteSavedByID,
  getReactionByUserID,
  insertLike,
  updateReaction,
  deleteReaction,
  insertReport
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

// Get 3 random related posts
router.get('/related/:category/:id', (req, res, next) => {
  const data = {
    category: req.params.category,
    id: req.params.id
  };

  getRelatedPosts(data)
    .then((posts) => res.status(200).json(posts))
    .catch(next);
});

// Creates new post 
router.post('/', upload.single('attachment'), (req, res, next) => {
  if (
    req.body == undefined || req.body.user_id == undefined || req.body.title == undefined || req.body.category == undefined || req.body.content == undefined) 
  {
    res.status(400).json({message: 'Error: user_id, title, category or content is undefined'});
    return;
  }

  const attachmentUrl = req.file
    ? `/uploads/${req.file.filename}`
    : null;

  const data = {
    user_id: req.body.user_id,
    title: req.body.title,
    category: req.body.category,
    content: req.body.content,
    attachment_url: attachmentUrl,
    is_anonymous: req.body.is_anonymous === 'true'
  };

  insertPost(data)
    .then(results => res.status(201).json({
      id: results.id,
      user_id: data.user_id,
      title: data.title,
      category: data.category,
      content: data.content,
      attachment_url: data.attachment_url
    }))
    .catch((error) => {
      console.error('Error insertPost:', error);
      res.status(500).json(error);
    });
});

// Update post (owner only) 
router.put('/:id', upload.single('attachment'), (req, res, next) => {
  let attachmentUrl = req.body.attachment_url || null;

  getPostByID({ id: req.params.id })
    .then((existingPost) => {
      if (!existingPost) {
        return res.status(404).json({
          error: 'Post not found'
        });
      }

      attachmentUrl = existingPost.attachment_url;

      if (req.body.remove_attachment === 'true') {
        if (existingPost.attachment_url) {
          const oldPath = path.join(process.cwd(), 'src', 'public', existingPost.attachment_url.replace(/^\/+/, ''));

          fs.unlink(oldPath, (err) => {
            if (err) {
              console.log('Old file delete skipped:', err.message);
            }
          });
        }
        attachmentUrl = null;
      }
      if (req.file) {
        if (existingPost.attachment_url) {
          const oldPath = path.join(process.cwd(), 'src', 'public', existingPost.attachment_url.replace(/^\/+/, ''));

          fs.unlink(oldPath, (err) => {
            if (err) {
              console.log('Old file delete skipped:', err.message);
            }
          });
        }
        attachmentUrl = `/uploads/${req.file.filename}`;
      }

      const data = {
        id: req.params.id,
        title: req.body.title,
        content: req.body.content,
        category: req.body.category,
        attachment_url: attachmentUrl
      };
      return updatePostByID(data);
    })
    .then((results) => {
      if (!results) {
        return res.status(404).json({error: 'Post not found'});
      }
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error updatePostByID:', error);
      res.status(500).json(error);
    });
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

//==================== post interactions (saves, likes, etc) ============================
//saves
// Get saved posts by user ID
router.get('/saved/:user_id', (req, res, next) => {
  const data = {
    user_id: req.params.user_id
  }
  getSavedByUserID(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// adds new save to saved posts
router.post('/saved', (req, res, next) => {
  // missing required information
  if (req.body == undefined  || req.body.user_id == undefined || req.body.post_id == undefined) {
    res.status(400).json({"message": "Error: user_id or post_id is undefined"});
    return;
  }
  const data = {
    user_id: req.body.user_id,
    post_id: req.body.post_id
  }

// saves new post 
insertSaved(data)
    .then(results => res.status(201).json({
        "id": results.id, 
        "user_id": data.user_id,
        "post_id": data.post_id
    }))
    .catch((error) => {
        console.error("Error insertSaved: " + error);
        res.status(500).json(error);
    })
});

// remove a save
router.delete('/saved/:id', (req, res, next) => {
   const data = {
    id: req.params.id
  }
  deleteSavedByID(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Save not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error deleteSavedByID: " + error);
        res.status(500).json(error);
    })
});

// likes n dislikes
// Get reaction by user
router.get('/reaction/:user_id', (req, res, next) => {
  const data = {
    user_id: req.params.user_id
  }
  getReactionByUserID(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// creates like for a post
router.post('/like', (req, res, next) => {
  // missing required information
  if (req.body == undefined  || req.body.post_id == undefined || req.body.user_id == undefined) {
    res.status(400).json({"message": "Error: user_id or post_id is undefined"});
    return;
  }
  const data = {
    post_id: req.body.post_id,
    user_id: req.body.user_id,
    reaction_type: req.body.reaction_type
  }

// likes a post_id 
insertLike(data)
    .then(results => res.status(201).json({
        "id": results.id, 
        "post_id": data.post_id,
        "user_id": data.user_id,
        "reaction_type": data.reaction_type
    }))
    .catch((error) => {
        console.error("Error insertLike: " + error);
        res.status(500).json(error);
    })
});

// Update reaction type
router.put('/reaction/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.body.user_id,
    reaction_type: req.body.reaction_type
  }

  updateReaction(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error updateReaction: " + error);
        res.status(500).json(error);
    })
});

// remove a like or dislike
router.delete('/reaction/:id', (req, res, next) => {
   const data = {
    id: req.params.id,
    user_id: req.body.user_id
  }
  deleteReaction(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
        console.error("Error deleteReaction: " + error);
        res.status(500).json(error);
    })
});

// Report a post
router.post('/:id/report', (req, res, next) => {
  if (!req.body.user_id || !req.body.reason) {
    return res.status(400).json({ message: 'user_id and reason not found.' });
  }

  const data = {
    post_id: req.params.id,
    user_id: req.body.user_id,
    reason:  req.body.reason
  };

  insertReport(data)
    .then((result) => res.status(201).json(result))
    .catch((error) => {
      // Unique constraint violation if user already reported this post
      if (error.code === '23505') {
        return res.status(409).json({ message: 'You have already reported this post.' });
      }
      console.error('Error insertReport:', error);
      res.status(500).json({ message: 'Failed to submit report.' });
    });
});

module.exports = router;
