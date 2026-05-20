const express = require('express');
const router = express.Router();

//////////////////////////////////////////////////////
// TOKEN PRE-GENERATION
//////////////////////////////////////////////////////
router.post('/pre-token', (req, res, next) => {
  if (req.body.id == undefined) {
    return res.status(400).json({
      message: "id is undefined"
    });
  }
  res.locals.userId = req.body.id;
  next();
});

//////////////////////////////////////////////////////
// SEND TOKEN
//////////////////////////////////////////////////////
router.post('/send-token', (req, res) => {
  res.status(200).json({
    token: res.locals.token,
    userId: res.locals.userId,
    message: "Token generated"
  });
});

//////////////////////////////////////////////////////
// VERIFY TOKEN
//////////////////////////////////////////////////////
router.get('/verify-token', (req, res) => {
  res.status(200).json({
    userId: res.locals.userId,
    message: "Token verified"
  });
});

//////////////////////////////////////////////////////
// BCRYPT PRE-COMPARE
//////////////////////////////////////////////////////
router.post('/pre-compare', (req, res, next) => {
  if (req.body.hash == undefined) {
    return res.status(400).json({
      message: "hash is undefined"
    });
  }
  res.locals.hash = req.body.hash;
  next();
});

//////////////////////////////////////////////////////
// COMPARE SUCCESS
//////////////////////////////////////////////////////
router.post('/compare-success', (req, res) => {
  res.status(200).json({
    message: "Compare successful"
  });
});

//////////////////////////////////////////////////////
// HASH RESULT
//////////////////////////////////////////////////////
router.post('/hash', (req, res) => {
  res.status(200).json({
    hash: res.locals.hash,
    message: "Hash successful"
    });
});

module.exports = router;