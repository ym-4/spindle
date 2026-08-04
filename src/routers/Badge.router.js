const express = require('express');
const { getBadgesForUser } = require('../models/Badge.model');
// const { getBadgesForUser, awardBadge } = require('../models/Badge.model');
// const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();

// get all badges for a user
router.get('/:user_id', (req, res, next) => {
  getBadgesForUser(req.params.user_id)
    .then((badges) => res.status(200).json(badges))
    .catch(next);
});

module.exports = router;
