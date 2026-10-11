import { verifyAccessToken } from "../utils/token.js";
import { User } from "../models/user.model.js";
import { ApiError } from "../utils/ApiError.js";
import { asyncHandler } from "../utils/asyncHandler.js";

export const authenticate = asyncHandler(async (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith("Bearer ")) {
    throw new ApiError(401, "Authentication token is required");
  }

  const token = authHeader.split(" ")[1];

  let decoded;
  try {
    decoded = verifyAccessToken(token);
  } catch (error) {
    if (error.name === "TokenExpiredError") {
      throw new ApiError(401, "Access token has expired");
    }
    throw new ApiError(401, "Invalid access token");
  }

  const user = await User.findById(decoded.id);

  if (!user) {
    throw new ApiError(401, "User belonging to this token no longer exists");
  }

  if (!user.isActive) {
    throw new ApiError(403, "User account is deactivated");
  }

  req.user = user;
  next();
});

export const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      return next(new ApiError(401, "User not authenticated"));
    }

    if (!roles.includes(req.user.role)) {
      return next(
        new ApiError(
          403,
          `Forbidden: Role '${req.user.role}' is not authorized to access this resource`
        )
      );
    }

    next();
  };
};
