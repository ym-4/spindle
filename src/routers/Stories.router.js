const express = require('express');
const path = require('path');
const fs = require('fs');
const multer = require('multer');
const Stories = require('../models/Stories.model');
const { authenticateJWT } = require('../middleware/auth.middleware');

const router = express.Router();
const uploadDir = path.join(__dirname, '../public/uploads/stories');
fs.mkdirSync(uploadDir, { recursive: true });

const upload = multer({
  storage: multer.diskStorage({
    destination: uploadDir,
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname) || '.jpg';
      cb(null, `story-${req.user.id}-${Date.now()}${ext}`);
    },
  }),
  limits: { fileSize: 10 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (!file.mimetype.startsWith('image/')) return cb(new Error('Images only.'));
    cb(null, true);
  },
});

router.use(authenticateJWT);

router.get('/', async (req, res, next) => {
  try {
    await Stories.deleteExpired();
    const stories = await Stories.listFeed(req.user.id);
    res.status(200).json({ stories });
  } catch (err) {
    next(err);
  }
});

router.post('/', upload.single('media'), async (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'Upload an image for your status.' });
    const mediaUrl = `/uploads/stories/${req.file.filename}`;
    const caption = (req.body?.caption || '').trim();
    const story = await Stories.create(req.user.id, mediaUrl, caption);
    res.status(201).json({ story });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
