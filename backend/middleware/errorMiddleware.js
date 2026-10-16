/**
 * QuickBite — Error Handling Middleware
 * Provides JSON 404 handler and Centralized Error Handling.
 */

// Handle requests to non-existent API endpoints
function notFoundHandler(req, res, next) {
  const error = new Error(`Resource Not Found — ${req.method} ${req.originalUrl}`);
  res.status(404);
  next(error);
}

// Centralized error handler returning consistent JSON responses
function errorHandler(err, req, res, next) {
  // If status is still 200, default to 500
  const statusCode = res.statusCode === 200 ? 500 : res.statusCode;

  res.status(statusCode).json({
    success: false,
    message: err.message || "Internal Server Error",
    // Only include stack trace in non-production environments
    stack: process.env.NODE_ENV === "production" ? undefined : err.stack
  });
}

module.exports = { notFoundHandler, errorHandler };
