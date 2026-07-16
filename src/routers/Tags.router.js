const express = require('express');
const router = express.Router();
const Tag = require('../models/Tags.model.js');

// GET all tags — for autocomplete/filter chips
router.get('/tags', async (req, res) => {
  try {
    const tags = await Tag.getAllTags();
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch tags' });
  }
});

// GET listings filtered by tag
router.get('/marketplace/by-tag/:tagName', async (req, res) => {
  try {
    const listings = await Tag.getListingsByTag(req.params.tagName);
    res.json(listings);
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch listings' });
  }
});

// PUT tags on a listing (used in create/edit listing flow)
router.put('/listings/:id/tags', async (req, res) => {
  const { tags } = req.body; // expects array of strings
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });

  try {
    await Tag.setListingTags(req.params.id, tags);
    res.status(200).json({ message: 'Tags updated' });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update tags' });
  }
});

module.exports = router;