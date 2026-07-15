const express = require('express');
const { searchAll } = require('../models/Search.model');
const router = express.Router();

// GET /search?q=keyword - search bar
router.get('/', (req, res, next) => {
  const query = req.query.q;
  if (!query || query.trim() === '') {
    return res.status(400).json({ message: 'Search query is required' });
  }

  const data = {
    query: query.trim(),
    category: req.query.category ? req.query.category.split(',').filter(Boolean) : null,
    date_from: req.query.date_from || null,
    date_to: req.query.date_to || null,
    sort: req.query.sort || 'newest',
  };

  searchAll(data)
    .then((results) => res.status(200).json(results))
    .catch(next);
});

module.exports = router;
