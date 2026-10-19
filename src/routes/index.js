const express = require('express');
const userRoutes = require('./userRoutes');
const categoryRoutes = require('./categoryRoutes');
const serviceRequestRoutes = require('./serviceRequestRoutes');

const router = express.Router();

// Each feature's routes are attached under its own path
router.use('/users', userRoutes);
router.use('/categories', categoryRoutes);
router.use('/requests', serviceRequestRoutes);

module.exports = router;