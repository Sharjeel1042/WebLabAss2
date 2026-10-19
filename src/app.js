const path = require('path');
const express = require('express');
const routes = require('./routes');
const { notFound, errorHandler } = require('./middleware/errorHandler');

const app = express();

// 1. Read JSON request bodies into req.body
app.use(express.json());

// 2. A simple health check: open http://localhost:3000/ to confirm the server is running
app.get('/', (req, res) => {
  res.json({ success: true, message: 'Smart Campus Service API is running' });
});

// The frontend: open http://localhost:3000/app to use the web interface
app.use('/app', express.static(path.join(__dirname, '..', 'public')));

// 3. All feature routes: /users, /categories, /requests
app.use(routes);

// 4. Catch any URL that didn't match a route
app.use(notFound);

// 5. Turn every error into a JSON response (must be last)
app.use(errorHandler);

module.exports = app;