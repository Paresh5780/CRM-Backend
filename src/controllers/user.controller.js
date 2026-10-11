import { User } from "../models/user.model.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ROLES } from "../utils/usedConstants.js";

export const createUser = asyncHandler(async (req, res) => {
  const { name, email, password, phone, role, managerId } = req.body;

  const existing = await User.findOne({ email });
  if (existing) {
    throw new ApiError(409, "User with this email already exists");
  }

  if (managerId) {
    const manager = await User.findById(managerId);
    if (!manager) {
      throw new ApiError(404, "Designated manager was not found");
    }
    if (![ROLES.SALES_MANAGER, ROLES.ADMIN].includes(manager.role)) {
      throw new ApiError(400, "Designated manager must have sales_manager or admin role");
    }
  }

  const user = await User.create({
    name,
    email,
    password,
    phone: phone || "",
    role: role || ROLES.SALES_EXECUTIVE,
    managerId: managerId || null,
    isActive: true
  });

  return apiResponse(res, {
    statusCode: 201,
    message: "User created successfully",
    data: { user }
  });
});

export const getUsers = asyncHandler(async (req, res) => {
  const { page, limit, search, role, isActive, sortBy, sortOrder } = req.query;

  const filter = {};

  if (search) {
    filter.$or = [
      { name: { $regex: search, $options: "i" } },
      { email: { $regex: search, $options: "i" } }
    ];
  }

  if (role) {
    filter.role = role;
  }

  if (isActive !== undefined) {
    filter.isActive = isActive;
  }

  const skip = (page - 1) * limit;
  const sort = { [sortBy]: sortOrder === "asc" ? 1 : -1 };

  const [users, totalRecords] = await Promise.all([
    User.find(filter)
      .populate("managerId", "name email role")
      .sort(sort)
      .skip(skip)
      .limit(limit),
    User.countDocuments(filter)
  ]);

  const totalPages = Math.ceil(totalRecords / limit) || 1;

  return apiResponse(res, {
    statusCode: 200,
    message: "Users fetched successfully",
    data: { users },
    meta: {
      page,
      limit,
      totalRecords,
      totalPages
    }
  });
});

export const getUserById = asyncHandler(async (req, res) => {
  const { id } = req.params;

  const user = await User.findById(id).populate("managerId", "name email role");
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "User fetched successfully",
    data: { user }
  });
});

export const updateUser = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { name, phone, role, managerId } = req.body;

  const user = await User.findById(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  if (managerId) {
    if (managerId === id) {
      throw new ApiError(400, "A user cannot be assigned as their own manager");
    }
    const manager = await User.findById(managerId);
    if (!manager) {
      throw new ApiError(404, "Designated manager not found");
    }
  }

  if (name !== undefined) user.name = name;
  if (phone !== undefined) user.phone = phone;
  if (role !== undefined) user.role = role;
  if (managerId !== undefined) user.managerId = managerId;

  await user.save();

  return apiResponse(res, {
    statusCode: 200,
    message: "User updated successfully",
    data: { user }
  });
});

export const updateUserStatus = asyncHandler(async (req, res) => {
  const { id } = req.params;
  const { isActive } = req.body;

  if (req.user._id.toString() === id && isActive === false) {
    throw new ApiError(400, "Admins cannot deactivate their own account");
  }

  const user = await User.findByIdAndUpdate(
    id,
    { isActive },
    { new: true, runValidators: true }
  );

  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: `User ${isActive ? "activated" : "deactivated"} successfully`,
    data: { user }
  });
});

export const deleteUser = asyncHandler(async (req, res) => {
  const { id } = req.params;

  if (req.user._id.toString() === id) {
    throw new ApiError(400, "Admins cannot delete their own account");
  }

  const user = await User.findByIdAndDelete(id);
  if (!user) {
    throw new ApiError(404, "User not found");
  }

  return apiResponse(res, {
    statusCode: 200,
    message: "User deleted successfully",
    data: null
  });
});
