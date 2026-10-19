const express = require('express');
const validateObjectId = require('../middleware/validateObjectId');
const {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
  getUnresolvedByCategory,
} = require('../controllers/serviceRequestController');

const router = express.Router();

// Reports route: listed first so it's clearly separate from the /:id routes
// GET /requests/stats/unresolved-by-category
router.get('/stats/unresolved-by-category', getUnresolvedByCategory);

// GET /requests: list all requests (optional filters: ?status=Open&priority=High)
router.get('/', getAllRequests);

// POST /requests: create a request
router.post('/', createRequest);

// GET /requests/:id: get one request
router.get('/:id', validateObjectId, getRequestById);

// PATCH /requests/:id: update some fields of a request
router.patch('/:id', validateObjectId, updateRequest);

// DELETE /requests/:id: delete a request
router.delete('/:id', validateObjectId, deleteRequest);

module.exports = router;