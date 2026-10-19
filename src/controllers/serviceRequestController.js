const ServiceRequest = require('../models/ServiceRequest');
const User = require('../models/User');
const Category = require('../models/Category');

// Replaces the requester and category IDs with their readable details
const POPULATE = [
  { path: 'requester', select: 'name email role' },
  { path: 'category', select: 'name' },
];

// Builds an error with an HTTP status, which errorHandler will send to the client
function createError(message, status) {
  const err = new Error(message);
  err.status = status;
  return err;
}

// GET /requests: list requests, optionally filtered
// Examples: GET /requests?status=Open   GET /requests?priority=High
async function getAllRequests(req, res) {
  const filter = {};

  if (req.query.status) filter.status = req.query.status;
  if (req.query.priority) filter.priority = req.query.priority;
  if (req.query.category) filter.category = req.query.category;

  const requests = await ServiceRequest.find(filter)
    .populate(POPULATE)
    .sort({ date: -1 });

  res.json({
    success: true,
    count: requests.length,
    data: requests,
  });
}

// GET /requests/:id: get one request
async function getRequestById(req, res) {
  const request = await ServiceRequest.findById(req.params.id).populate(POPULATE);

  if (!request) {
    throw createError('Service request not found', 404);
  }

  res.json({ success: true, data: request });
}

// POST /requests: create a new request
async function createRequest(req, res) {
  const { requester, category, description, priority } = req.body;

  // Make sure the user and category exist before saving the request
  const [userExists, categoryExists] = await Promise.all([
    User.exists({ _id: requester }),
    Category.exists({ _id: category }),
  ]);

  if (!userExists) {
    throw createError('Requester not found', 400);
  }

  if (!categoryExists) {
    throw createError('Category not found', 400);
  }

  const request = await ServiceRequest.create({
    requester,
    category,
    description,
    priority,
  });

  await request.populate(POPULATE);

  res.status(201).json({ success: true, data: request });
}

// PATCH /requests/:id: update some fields of a request
async function updateRequest(req, res) {
  // Only these fields can be changed. Anything else in the body is ignored.
  const allowedFields = ['description', 'priority', 'status', 'category'];
  const updates = {};

  for (const field of allowedFields) {
    if (req.body[field] !== undefined) {
      updates[field] = req.body[field];
    }
  }

  if (Object.keys(updates).length === 0) {
    throw createError('No valid fields provided to update', 400);
  }

  const request = await ServiceRequest.findByIdAndUpdate(req.params.id, updates, {
    new: true,
    runValidators: true,
  }).populate(POPULATE);

  if (!request) {
    throw createError('Service request not found', 404);
  }

  res.json({ success: true, data: request });
}

// DELETE /requests/:id: remove a request
async function deleteRequest(req, res) {
  const request = await ServiceRequest.findByIdAndDelete(req.params.id);

  if (!request) {
    throw createError('Service request not found', 404);
  }

  res.json({
    success: true,
    message: 'Service request deleted',
    data: { id: request._id },
  });
}

// GET /requests/stats/unresolved-by-category: count unresolved requests per category
// This is the aggregation query the assignment asks for
async function getUnresolvedByCategory(req, res) {
  const results = await ServiceRequest.aggregate([
    // Stage 1: keep only requests that are not resolved
    { $match: { status: { $ne: 'Resolved' } } },

    // Stage 2: group them by category and count each group
    { $group: { _id: '$category', unresolvedCount: { $sum: 1 } } },

    // Stage 3: join with the categories collection to get the category name
    {
      $lookup: {
        from: 'categories',
        localField: '_id',
        foreignField: '_id',
        as: 'category',
      },
    },

    // Stage 4: turn the one-item array from the lookup into an object
    { $unwind: '$category' },

    // Stage 5: choose the fields to send back
    {
      $project: {
        _id: 0,
        categoryId: '$category._id',
        categoryName: '$category.name',
        unresolvedCount: 1,
      },
    },

    // Stage 6: biggest counts first
    { $sort: { unresolvedCount: -1 } },
  ]);

  res.json({ success: true, data: results });
}

module.exports = {
  getAllRequests,
  getRequestById,
  createRequest,
  updateRequest,
  deleteRequest,
  getUnresolvedByCategory,
};