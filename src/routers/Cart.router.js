const express = require('express');
const router = express.Router();
const { addToCart, getAllUserCartItems, getAllUserCartItemsById, removeCartItem, updateCartItem } = require('../models/Cart.model');

// Retrieve all items
router.get('/', (req, res, next) => {
  getAllUserCartItems()
    .then((items) => res.status(200).json(items))
    .catch(next);
});

// Retrieve all items by Id
router.get('/:user_id', (req, res, next) => {
  getAllUserCartItemsById(req.params.user_id)
    .then((items) => res.status(200).json(items))
    .catch(next);
});

// Add item to cart
router.post('/add/:user_id', (req, res, next) => {

  if (req.body == undefined || req.body.seller_id == undefined || req.body.item_id == undefined || req.params.user_id == undefined || req.body.amount == undefined) {
    res.status(400).json({"message": "Error: seller_id, item_id, user_id or amount is undefined"});
    return;
  }

  let data = {
    seller_id : req.body.seller_id,
    item_id : req.body.item_id,
    user_id : req.params.user_id,
    amount : req.body.amount
  }

  addToCart(data)
    .then((item) => res.status(201).json(item))
    .catch(next);
});

// Update an item in cart
router.put('/edit/:id/:user_id', (req, res, next) => {

  if (req.body == undefined || req.params.id == undefined || req.params.user_id == undefined || req.body.new_amount == undefined) {
    res.status(400).json({"message": "Error: item_id, user_id or amount is undefined"});
    return;
  }

  let data = {
    item_id : req.params.id,
    user_id : req.params.user_id,
    new_amount : req.body.new_amount
  }

  updateCartItem(data)
    .then((item) => {
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.status(200).json(item);
    })
    .catch(next);
});

// Remove item from cart
router.delete('/remove/:id/:user_id', (req, res, next) => {
  const id = Number(req.params.id);
  const user_id = Number(req.params.user_id);
  removeCartItem(id, user_id)
    .then((item) => {
      if (!item) return res.status(404).json({ error: 'Item not found' });
      res.status(200).json(item);
    })
    .catch(next);
});

module.exports = router;