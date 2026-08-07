const express = require('express');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const router = express.Router();
const { authenticateJWT } = require('../middlewares/auth.middleware');

router.use(authenticateJWT);

const recordingDir = path.join(__dirname, '../public/uploads/recordings');
if (!fs.existsSync(recordingDir)) fs.mkdirSync(recordingDir, { recursive: true });

const recordingStorage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, recordingDir),
  filename: (req, file, cb) => cb(null, `${Date.now()}-${file.originalname}`),
});

const recordingUpload = multer({
  storage: recordingStorage,
  limits: { fileSize: 100 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['video/webm', 'video/mp4', 'video/ogg'];
    if (allowed.includes(file.mimetype)) cb(null, true);
    else cb(new Error('Only video files allowed'));
  },
});

// POST /upload — receive a screen-recording blob, store it, return its URL.
router.post('/', recordingUpload.single('file'), (req, res, next) => {
  try {
    if (!req.file) return res.status(400).json({ error: 'file is required' });
    res.status(201).json({ filePath: `/uploads/recordings/${req.file.filename}` });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
