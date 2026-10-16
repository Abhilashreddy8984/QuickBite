/**
 * QuickBite — Authentication Middleware
 * Protects private endpoints by verifying JSON Web Tokens (JWT).
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

async function protect(req, res, next) {
  let token;

  // Check for Bearer token in Authorization header
  if (
    req.headers.authorization &&
    req.headers.authorization.startsWith("Bearer ")
  ) {
    try {
      token = req.headers.authorization.split(" ")[1];

      // Validate that JWT_SECRET is available
      const jwtSecret = process.env.JWT_SECRET;
      if (!jwtSecret) {
        return res.status(500).json({
          success: false,
          message: "Internal Server Error: Authentication configuration is missing."
        });
      }

      // Verify token signature and expiry
      const decoded = jwt.verify(token, jwtSecret);

      // Verify payload structure (must contain userId)
      if (!decoded || !decoded.userId) {
        return res.status(401).json({
          success: false,
          message: "Access Denied: Invalid authentication token structure."
        });
      }

      // Fetch user from MongoDB excluding password
      const user = await User.findById(decoded.userId).select("-password");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "Access Denied: The user account for this token no longer exists."
        });
      }

      // Attach user object to request
      req.user = user;
      return next();
    } catch (error) {
      if (error.name === "TokenExpiredError") {
        return res.status(401).json({
          success: false,
          message: "Access Denied: Session token has expired. Please sign in again."
        });
      }

      return res.status(401).json({
        success: false,
        message: "Access Denied: Invalid authentication token."
      });
    }
  }

  // Token missing entirely
  return res.status(401).json({
    success: false,
    message: "Access Denied: No authorization token provided. Please include 'Authorization: Bearer <token>' header."
  });
}

/**
 * Authorize only users with admin role.
 * Must be preceded by protect middleware.
 */
function adminOnly(req, res, next) {
  if (req.user && req.user.role === "admin") {
    return next();
  }

  return res.status(403).json({
    success: false,
    message: "Access Denied: Admin authorization required."
  });
}

module.exports = { protect, adminOnly };

