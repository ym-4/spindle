const express = require('express');
const upload = require('../middlewares/upload');

const { authenticateJWT } = require('../middlewares/auth.middleware');

const fs = require('fs');
const path = require('path');

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
  insertReport,
  getAllReports,
  searchAllPosts,
  togglePin,
  insertPoll,
  insertPollOption,
  getPollByPostID,
  insertPollVote,
  getUserPollVote
} = require('../models/Posts.model');

const router = express.Router();

// Get all post
router.get('/', (req, res, next) => {
  getAllPost()
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// Admin: Get all posts with optional search, category, and date filters
router.get('/admin/all', authenticateJWT, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    const { search, category, date } = req.query;
    const posts = await searchAllPosts({ search, category, date });
    res.status(200).json(posts);
  } catch (err) {
    next(err);
  }
});

// Get all reports (admin only) 
router.get('/reports', authenticateJWT, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Admin access required.' });
    }
    const includeDismissed = req.query.includeDismissed === 'true';
    const reports = await getAllReports(includeDismissed);
    res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
});

// Get post by Category 
router.get('/tag/:category', (req, res, next) => {
  const data = {
    category: req.params.category,
  };

  getPostByCategory(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// Saved posts & reactions 
router.get('/saved/:user_id', (req, res, next) => {
  const data = {
    user_id: req.params.user_id,
  };
  getSavedByUserID(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

router.get('/reaction/:user_id', (req, res, next) => {
  const data = {
    user_id: req.params.user_id,
  };
  getReactionByUserID(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// ======================== POLL POSTS ===========================
// get poll for a post
router.get('/:id/poll', (req, res, next) => {
  const data = {
    post_id: req.params.id,
  };

  getPollByPostID(data)
    .then(poll => {
      if (!poll) return res.status(404).json({ message: 'No poll found.' });
      res.status(200).json(poll);
    })
    .catch(next);
});

// create a poll for a post
router.post('/:id/poll', authenticateJWT, async (req, res, next) => {
  const { question, options } = req.body;

  if (!question || !Array.isArray(options) || options.length < 2) {
    return res.status(400).json({ message: 'A question and at least 2 options are required.' });
  }

  try {
    const poll = await insertPoll({ post_id: req.params.id, question });
    const insertedOptions = await Promise.all(
      options.map(opt => insertPollOption({ poll_id: poll.id, option_text: opt }))
    );
    poll.options = insertedOptions;
    res.status(201).json(poll);
  } catch (error) {
    console.error('Error creating poll:', error);
    next(error);
  }
});

// POST vote on a poll option
router.post('/:id/poll/vote', authenticateJWT, async (req, res, next) => {
  const { option_id, poll_id } = req.body;
  const user_id = req.user.id;

  if (!option_id || !poll_id) {
    return res.status(400).json({ message: 'option_id and poll_id are required.' });
  }

  try {
    const vote = await insertPollVote({ poll_id, option_id, user_id });
    const updatedPoll = await getPollByPostID({ post_id: req.params.id });
    res.status(201).json({ vote, poll: updatedPoll });
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'You have already voted on this poll.' });
    }
    next(error);
  }
});

// GET user's vote on a post's poll
router.get('/:id/poll/vote/:user_id', authenticateJWT, (req, res, next) => {
  const data = {
    post_id: req.params.id,
  };

  getPollByPostID(data)
    .then(poll => {
      if (!poll) return res.status(404).json({ message: 'No poll.' });
      return getUserPollVote({ poll_id: poll.id, user_id: req.params.user_id });
    })
    .then(vote => res.status(200).json({ vote: vote || null }))
    .catch(next);
});

// Get post by ID
router.get('/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
  };

  getPostByID(data)
    .then((post) => res.status(200).json(post))
    .catch(next);
});

// Get 3 random related posts
router.get('/related/:category/:id', (req, res, next) => {
  const data = {
    category: req.params.category,
    id: req.params.id,
  };

  getRelatedPosts(data)
    .then((posts) => res.status(200).json(posts))
    .catch(next);
});

// Creates new post
router.post('/', upload.single('attachment'), (req, res, next) => {
  if (
    req.body == undefined ||
    req.body.user_id == undefined ||
    req.body.title == undefined ||
    req.body.category == undefined ||
    req.body.content == undefined
  ) {
    res.status(400).json({ message: 'Error: user_id, title, category or content is undefined' });
    return;
  }

  const attachmentUrl = req.file ? `/uploads/${req.file.filename}` : null;

  const data = {
    user_id: req.body.user_id,
    title: req.body.title,
    category: req.body.category,
    content: req.body.content,
    attachment_url: attachmentUrl,
    gif_url: req.body.gif_url || null,
    is_anonymous: req.body.is_anonymous === 'true',
    visibility: req.body.visibility || 'everyone'
  };

  insertPost(data)
    .then(results => res.status(201).json({
      id: results.id,
      user_id: data.user_id,
      title: data.title,
      category: data.category,
      content: data.content,
      attachment_url: data.attachment_url,
      gif_url: data.gif_url
    }))
    .catch((error) => {
      console.error('Error insertPost:', error);
      res.status(500).json(error);
    });
});

// Update post (owner only)
router.put('/:id', upload.single('attachment'), (req, res, next) => {
  let attachmentUrl = req.body.attachment_url || null;
  let gifUrl = req.body.gif_url || null;

  getPostByID({ id: req.params.id })
    .then((existingPost) => {
      if (!existingPost) {
        return res.status(404).json({
          error: 'Post not found',
        });
      }

      attachmentUrl = existingPost.attachment_url;
      gifUrl = existingPost.gif_url || gifUrl;

      if (req.body.remove_attachment === 'true') {
        if (existingPost.attachment_url) {
          const oldPath = path.join(
            process.cwd(),
            'src',
            'public',
            existingPost.attachment_url.replace(/^\/+/, ''),
          );

          fs.unlink(oldPath, (err) => {
            if (err) {
              console.log('Old file delete skipped:', err.message);
            }
          });
        }
        attachmentUrl = null;
        gifUrl = null;
      }
      if (req.file) {
        if (existingPost.attachment_url) {
          const oldPath = path.join(
            process.cwd(),
            'src',
            'public',
            existingPost.attachment_url.replace(/^\/+/, ''),
          );

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
        attachment_url: attachmentUrl,
        gif_url: gifUrl,
        visibility: req.body.visibility || 'everyone',
      };
      return updatePostByID(data);
    })
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Post not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error updatePostByID:', error);
      res.status(500).json(error);
    });
});

// delete post (owner only)
router.delete('/:id', authenticateJWT, (req, res, next) => {
  const postId = req.params.id;
  // Check if user is admin or post owner
  getPostByID({ id: postId })
    .then((post) => {
      if (!post) return res.status(404).json({ error: 'Post not found' });
      if (req.user.role !== 'admin' && post.user_id !== req.user.id) {
        return res.status(403).json({ error: 'Not authorized to delete this post.' });
      }
      deletePostByID({ id: postId })
        .then((results) => {
          if (!results) return res.status(404).json({ error: 'Post not found' });
          res.status(200).json(results);
        })
        .catch((error) => {
          console.error('Error deletePostByID: ' + error);
          res.status(500).json(error);
        });
    })
    .catch((error) => {
      console.error('Error getPostByID: ' + error);
      res.status(500).json(error);
    });
});

//==================== post interactions (saves, likes, etc) ============================
//saves
// adds new save to saved posts
router.post('/saved', authenticateJWT, (req, res, next) => {
  if (!req.body?.post_id) {
    return res.status(400).json({ message: 'Error: post_id is undefined' });
  }
  const data = {
    user_id: req.user.id,
    post_id: req.body.post_id,
  };

  // saves new post
  insertSaved(data)
    .then((results) =>
      res.status(201).json({
        id: results.id,
        user_id: data.user_id,
        post_id: data.post_id,
      }),
    )
    .catch((error) => {
      console.error('Error insertSaved: ' + error);
      res.status(500).json(error);
    });
});

// remove a save
router.delete('/saved/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
  };
  deleteSavedByID(data)
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

// likes n dislikes
// creates like for a post
router.post('/like', authenticateJWT, (req, res, next) => {
  if (!req.body?.post_id) {
    return res.status(400).json({ message: 'Error: post_id is undefined' });
  }
  const data = {
    post_id: req.body.post_id,
    user_id: req.user.id,
    reaction_type: req.body.reaction_type,
  };

  // likes a post_id
  insertLike(data)
    .then((results) =>
      res.status(201).json({
        id: results.id,
        post_id: data.post_id,
        user_id: data.user_id,
        reaction_type: data.reaction_type,
      }),
    )
    .catch((error) => {
      console.error('Error insertLike: ' + error);
      res.status(500).json(error);
    });
});

// Update reaction type
router.put('/reaction/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.body.user_id,
    reaction_type: req.body.reaction_type,
  };

  updateReaction(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error updateReaction: ' + error);
      res.status(500).json(error);
    });
});

// remove a like or dislike
router.delete('/reaction/:id', (req, res, next) => {
  const data = {
    id: req.params.id,
    user_id: req.body.user_id,
  };
  deleteReaction(data)
    .then((results) => {
      if (!results) {
        return res.status(404).json({ error: 'Reaction not found' });
      }
      res.status(200).json(results);
    })
    .catch((error) => {
      console.error('Error deleteReaction: ' + error);
      res.status(500).json(error);
    });
});

// Toggle pin post (owner only)
router.post('/:id/pin', authenticateJWT, async (req, res, next) => {
  try {
    const postId = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(postId)) return res.status(400).json({ error: 'Invalid post id.' });
    const result = await togglePin(postId, req.user.id);
    if (!result) return res.status(404).json({ error: 'Post not found or not yours.' });
    res.status(200).json({ pinned: result.pinned });
  } catch (err) {
    next(err);
  }
});

// Report a post
router.post('/:id/report', (req, res, next) => {
  if (!req.body.user_id || !req.body.reason) {
    return res.status(400).json({ message: 'user_id and reason not found.' });
  }

  const data = {
    post_id: req.params.id,
    user_id: req.body.user_id,
    reason: req.body.reason,
    description: req.body.description || '',
  };

  insertReport(data)
    .then((result) => res.status(201).json(result))
    .catch((error) => {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'You have already reported this post.' });
      }
      console.error('Error insertReport:', error);
      res.status(500).json({ message: 'Failed to submit report.' });
    });
});

module.exports = router;
