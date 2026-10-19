const express = require('express');
const validateObjectId = require('../middleware/validateObjectId');
const {
  getCategories,
  getCategoryById,
  createCategory,
} = require('../controllers/categoryController');

const router = express.Router();

// GET /categories: list all categories
router.get('/', getCategories);

// POST /categories: create a category
router.post('/', createCategory);

// GET /categories/:id: get one category
// validateObjectId runs first, so an invalid ID gets a 400 before the database is queried
router.get('/:id', validateObjectId, getCategoryById);

module.exports = router;