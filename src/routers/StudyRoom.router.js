const express = require('express');

const {
  getAllStudyRoomCharacters,
  getStudyRoomCharacter,
  getUserCharacter,
  updateUserCharacter,
  getUserCharacterParts,
  updateUserCharacterPart,
  deleteUserCharacterPart,
  deleteAllUserCharacterParts,
} = require('../models/StudyRoom.model');

const { authenticateJWT } = require('../middlewares/auth.middleware');

const router = express.Router();

// -------------------------------------------------------------
// Study Room Characters
// -------------------------------------------------------------

// GET all available study room characters
router.get('/characters', (req, res, next) => {
  getAllStudyRoomCharacters()
    .then((characters) => res.status(200).json(characters))
    .catch(next);
});

// GET one available study room character
router.get('/characters/:character_id', (req, res, next) => {
  const data = {
    character_id: req.params.character_id,
  };

  getStudyRoomCharacter(data)
    .then((character) => {
      if (!character) {
        return res.status(404).json({
          message: 'Character not found',
        });
      }

      res.status(200).json(character);
    })
    .catch(next);
});

// -------------------------------------------------------------
// User's Study Room Character
// -------------------------------------------------------------

// GET current user's character
router.get('/my-character', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
  };

  getUserCharacter(data)
    .then((character) => {
      if (!character) {
        return res.status(404).json({
          message: 'User has not selected a character',
        });
      }

      res.status(200).json(character);
    })
    .catch(next);
});

// Change current user's character
// Need: character_id
router.put('/my-character', authenticateJWT, async (req, res, next) => {
  try {
    if (req.body == undefined || req.body.character_id == undefined) {
      return res.status(400).json({
        message: 'Error: character_id is undefined',
      });
    }

    const data = {
      user_id: req.user.id,
      character_id: req.body.character_id,
    };

    const currentCharacter = await getUserCharacter({
      user_id: data.user_id,
    });

    const characterChanged =
      !currentCharacter || currentCharacter.character_id !== data.character_id;

    const result = await updateUserCharacter(data);

    // If switching characters, remove all parts from previous character
    if (characterChanged) {
      await deleteAllUserCharacterParts(data);
    }

    return res.status(200).json(result);
  } catch (error) {
    next(error);
  }
});

// -------------------------------------------------------------
// User's Character Parts
// -------------------------------------------------------------

// GET current user's selected character parts
router.get('/my-character/parts', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
  };

  getUserCharacterParts(data)
    .then((parts) => res.status(200).json(parts))
    .catch(next);
});

// Update current user's character part
// Need: option
router.put('/my-character/parts/:part', authenticateJWT, (req, res, next) => {
  if (req.body == undefined || req.body.option === undefined) {
    return res.status(400).json({
      message: 'Error: option is undefined',
    });
  }

  const data = {
    user_id: req.user.id,
    part: req.params.part,
    option: req.body.option,
  };

  updateUserCharacterPart(data)
    .then((result) => {
      res.status(200).json(result);
    })
    .catch(next);
});

router.delete('/my-character/parts/:part', authenticateJWT, (req, res, next) => {
  const data = {
    user_id: req.user.id,
    part: req.params.part,
  };

  deleteUserCharacterPart(data)
    .then(() => {
      // DELETE is idempotent.
      // Whether the row existed or not, the desired state is achieved.
      res.status(204).send();
    })
    .catch(next);
});

module.exports = router;
