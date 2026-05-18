const express = require('express');
const { searchAll } = require('../models/Search.model');
const router = express.Router();

// GET /search?q=keyword - search bar
router.get('/', (req, res, next) => {
  const query = req.query.q;
  if (!query || query.trim() === '') {
    return res.status(400).json({ message: 'Search query is required' });
  }

  searchAll(query.trim())
    .then(results => res.status(200).json(results))
    .catch(next);
});

module.exports = router;