const express = require('express');
const createError = require('http-errors');
const { getAllPersons, getPersonByID } = require('../models/Person.model');

const router = express.Router();

router.get('/', (req, res, next) => {
  getAllPersons()
    .then((persons) => res.status(200).json(persons))
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

module.exports = router;
