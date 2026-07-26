const express = require('express');
const router = express.Router();
const { createOrder, getOrderById, getOrderItems } = require('../models/Orders.model');

function luhnCheck(num) {
  let sum = 0;
  let alt = false;
  for (let i = num.length - 1; i >= 0; i--) {
    let n = parseInt(num[i], 10);
    if (alt) {
      n *= 2;
      if (n > 9) n -= 9;
    }
    sum += n;
    alt = !alt;
  }
  return sum % 10 === 0;
}

// Mock checkout — no real payment is ever sent anywhere.
router.post('/checkout', async (req, res, next) => {
  try {
    const { buyer_id, cardNumber, expiry, cvv, items } = req.body;

    if (!buyer_id || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ success: false, error: 'Missing buyer or cart items' });
    }

    const cleanedCard = String(cardNumber || '').replace(/\s/g, '');
    if (!/^\d{16}$/.test(cleanedCard) || !luhnCheck(cleanedCard)) {
      return res.status(400).json({ success: false, error: 'Invalid card number' });
    }
    if (!/^\d{3,4}$/.test(String(cvv || ''))) {
      return res.status(400).json({ success: false, error: 'Invalid CVV' });
    }
    if (!/^\d{2}\/\d{2}$/.test(String(expiry || ''))) {
      return res.status(400).json({ success: false, error: 'Invalid expiry format, use MM/YY' });
    }

    // Simulate network latency, like a real payment gateway call
    await new Promise((resolve) => setTimeout(resolve, 1200));

    // Simulate a decline scenario — cards ending in 0000 always fail (handy for demos)
    if (cleanedCard.endsWith('0000')) {
      return res.status(402).json({ success: false, error: 'Card declined' });
    }

    const total = items.reduce((sum, i) => sum + Number(i.price) * Number(i.quantity), 0);
    const paymentRef = `MOCK-${Date.now()}-${Math.floor(Math.random() * 100000)}`;

    const order = await createOrder(buyer_id, total, paymentRef, items);
    res.status(200).json({ success: true, order, paymentRef, last4: cleanedCard.slice(-4) });
  } catch (err) {
    next(err);
  }
});

router.get('/orders/:id', async (req, res, next) => {
  try {
    const order = await getOrderById(req.params.id);
    if (!order) return res.status(404).json({ error: 'Order not found' });
    const orderItems = await getOrderItems(req.params.id);
    res.status(200).json({ ...order, items: orderItems });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
