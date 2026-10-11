import mongoose from "mongoose";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { ApiError } from "../utils/ApiError.js";

export function errorHandler(err, req, res, next) {
  let statusCode = err.statusCode || 500;
  let message = err.message || "Internal server error";
  let details = err.details;

  if (err instanceof ZodError) {
    statusCode = 400;
    message = "Validation failed";
    details = err.issues.map(({ path, message: issueMessage }) => ({
      path: path.join("."),
      message: issueMessage
    }));
  } else if (err instanceof mongoose.Error.ValidationError) {
    statusCode = 400;
    message = "Database validation failed";
    details = Object.values(err.errors).map((item) => ({
      path: item.path,
      message: item.message
    }));
  } else if (err instanceof mongoose.Error.CastError) {
    statusCode = 400;
    message = "Invalid resource identifier";
  } else if (err?.code === 11000) {
    statusCode = 409;
    message = "A record with this value already exists";
  } else if (!(err instanceof ApiError) && statusCode === 500) {
    message = "Internal server error";
  }

  if (env.NODE_ENV !== "production" && statusCode === 500) {
    console.error(err);
  }

  const body = { success: false, message };
  if (details !== undefined) body.details = details;
  if (env.NODE_ENV !== "production" && err.stack && statusCode === 500) {
    body.debug = { stack: err.stack };
  }

  res.status(statusCode).json(body);
}
