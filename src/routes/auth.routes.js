import { Router } from "express";
import {
  register,
  login,
  refreshToken,
  logout,
  getMe
} from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema
} from "../validators/auth.validator.js";

const router = Router();

router.post("/register", validate({ body: registerSchema }), register);
router.post("/login", validate({ body: loginSchema }), login);
router.post("/refresh-token", validate({ body: refreshTokenSchema }), refreshToken);

router.post("/logout", authenticate, logout);
router.get("/me", authenticate, getMe);

export default router;
