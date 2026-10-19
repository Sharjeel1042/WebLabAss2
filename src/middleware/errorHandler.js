// Runs when no route matches the URL
function notFound(req, res, next) {
  const err = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  err.status = 404;
  next(err);
}

// Turns every error into a clean JSON response
// Express requires all four parameters here, even though `next` is unused
function errorHandler(err, req, res, next) {
  let status = err.status || 500;
  let message = err.message;

  // Mongoose validation failed (for example, a required field is missing)
  if (err.name === 'ValidationError') {
    status = 400;
    message = Object.values(err.errors)
      .map((e) => e.message)
      .join('; ');
  }

  // Invalid value for a field, for example a category ID with the wrong format
  if (err.name === 'CastError') {
    status = 400;
    message = `Invalid value for ${err.path}: ${err.value}`;
  }

  // Duplicate value on a unique field (for example, an email that already exists)
  if (err.code === 11000) {
    status = 409;
    const field = Object.keys(err.keyValue)[0];
    message = `${field} already exists`;
  }

  // Malformed JSON in the request body
  if (err.type === 'entity.parse.failed') {
    status = 400;
    message = 'Malformed JSON in request body';
  }

  // Unexpected server errors: log the details, but don't expose them to the client
  if (status === 500) {
    console.error(err);
    message = 'Something went wrong on the server';
  }

  res.status(status).json({
    success: false,
    error: message,
  });
}

module.exports = { notFound, errorHandler };