const Category = require('../models/Category');

// GET /categories: list all categories, sorted by name
async function getCategories(req, res) {
  const categories = await Category.find().sort({ name: 1 });

  res.json({
    success: true,
    count: categories.length,
    data: categories,
  });
}

// GET /categories/:id: get one category
async function getCategoryById(req, res) {
  const category = await Category.findById(req.params.id);

  if (!category) {
    const err = new Error('Category not found');
    err.status = 404;
    throw err;
  }

  res.json({ success: true, data: category });
}

// POST /categories: create a new category
async function createCategory(req, res) {
  // Pick the fields explicitly so the client can't set extra fields
  const category = await Category.create({
    name: req.body.name,
    description: req.body.description,
  });

  res.status(201).json({ success: true, data: category });
}

module.exports = { getCategories, getCategoryById, createCategory };