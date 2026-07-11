const express = require('express');
const router = express.Router();
const {
  createItem,
  getAllItems,
  updateItem,
  deleteItem,
  getAllItemsById,
} = require('../models/Marketplace.model');

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

module.exports = router;
