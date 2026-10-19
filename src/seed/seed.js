require('dotenv').config();

const mongoose = require('mongoose');
const connectDB = require('../config/db');
const Category = require('../models/Category');
const User = require('../models/User');
const ServiceRequest = require('../models/ServiceRequest');

async function seed() {
  await connectDB();

  // Clear existing data so running the seed again doesn't create duplicates.
  // This deletes everything in these three collections, so use it on test data only.
  await Promise.all([
    ServiceRequest.deleteMany({}),
    User.deleteMany({}),
    Category.deleteMany({}),
  ]);

  const categories = await Category.insertMany([
    { name: 'IT Support', description: 'Computer, network, and login problems' },
    { name: 'Maintenance', description: 'Building, electrical, and plumbing issues' },
    { name: 'Library', description: 'Books, seating, and library systems' },
    { name: 'Transport', description: 'Campus shuttle and parking requests' },
  ]);

  const users = await User.insertMany([
    { name: 'Sharjeel Ahmed', email: 'sharjeel@campus.edu', role: 'student' },
    { name: 'Ayesha Khan', email: 'ayesha@campus.edu', role: 'student' },
    { name: 'Dr. Omar Malik', email: 'omar@campus.edu', role: 'staff' },
  ]);

  const [itSupport, maintenance, library, transport] = categories;
  const [sharjeel, ayesha, omar] = users;

  await ServiceRequest.insertMany([
    {
      requester: sharjeel._id,
      category: itSupport._id,
      description: 'Wi-Fi keeps disconnecting in the CS lab',
      priority: 'High',
      status: 'Open',
    },
    {
      requester: ayesha._id,
      category: itSupport._id,
      description: 'Cannot log in to the student portal',
      priority: 'Medium',
      status: 'In Progress',
    },
    {
      requester: omar._id,
      category: itSupport._id,
      description: 'Projector in room B-204 is not turning on',
      priority: 'High',
      status: 'Resolved',
    },
    {
      requester: sharjeel._id,
      category: maintenance._id,
      description: 'Air conditioner in the library reading room is leaking',
      priority: 'High',
      status: 'Open',
    },
    {
      requester: ayesha._id,
      category: maintenance._id,
      description: 'Broken light in the corridor near the cafeteria',
      priority: 'Low',
      status: 'Open',
    },
    {
      requester: omar._id,
      category: library._id,
      description: 'Several study desks on the second floor are damaged',
      priority: 'Medium',
      status: 'Open',
    },
    {
      requester: sharjeel._id,
      category: transport._id,
      description: 'Campus shuttle ran late on Monday morning',
      priority: 'Low',
      status: 'Resolved',
    },
  ]);

  console.log('Seed complete:');
  console.log(`  Categories:       ${categories.length}`);
  console.log(`  Users:            ${users.length}`);
  console.log('  Service requests: 7');

  await mongoose.connection.close();
}

seed()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error('Seed failed:', err.message);
    process.exit(1);
  });