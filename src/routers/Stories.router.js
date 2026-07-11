const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Stories = require('../models/Stories.model');
const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();
var uploadDir = path.join(__dirname, '../public/uploads/stories');
fs.mkdirSync(uploadDir, { recursive: true });

var upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: function (req, file, cb) {
      var ext = path.extname(file.originalname) || '.jpg';
      cb(null, 'story-' + req.user.id + '-' + Date.now() + ext);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: function (req, file, cb) {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only.'));
    cb(null, true);
  },
});

router.use(authenticateJWT);

router.get('/', async function (req, res, next) {
  try {
    await Stories.deleteExpired();
    var result = await Stories.listFeed(req.user.id);
    res.status(200).json({ stories: result });
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('media'), async function (req, res, next) {
  try {
    var caption = (req.body?.caption || '').trim();
    var description = (req.body?.description || '').trim();
    var privacy = req.body?.privacy || 'public';
    var type = req.body?.type || 'image';
    var background = req.body?.background || null;

    if (!req.file && type === 'image') {
      return res.status(400).json({ error: 'Upload an image for your status.' });
    }

    var mediaUrl = req.file ? '/uploads/stories/' + req.file.filename : null;
    var story = await Stories.create(req.user.id, mediaUrl, caption, {
      type: type,
      background: background,
      privacy: privacy,
      description: description,
    });
    res.status(201).json({ story: story });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', async function (req, res, next) {
  try {
    var id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid story id.' });
    var caption = (req.body?.caption || '').trim();
    var description = (req.body?.description || '').trim();
    var story = await Stories.updateStory(id, req.user.id, caption, description);
    if (!story) return res.status(404).json({ error: 'Story not found or not yours.' });
    res.status(200).json({ story: story });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', async function (req, res, next) {
  try {
    var id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid story id.' });
    var result = await Stories.deleteStory(id, req.user.id);
    if (!result) return res.status(404).json({ error: 'Story not found or not yours.' });
    // Delete the uploaded file if it exists
    if (result.media_url) {
      var filePath = path.join(__dirname, '../public', result.media_url.replace(/^\/+/, ''));
      fs.unlink(filePath, function () { /* ignore if file doesn't exist */ });
    }
    res.status(200).json({ message: 'Story deleted.' });
  } catch (err) {
    next(err);
  }
});

router.post('/:id/view', async function (req, res, next) {
  try {
    var id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid story id.' });
    await Stories.addView(id, req.user.id);
    res.status(200).json({ message: 'View recorded.' });
  } catch (err) {
    next(err);
  }
});

/* ========================= DRAFTS ====================================== */

router.get('/drafts', async function (req, res, next) {
  try {
    var drafts = await Stories.listDrafts(req.user.id);
    res.status(200).json({ drafts: drafts });
  } catch (err) {
    next(err);
  }
});

router.post('/draft', upload.single('media'), async function (req, res, next) {
  try {
    var caption = (req.body?.caption || '').trim();
    var description = (req.body?.description || '').trim();
    var type = req.body?.type || 'text';
    var background = req.body?.background || null;

    var mediaUrl = req.file ? '/uploads/stories/' + req.file.filename : null;
    var draft = await Stories.create(req.user.id, mediaUrl, caption, {
      type: type,
      background: background,
      description: description,
      isDraft: true,
    });
    res.status(201).json({ draft: draft });
  } catch (err) {
    next(err);
  }
});

router.post('/draft/:id/publish', async function (req, res, next) {
  try {
    var id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid draft id.' });
    var story = await Stories.publishDraft(id, req.user.id);
    if (!story) return res.status(404).json({ error: 'Draft not found or not yours.' });
    res.status(200).json({ story: story });
  } catch (err) {
    next(err);
  }
});

router.delete('/draft/:id', async function (req, res, next) {
  try {
    var id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid draft id.' });
    var result = await Stories.deleteDraft(id, req.user.id);
    if (!result) return res.status(404).json({ error: 'Draft not found or not yours.' });
    if (result.media_url) {
      var filePath = path.join(__dirname, '../public', result.media_url.replace(/^\/+/, ''));
      fs.unlink(filePath, function () {});
    }
    res.status(200).json({ message: 'Draft deleted.' });
  } catch (err) {
    next(err);
  }
});

router.get('/:id/views', async function (req, res, next) {
  try {
    var id = Number.parseInt(req.params.id, 10);
    if (Number.isNaN(id)) return res.status(400).json({ error: 'Invalid story id.' });
    var views = await Stories.getViews(id, req.user.id);
    res.status(200).json(views);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
