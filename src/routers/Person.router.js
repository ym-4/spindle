const express = require('express');
const createError = require('http-errors');
const router = express.Router();

const {
  getAllPersons,
  getPersonByID,
  getPersonByName,
  getPersonByEmail,
  insertPerson,
  login,
  register,
} = require('../models/Person.model');

const bcryptMiddleware = require('../middlewares/bcryptMiddleware');
const { signToken } = require('../utils/jwt');

// GET ALL PERSONS
router.get('/', (req, res, next) => {
  getAllPersons()
    .then((results) => res.status(200).json(results))
    .catch(next);
});

router.get('/:id', (req, res, next) => {
  const id = Number.parseInt(req.params.id, 10);
  if (Number.isNaN(id)) {
    return next(createError(400, 'Invalid person id.'));
  }

  getPersonByID({ id })
    .then((persons) => {
      if (persons.length === 0) {
        return next(createError(404, 'Person not found.'));
      }
      res.status(200).json(persons[0]);
    })
    .catch(next);
});

// Creates new person
// Errors handled: same name or same email
// Request: name, email, bio, password
// Response: user_id, name, email, bio
router.post('/', (req, res, next) => {
  if (
    req.body == undefined ||
    req.body.name == undefined ||
    req.body.email == undefined ||
    req.body.bio == undefined ||
    req.body.password == undefined
  ) {
    return res.status(400).json({
      message: 'name, email, bio or password is undefined',
    });
  }

  const data = {
    name: req.body.name,
    email: req.body.email,
    bio: req.body.bio,
    password: req.body.password,
  };

  getPersonByName(data)
    .then((results) => {
      if (results.length > 0) {
        return res.status(409).json({
          message: 'Name already exists',
        });
      }
      return getPersonByEmail(data);
    })
    .then((results) => {
      if (results && results.length > 0) {
        return res.status(409).json({
          message: 'Email already exists',
        });
      }
      return insertPerson(data);
    })
    .then((results) => {
      if (!results) return;
      res.status(201).json({
        id: results[0].id,
        name: results[0].name,
        bio: results[0].bio,
      });
    })
    .catch((error) => {
      console.error('Create person error:', error);
      res.status(500).json(error);
    });
});

///////////////////////////////////////////////
// LOGIN
///////////////////////////////////////////////
router.post(
  '/login',
  (req, res, next) => {
    const requiredFields = ['name', 'password'];
    for (const field of requiredFields) {
      if (req.body == undefined || req.body[field] == undefined || req.body[field] === '') {
        return res.status(400).json({
          message: `${field} is undefined or empty`,
        });
      }
    }
    const data = {
      name: req.body.name,
    };

    login(data)
      .then((results) => {
        if (!results) {
          return res.status(404).json({
            message: 'User not found',
          });
        }
        res.locals.userId = results[0].id;
        res.locals.hash = results[0].hashed_password;
        next();
      })
      .catch((error) => {
        console.error('Login error:', error);
        res.status(500).json(error);
      });
  },
  bcryptMiddleware.comparePassword,
  (req, res, next) => {
    try {
      const userPayload = {
        id: res.locals.userId,
        name: req.body.name,
        email: req.body.email || '',
        role: 'user',
        sessionId: null,
      };

      const token = signToken(userPayload);

      res.status(200).json({
        message: 'Login successful',
        token: token,
        userId: res.locals.userId,
      });
    } catch (err) {
      next(err);
    }
  },
);

//////////////////////////////////////////////////////
// REGISTER
//////////////////////////////////////////////////////
router.post(
  '/register',
  (req, res, next) => {
    if (
      req.body.name == undefined ||
      req.body.email == undefined ||
      req.body.password == undefined
    ) {
      return res.status(400).json({
        message: 'name, email or password missing',
      });
    }
    next();
  },
  bcryptMiddleware.hashPassword,
  (req, res, next) => {
    const data = {
      name: req.body.name,
      email: req.body.email,
      bio: req.body.bio || '',
      hashed_password: res.locals.hash,
    };
    register(data)
      .then((results) => {
        res.locals.userId = results[0].id;
        next();
      })

      .catch((err) => {
        if (err.code === '23505') {
          return res.status(409).json({
            message: 'Email already exists',
          });
        }
        res.status(500).json(err);
      });
  },
  (req, res, next) => {
    try {
      const userPayload = {
        id: res.locals.userId,
        name: req.body.name,
        email: req.body.email,
        role: 'user',
        sessionId: null,
      };

      const token = signToken(userPayload);

      res.status(201).json({
        message: 'Registration successful',
        token: token,
        userId: res.locals.userId,
      });
    } catch (err) {
      next(err);
    }
  },
);

module.exports = router;
