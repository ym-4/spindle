const express = require('express');
const router = express.Router();
const path = require('path');
const multer = require('multer');
const upload = require('../middlewares/upload');
const { createItem, getAllItems, updateItem, deleteItem, getAllItemsById, addImagesToItem, deleteItemImage, setItemTags, getItemsByTag, getRecommendedItems } = require('../models/Marketplace.model');

// Local storage config, scoped to marketplace image uploads only
const listingImageStorage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, path.join(__dirname, '../public/uploads/marketplace-uploads')); // change this path
  },
  filename: function (req, file, cb) {
    cb(null, Date.now() + '-' + file.originalname);
  },
});

const listingUpload = multer({ storage: listingImageStorage });

// Create a new item
router.post('/', (req, res, next) => {
  const { seller_id, name, description, price, quality, meetup } = req.body;
  createItem(seller_id, name, description, price, quality, meetup)
    .then((item) => res.status(201).json(item))
    .catch(next);
});

// Retrieve all items
router.get('/', (req, res, next) => {
  getAllItems()
    .then((items) => res.status(200).json(items))
    .catch(next);
});

// Set the tags on an item (replaces any existing tags for the item)
router.put('/:id/tags', (req, res, next) => {
  const { tags } = req.body; // expects array of strings
  if (!Array.isArray(tags)) return res.status(400).json({ error: 'tags must be an array' });

  setItemTags(req.params.id, tags)
    .then((attached) => res.status(200).json({ tags: attached }))
    .catch(next);
});

// Retrieve items filtered by tag name
router.get('/by-tag/:tagName', (req, res, next) => {
  getItemsByTag(req.params.tagName)
    .then((items) => res.status(200).json(items))
    .catch(next);
});

// Retrieve items by user id
router.get('/:id', (req, res, next) => {
  getAllItemsById(req.params.id)
    .then((items) => res.status(200).json(items))
    .catch(next);
});

// Update an item
router.put('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const { name, price, description, quality, meetup } = req.body;
  updateItem(id, { name, price, description, quality, meetup })
    .then((item) => {
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.status(200).json(item);
    })
    .catch(next);
});

// Upload images for an item (field name must be "images", max 6 files)
router.post('/:id/images', listingUpload.array('images', 6), (req, res, next) => {
  if (!req.files || req.files.length === 0) {
    return res.status(400).json({ error: 'No images uploaded' });
  }

  const imagePaths = req.files.map((file) => `/uploads/marketplace-uploads/${file.filename}`);

  addImagesToItem(req.params.id, imagePaths)
    .then((images) => res.status(201).json({ images }))
    .catch(next);
});

// Delete a single image from an item
router.delete('/:id/images/:imageId', (req, res, next) => {
  deleteItemImage(req.params.imageId, req.params.id)
    .then((image) => {
      if (!image) return res.status(404).json({ error: 'Image not found' });
      res.status(200).json(image);
    })
    .catch(next);
});

// Delete an item
router.delete('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  deleteItem(id)
    .then((item) => {
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.status(200).json(item);
    })
    .catch(next);
});

// Get up to 3 recommended items (tag-matched, falling back to random)
router.get('/:id/recommended', (req, res, next) => {
  const limit = Number(req.query.limit) || 4;
  getRecommendedItems(req.params.id, limit)
    .then((items) => res.status(200).json(items))
    .catch(next);
});

module.exports = router;
