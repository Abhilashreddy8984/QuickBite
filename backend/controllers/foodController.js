/**
 * QuickBite — Food Controller
 * Handles food catalog retrieval, filtering, search, pagination, and admin CRUD operations.
 */

const mongoose = require("mongoose");
const Food = require("../models/Food");

/**
 * @desc    Get all available food items (with filtering, search, and pagination)
 * @route   GET /api/foods
 * @access  Public
 */
async function getFoods(req, res, next) {
  try {
    const { category, search } = req.query;

    // Build filter query
    const filter = { isAvailable: true };

    // Category filter (case-insensitive regex)
    if (category && category.trim() !== "" && category.toLowerCase() !== "all") {
      filter.category = new RegExp(`^${category.trim()}$`, "i");
    }

    // Keyword search on name or description
    if (search && search.trim() !== "") {
      const searchRegex = new RegExp(search.trim(), "i");
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { category: searchRegex }
      ];
    }

    // Pagination parameters
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit, 10) || 12));
    const skip = (page - 1) * limit;

    // Execute query with total count
    const totalItems = await Food.countDocuments(filter);
    const totalPages = Math.ceil(totalItems / limit) || 1;

    const foods = await Food.find(filter)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(limit);

    return res.status(200).json({
      success: true,
      count: foods.length,
      totalItems,
      totalPages,
      currentPage: page,
      foods
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Get single food item by ID
 * @route   GET /api/foods/:id
 * @access  Public
 */
async function getFoodById(req, res, next) {
  try {
    const { id } = req.params;

    // Validate MongoDB ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food ID format."
      });
    }

    const food = await Food.findById(id);

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food item not found."
      });
    }

    return res.status(200).json({
      success: true,
      food
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Create a new food item
 * @route   POST /api/foods
 * @access  Private / Admin only
 */
async function createFood(req, res, next) {
  try {
    const { name, description, price, image, category, isAvailable, preparationTime } = req.body;

    // Validation
    if (!name || name.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Food item name is required."
      });
    }

    if (price === undefined || price === null || isNaN(price) || Number(price) < 0) {
      return res.status(400).json({
        success: false,
        message: "A valid non-negative price is required."
      });
    }

    if (!category || category.trim() === "") {
      return res.status(400).json({
        success: false,
        message: "Food category is required."
      });
    }

    const newFood = await Food.create({
      name: name.trim(),
      description: description ? description.trim() : "",
      price: Number(price),
      image: image ? image.trim() : "",
      category: category.trim(),
      isAvailable: isAvailable !== undefined ? Boolean(isAvailable) : true,
      preparationTime: preparationTime ? Number(preparationTime) : 20
    });

    return res.status(201).json({
      success: true,
      message: "Food item created successfully.",
      food: newFood
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Update an existing food item
 * @route   PUT /api/foods/:id
 * @access  Private / Admin only
 */
async function updateFood(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food ID format."
      });
    }

    // Validate price if provided in update payload
    if (req.body.price !== undefined && (isNaN(req.body.price) || Number(req.body.price) < 0)) {
      return res.status(400).json({
        success: false,
        message: "Price cannot be negative."
      });
    }

    const updatedFood = await Food.findByIdAndUpdate(id, req.body, {
      new: true,
      runValidators: true
    });

    if (!updatedFood) {
      return res.status(404).json({
        success: false,
        message: "Food item not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Food item updated successfully.",
      food: updatedFood
    });
  } catch (error) {
    next(error);
  }
}

/**
 * @desc    Delete a food item
 * @route   DELETE /api/foods/:id
 * @access  Private / Admin only
 */
async function deleteFood(req, res, next) {
  try {
    const { id } = req.params;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({
        success: false,
        message: "Invalid food ID format."
      });
    }

    const food = await Food.findByIdAndDelete(id);

    if (!food) {
      return res.status(404).json({
        success: false,
        message: "Food item not found."
      });
    }

    return res.status(200).json({
      success: true,
      message: "Food item deleted successfully."
    });
  } catch (error) {
    next(error);
  }
}

module.exports = {
  getFoods,
  getFoodById,
  createFood,
  updateFood,
  deleteFood
};
