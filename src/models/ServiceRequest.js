const mongoose = require('mongoose');

const PRIORITIES = ['Low', 'Medium', 'High'];
const STATUSES = ['Open', 'In Progress', 'Resolved'];

const serviceRequestSchema = new mongoose.Schema(
  {
    requester: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Requester is required'],
    },
    category: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Category',
      required: [true, 'Category is required'],
    },
    description: {
      type: String,
      required: [true, 'Description is required'],
      trim: true,
      minlength: [10, 'Description must be at least 10 characters'],
      maxlength: [1000, 'Description cannot exceed 1000 characters'],
    },
    priority: {
      type: String,
      enum: {
        values: PRIORITIES,
        message: '{VALUE} is not a valid priority. Use Low, Medium, or High.',
      },
      default: 'Medium',
    },
    status: {
      type: String,
      enum: {
        values: STATUSES,
        message: '{VALUE} is not a valid status. Use Open, In Progress, or Resolved.',
      },
      default: 'Open',
    },
    date: {
      type: Date,
      default: Date.now,
    },
  },
  { timestamps: true }
);

// Speeds up the "unresolved requests per category" query we'll write later
serviceRequestSchema.index({ status: 1, category: 1 });

module.exports = mongoose.model('ServiceRequest', serviceRequestSchema);