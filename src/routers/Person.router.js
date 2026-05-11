const express = require('express');
const { getAllPersons } = require('../models/Person.model');
const router = express.Router();

<<<<<<< HEAD
// Get all person
=======
>>>>>>> 89177896b8afb5d8353af503dfd1b131ec4c0fbc
router.get('/', (req, res, next) => {
  getAllPersons()
    .then((persons) => res.status(200).json(persons))
    .catch(next);
});

<<<<<<< HEAD
// Get person by ID
router.get('/:id', (req, res, next) => {
  const data = {
    id: req.params.id
  }

  getPersonByID(data)
    .then((person) => res.status(200).json(person))
    .catch(next);
});


// Creates new person 
// Errors handled: same name or same email
// Request: name, email, avatar, password
// Response: user_id, name, email, avatar
router.post('/', (req, res, next) => {
  // missing required information
  if (req.body == undefined || req.body.name == undefined || req.body.email == undefined || req.body.avatar == undefined || req.body.password == undefined) {
    res.status(400).json({"message": "Error: name, email, avatar or password is undefined"});
    return;
  }
  
  const data = {
    name: req.body.name, 
    email: req.body.email, 
    avatar: req.body.avatar, 
    password: req.body.password
  }

  // Check that name doesn't already exist
  getPersonByName(data)
    .then((person) => {
      // name already exists
      if (person.length > 0) {
        return res.status(409).json({"message": "Error: Person with the same name already exists"});

      } else {
        // Check that email isn't already used 
        getPersonByEmail(data)
          .then((person) => {
            // email already exists
            if (person.length > 0) {
              return res.status(409).json({"message": "Error: Person with the same email already exists"});
            } else {
              // create person
              insertPerson(data)
                .then(results => res.status(201).json({
                  "id": results.insertId, 
                  "name": data.name, 
                  "avatar": data.avatar, 
                }))
                .catch((error) => {
                  console.error("Error insertPerson: " + error);
                  res.status(500).json(error);
                })
            }
          })
          
          .catch((error) => {
            console.error("Error getPersonByEmail: " + error);
            res.status(500).json(error);
          })
      }
    })

    .catch((error) => {
      console.error("Error getPersonByName: " + error);
      res.status(500).json(error);
    })
});

=======
>>>>>>> 89177896b8afb5d8353af503dfd1b131ec4c0fbc
module.exports = router;
