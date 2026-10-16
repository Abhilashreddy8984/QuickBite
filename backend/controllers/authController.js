/**
 * QuickBite — Authentication Controller
 * Handles user registration, login, JWT token creation, and profile retrieval.
 */

const jwt = require("jsonwebtoken");
const User = require("../models/User");

/**
 * Generate stateless JSON Web Token signed with process.env.JWT_SECRET.
 * Payload includes user's MongoDB ID as userId with 1 hour expiration.
 */
function generateToken(userId) {
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret) {
    throw new Error("JWT_SECRET is missing from environment variables.");
  }

  return jwt.sign({ userId }, jwtSecret, {
    expiresIn: "1h"
  });
}

/**
 * @desc    Register a new user
 * @route   POST /api/auth/register
 * @access  Public
 */
async function registerUser(req, res, next) {
  try {
    const { name, email, password } = req.body;

    // Input validation
    if (!name || !email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide all required fields: name, email, and password."
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        success: false,
        message: "Password must be at least 6 characters long."
      });
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({
        success: false,
        message: "Please provide a valid email format."
      });
    }

    // Check if user already exists
    const userExists = await User.findOne({ email: email.toLowerCase() });
    if (userExists) {
      return res.status(409).json({
        success: false,
        message: "An account with this email address already exists. Please sign in instead."
      });
    }

    // Create user (password is automatically hashed via pre-save hook)
    const newUser = await User.create({
      name: name.trim(),
      email: email.toLowerCase().trim(),
      password: password
    });

    // Generate JWT token
    const token = generateToken(newUser._id);

    // Return safe response (NEVER return password or password hash)
    return res.status(201).json({
      success: true,
      message: "User registered successfully.",
      token: token,
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        createdAt: newUser.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Authenticate user & get token
 * @route   POST /api/auth/login
 * @access  Public
 */
async function loginUser(req, res, next) {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({
        success: false,
        message: "Please provide both email and password."
      });
    }

    // Find user by lowercase email
    const user = await User.findOne({ email: email.toLowerCase().trim() });

    if (!user) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials: No account found with this email."
      });
    }

    // Verify bcrypt password hash
    const isMatch = await user.matchPassword(password);
    if (!isMatch) {
      return res.status(401).json({
        success: false,
        message: "Invalid credentials: Incorrect password."
      });
    }

    // Generate JWT token
    const token = generateToken(user._id);

    // Return safe user profile and token
    return res.status(200).json({
      success: true,
      message: "Sign in successful.",
      token: token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        role: user.role,
        createdAt: user.createdAt
      }
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get current user profile
 * @route   GET /api/auth/profile
 * @access  Private (Protected by JWT)
 */
async function getProfile(req, res) {
  return res.status(200).json({
    success: true,
    user: req.user
  });
}

module.exports = {
  registerUser,
  loginUser,
  getProfile,
  generateToken
};
