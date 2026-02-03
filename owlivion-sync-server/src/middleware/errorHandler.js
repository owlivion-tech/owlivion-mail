/**
 * Error Handler Middleware
 *
 * Centralized error handling for the API
 */

/**
 * Not Found handler (404)
 */
export const notFound = (req, res, next) => {
  const error = new Error(`Not Found - ${req.originalUrl}`);
  res.status(404);
  next(error);
};

/**
 * Error handler middleware
 */
export const errorHandler = (err, req, res, next) => {
  // Default to 500 if status code is not set
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  // Log error in development
  if (process.env.NODE_ENV === 'development') {
    console.error('Error:', err);
  }

  // Prepare error response
  const response = {
    success: false,
    error: err.message || 'Internal Server Error',
  };

  // Add stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  // Handle specific error types
  if (err.name === 'ValidationError') {
    response.errors = err.errors;
  }

  if (err.code === '23505') {
    // PostgreSQL unique violation
    response.error = 'Duplicate entry';
  }

  if (err.code === '23503') {
    // PostgreSQL foreign key violation
    response.error = 'Referenced record not found';
  }

  res.status(statusCode).json(response);
};

/**
 * Async handler wrapper
 * Catches async errors and passes them to error handler
 */
export const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

export default {
  notFound,
  errorHandler,
  asyncHandler,
};
