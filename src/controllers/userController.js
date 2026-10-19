const User = require('../models/User');

// GET /users: list all users, optionally filtered by role
// Example: GET /users?role=student
async function getUsers(req, res) {
  const filter = {};

  if (req.query.role) {
    filter.role = req.query.role;
  }

  const users = await User.find(filter).sort({ name: 1 });

  res.json({
    success: true,
    count: users.length,
    data: users,
  });
}

// GET /users/:id: get one user
async function getUserById(req, res) {
  const user = await User.findById(req.params.id);

  if (!user) {
    const err = new Error('User not found');
    err.status = 404;
    throw err;
  }

  res.json({ success: true, data: user });
}

// POST /users: create a new user
async function createUser(req, res) {
  const user = await User.create({
    name: req.body.name,
    email: req.body.email,
    role: req.body.role,
  });

  res.status(201).json({ success: true, data: user });
}

module.exports = { getUsers, getUserById, createUser };