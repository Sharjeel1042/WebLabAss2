const express = require('express');
const validateObjectId = require('../middleware/validateObjectId');
const {
  getUsers,
  getUserById,
  createUser,
} = require('../controllers/userController');

const router = express.Router();

// GET /users: list all users (optional: ?role=student or ?role=staff)
router.get('/', getUsers);

// POST /users: create a user
router.post('/', createUser);

// GET /users/:id: get one user
router.get('/:id', validateObjectId, getUserById);

module.exports = router;