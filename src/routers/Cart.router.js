const express = require('express');
const router = express.Router();
const { addToCart, getAllUserCartItems } = require('../models/Cart.model');

// Add item to cart
router.post('/add', (req, res, next) => {
  const { seller_id, name, description, price } = req.body;
  addToCart(seller_id, name, description, price)
    .then((item) => res.status(201).json(item))
    .catch(next);
});

// Retrieve all items
router.get('/', (req, res, next) => {
  getAllUserCartItems()
    .then((items) => res.status(200).json(items))
    .catch(next);
});

module.exports = router;