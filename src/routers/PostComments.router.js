const express = require('express');
const { authenticateJWT } = require('../middlewares/auth.middleware');
const { checkAndAwardBadges } = require('../services/badgeService');

const {
  generatePandabotReply,
  getPandabotUserId,
  // PANDABOT_EMAIL,
} = require('../services/pandabot');
const { getPostByID } = require('../models/Posts.model');
const { getPersonByID } = require('../models/Person.model');
const Notification = require('../models/Notification.model');
const pool = require('../models/db');

// attachment support
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const commentUploadDir = path.join(__dirname, '../public/uploads/comments');
if (!fs.existsSync(commentUploadDir)) fs.mkdirSync(commentUploadDir, { recursive: true });

const commentStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, commentUploadDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});
const commentUpload = multer({ storage: commentStorage, limits: { fileSize: 8 * 1024 * 1024 } });

const {
  getAllComments,
  getCommentsByPostID,
  getCommentsByUserID,
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
  getAllCommentReports,
} = require('../models/PostComments.model');

const router = express.Router();

// Get all comments
router.get('/', (req, res, next) => {
  getAllComments()
    .then((Comments) => res.status(200).json(Comments))
    .catch(next);
});

// GET comments by user (for profile page)
router.get('/user/:user_id', authenticateJWT, (req, res, next) => {
  getCommentsByUserID({ user_id: req.params.user_id })
    .then((results) => res.status(200).json(results))
    .catch(next);
});

// comments interactions
// saving comments
// GET saved comments by user
router.get('/saved/:user_id', authenticateJWT, (req, res, next) => {
  if (Number(req.params.user_id) !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to view these saved comments.' });
  }
  getSavedCommentsByUserID({ user_id: req.params.user_id })
    .then((r) => res.status(200).json(r))
    .catch(next);
});

// Save a comment
router.post('/saved', authenticateJWT, (req, res) => {
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
      if (error.code === '23505') {
        return res.status(409).json({ message: 'You have already saved this post.' });
      }
      console.error('Error insertSavedComment: ' + error);
      res.status(500).json(error);
    });
});

// Unsave a comment
router.delete('/saved/:id', authenticateJWT, async (req, res) => {
  try {
    const result = await deleteSavedCommentByID({ id: req.params.id, user_id: req.user.id });
    if (!result) return res.status(404).json({ error: 'Save not found' });
    res.status(200).json(result);
  } catch (error) {
    console.error('Error deleteSavedByID: ' + error);
    res.status(500).json(error);
  }
});

// get comment reactions by user
router.get('/reaction/:user_id', authenticateJWT, (req, res, next) => {
  if (Number(req.params.user_id) !== req.user.id) {
    return res.status(403).json({ error: 'Not authorized to view these reactions.' });
  }

  getCommentReactionByUserID({ user_id: req.params.user_id })
    .then((r) => res.status(200).json(r))
    .catch(next);
});

// Insert comment reaction
router.post('/like', authenticateJWT, (req, res) => {
  if (!req.body?.comment_id) {
    return res.status(400).json({ message: 'Error: comment_id is undefined' });
  }

  const data = {
    comment_id: req.body.comment_id,
    user_id: req.user.id,
    reaction_type: req.body.reaction_type,
  };

  insertCommentLike(data)
    .then(async (results) => {
      res.status(201).json({
        id: results.id,
        comment_id: data.comment_id,
        user_id: data.user_id,
        reaction_type: data.reaction_type,
      });

      // Notify comment owner
      try {
        const { rows: commentRows } = await pool.query(
          `SELECT pc.user_id, pc.content, pc.post_id
           FROM "PostComments" pc
           WHERE pc.id = $1`,
          [data.comment_id],
        );

        const comment = commentRows[0];
        if (!comment) return;

        // Don't notify if user reacted to their own comment
        if (parseInt(comment.user_id) === parseInt(data.user_id)) return;

        const { rows: reactorRows } = await pool.query(
          `SELECT display_name, name FROM "Person" WHERE id = $1`,
          [data.user_id],
        );

        const reactorName = reactorRows[0]?.display_name || reactorRows[0]?.name || 'Someone';
        const emoji = data.reaction_type === 'like' ? '👍' : '👎';

        await Notification.create(parseInt(comment.user_id), {
          type: 'comment_reaction',
          title: `${reactorName} reacted ${emoji} to your comment`,
          body: comment.content?.slice(0, 120) || '',
          ref_id: comment.post_id,
        });
      } catch (e) {
        console.warn('Comment reaction notify error:', e.message);
      }
    })
    .catch((error) => {
      if (error.code === '23505') {
        return res.status(409).json({ message: 'You have already reacted to this post.' });
      }
      console.error('Error insertCommentLike: ' + error);
      res.status(500).json(error);
    });
});

// Update comment reaction
router.put('/reaction/:id', authenticateJWT, (req, res) => {
  const data = {
    id: req.params.id,
    user_id: req.user.id,
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
router.delete('/reaction/:id', authenticateJWT, (req, res) => {
  const data = {
    id: req.params.id,
    user_id: req.user.id,
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

// notifications for @mentions
async function notifyMentionedUsers(content, senderUserId, postId, commentId) {
  console.log(commentId);

  const mentions = [...content.matchAll(/@([a-zA-Z0-9_]+)/g)]
    .map((m) => m[1].toLowerCase())
    .filter((name) => name !== 'pandabot');

  if (!mentions.length) return;

  // Look up each mentioned username
  const { rows: mentionedUsers } = await pool.query(
    `SELECT id, name, display_name FROM "Person"
     WHERE LOWER(name) = ANY($1) AND id != $2`,
    [mentions, senderUserId],
  );

  // Get the sender's display name
  const { rows: senderRows } = await pool.query(
    `SELECT display_name, name FROM "Person" WHERE id = $1`,
    [senderUserId],
  );
  const senderName = senderRows[0]?.display_name || senderRows[0]?.name || 'Someone';

  // Notify each mentioned user
  await Promise.all(
    mentionedUsers.map((user) =>
      Notification.create(user.id, {
        type: 'mention',
        title: `${senderName} mentioned you in a comment: `,
        body: content.slice(0, 120),
        ref_id: postId,
      }),
    ),
  );
}

// Creates new comment under a post (post_id)
router.post('/:post_id', authenticateJWT, commentUpload.single('attachment'), (req, res) => {
  if (!req.params.post_id || !req.body.content) {
    return res.status(400).json({ message: 'Error: post_id or content is undefined' });
  }

  let attachment_url = req.body.attachment_url || null;
  if (req.file) {
    attachment_url = `/uploads/comments/${req.file.filename}`;
  }

  const data = {
    user_id: req.user.id,
    post_id: req.params.post_id,
    content: req.body.content,
    parent_comment_id: req.body.parent_comment_id || null,
    attachment_url,
  };

  insertComments(data)
    .then(async (results) => {
      res.status(201).json({
        id: results.id,
        user_id: data.user_id,
        commented_on: data.post_id,
        content: data.content,
        parent_comment_id: data.parent_comment_id,
        attachment_url: data.attachment_url,
      });

      const post = await getPostByID({ id: data.post_id });

      // Notify @mentioned
      try {
        await notifyMentionedUsers(data.content, data.user_id, data.post_id, results.id);
      } catch (e) {
        console.warn('Mention notify error:', e.message);
      }

      // award first_comment badge
      checkAndAwardBadges(parseInt(data.user_id), ['comment_created']);

      // Notify post owner
      try {
        if (post && parseInt(post.user_id) !== parseInt(data.user_id)) {
          const { rows: ownerNotifRows } = await pool.query(
            `SELECT display_name, name FROM "Person" WHERE id = $1`,
            [data.user_id],
          );
          const commenterName =
            ownerNotifRows[0]?.display_name || ownerNotifRows[0]?.name || 'Someone';
          await Notification.create(parseInt(post.user_id), {
            type: 'comment',
            title: `${commenterName} commented on your post: `,
            body: data.content.slice(0, 120),
            ref_id: data.post_id,
          });
        }
      } catch (e) {
        console.warn('Post owner notify error:', e.message);
      }

      // PandaBot
      const mentionsPandabot = /@pandabot/i.test(data.content);
      if (!mentionsPandabot) return;
      if (!post) return;

      // Get commenter's name
      const commenterRows = await getPersonByID({ id: data.user_id });
      const commenterName = commenterRows?.[0]?.name || 'there';

      // insert pandabot reply
      const botReply = await generatePandabotReply(post.content || post.title || '', data.content);
      const botReplyWithMention = `@${commenterName} ${botReply}`;
      const botUserId = await getPandabotUserId();
      const botReplyParentId = data.parent_comment_id || results.id;

      await insertComments({
        user_id: botUserId,
        post_id: data.post_id,
        content: botReplyWithMention,
        parent_comment_id: botReplyParentId,
        attachment_url: null,
      });

      // Notify user of bot reply
      await Notification.create(parseInt(data.user_id), {
        type: 'pandabot',
        title: 'PandaBot 🐼 replied to your comment: ',
        body: botReply.slice(0, 120),
        ref_id: data.post_id,
      });

      // award panda_bot badge
      checkAndAwardBadges(parseInt(data.user_id), ['pandabot_used']);
    })
    .catch((error) => {
      console.error('Error insertComments: ' + error);
      if (!res.headersSent) res.status(500).json(error);
    });
});

// Update Comments (owner only)
router.put('/:id', authenticateJWT, commentUpload.single('attachment'), (req, res) => {
  let attachment_url = req.body.attachment_url || null;

  if (req.file) {
    attachment_url = `/uploads/comments/${req.file.filename}`;
  }

  if (req.body.remove_attachment === 'true') {
    attachment_url = null;
  }

  const data = {
    id: req.params.id,
    user_id: req.user.id,
    content: req.body.content,
    attachment_url,
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
router.delete('/:id', authenticateJWT, (req, res) => {
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

// Get all comment reports (admin only)
router.get('/reports', authenticateJWT, async (req, res, next) => {
  try {
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({ message: 'Forbidden action' });
    }

    const includeDismissed = req.query.includeDismissed === 'true';
    const reports = await getAllCommentReports(includeDismissed);

    res.status(200).json(reports);
  } catch (err) {
    next(err);
  }
});

// Report a comment
router.post('/:id/report', authenticateJWT, async (req, res) => {
  if (!req.body.reason) {
    return res.status(400).json({ message: 'Reason not found.' });
  }

  const data = {
    comment_id: req.params.id,
    user_id: req.user.id,
    reason: req.body.reason,
    description: req.body.description || '',
  };

  try {
    const result = await insertCommentReport(data);
    res.status(201).json(result);
  } catch (error) {
    if (error.code === '23505') {
      return res.status(409).json({ message: 'You have already reported this comment.' });
    }
    console.error('Error insertCommentReport:', error);
    res.status(500).json({ message: 'Failed to submit report.' });
  }
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

module.exports = router;
