const express = require('express');
const router = express.Router();
const { createItem, getAllItems, updateItem, deleteItem } = require('../models/Marketplace.model');

// Create a new item
router.post('/', (req, res, next) => {
  const { seller_id, name, description, price } = req.body;
  createItem(seller_id, name, description, price)
    .then((item) => res.status(201).json(item))
    .catch(next);
});

// Retrieve all items
router.get('/', (req, res, next) => {
  getAllItems()
    .then((items) => res.status(200).json(items))
    .catch(next);
});

// Update an item
router.put('/:id', (req, res, next) => {
  const id = Number(req.params.id);
  const { name, price, description } = req.body;
  updateItem(id, { name, price, description })
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

// Add item to cart
router.post('/add', (req, res, next) => {
  const { seller_id, name, description, price } = req.body;
  createItem(seller_id, name, description, price)
    .then((item) => res.status(201).json(item))
    .catch(next);
});

module.exports = router;