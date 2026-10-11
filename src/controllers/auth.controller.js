import { User } from "../models/user.model.js";
import { generateTokens, verifyRefreshToken } from "../utils/token.js";
import { apiResponse } from "../utils/apiResponse.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { ROLES } from "../utils/usedConstants.js";

export const register = asyncHandler(async (req, res) => {
  const { name, email, password, phone } = req.body;

  const existingUser = await User.findOne({ email });
  if (existingUser) {
    throw new ApiError(409, "Email is already registered");
  }

  const user = await User.create({
    name,
    email,
    password,
    phone: phone || "",
    role: ROLES.SALES_EXECUTIVE,
    isActive: true
  });

  const tokens = generateTokens(user);

  return apiResponse(res, {
    statusCode: 201,
    message: "User registered successfully",
    data: {
      user,
      ...tokens
    }
  });
});

export const login = asyncHandler(async (req, res) => {
  const { email, password } = req.body;

  const user = await User.findOne({ email }).select("+password");
  if (!user) {
    throw new ApiError(401, "Invalid email or password");
  }

  if (!user.isActive) {
    throw new ApiError(403, "Account is deactivated. Please contact an administrator.");
  }

  const isPasswordValid = await user.comparePassword(password);
  if (!isPasswordValid) {
    throw new ApiError(401, "Invalid email or password");
  }

  const tokens = generateTokens(user);

  return apiResponse(res, {
    statusCode: 200,
    message: "Login successful",
    data: {
      user,
      ...tokens
    }
  });
});

export const refreshToken = asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  let decoded;
  try {
    decoded = verifyRefreshToken(refreshToken);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Refresh token has expired, please log in again");
    }
    throw new ApiError(401, "Invalid refresh token");
  }

  const user = await User.findById(decoded.id);
  if (!user || !user.isActive) {
    throw new ApiError(401, "User not found or account deactivated");
  }

  const tokens = generateTokens(user);

  return apiResponse(res, {
    statusCode: 200,
    message: "Token refreshed successfully",
    data: tokens
  });
});

export const logout = asyncHandler(async (req, res) => {
  return apiResponse(res, {
    statusCode: 200,
    message: "User Logged out successfully",
    data: null
  });
});

export const getMe = asyncHandler(async (req, res) => {
  return apiResponse(res, {
    statusCode: 200,
    message: "Current user profile fetched successfully",
    data: {
      user: req.user
    }
  });
});
