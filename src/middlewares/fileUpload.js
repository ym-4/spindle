const multer = require('multer');
const path = require('path');

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, path.join(__dirname, '../public/uploads/group_files'));
  },

  filename: (req, file, cb) => {
    // Replace spaces with underscores
    let cleanName = file.originalname.replace(/\s+/g, '_');

    // Remove characters that aren't letters, numbers, dots, underscores or hyphens
    cleanName = cleanName.replace(/[^a-zA-Z0-9._-]/g, '');

    // Add timestamp
    const uniqueName = `${Date.now()}-${cleanName}`;

    cb(null, uniqueName);
  },
});

const fileFilter = (req, file, cb) => {
  const allowedTypes = [
    // Images
    'image/png',
    'image/jpeg',
    'image/jpg',
    'image/gif',
    'image/webp',

    // PDF
    'application/pdf',

    // Word
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',

    // PowerPoint
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',

    // Excel
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',

    // Text
    'text/plain',

    // ZIP
    'application/zip',
    'application/x-zip-compressed',
  ];

  if (allowedTypes.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('File type not accepted'));
  }
};

module.exports = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: 20 * 1024 * 1024, // 20 MB
  },
});
