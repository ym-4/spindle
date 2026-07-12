const express = require('express');
const axios = require('axios');

const router = express.Router();

router.get('/search', async (req, res) => {
  try {
    const q = req.query.q;

    const response = await axios.get('https://api.giphy.com/v1/gifs/search', {
      params: {
        api_key: process.env.GIPHY_API_KEY,
        q,
        limit: 20,
        rating: 'g',
      },
    });
    res.json(response.data.data);
  } catch (err) {
    console.error(err);
    res.status(500).json({
      message: 'Unable to search GIFs.',
    });
  }
});

module.exports = router;
