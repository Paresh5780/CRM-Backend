import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function generateTokens(user) {
  const payload = {
    id: user._id.toString(),
    role: user.role,
    email: user.email
  };

  const accessToken = jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_EXPIRES_IN
  });

  const refreshToken = jwt.sign({ id: user._id.toString() }, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_EXPIRES_IN
  });

  return { accessToken, refreshToken };
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.JWT_ACCESS_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
}
