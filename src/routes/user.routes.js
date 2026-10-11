import { Router } from "express";
import {
  createUser,
  getUsers,
  getUserById,
  updateUser,
  updateUserStatus,
  deleteUser
} from "../controllers/user.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../utils/usedConstants.js";
import {
  createUserSchema,
  updateUserSchema,
  updateStatusSchema,
  getUsersQuerySchema
} from "../validators/user.validator.js";

const router = Router();

router.use(authenticate, authorize(ROLES.ADMIN));

router.post("/", validate({ body: createUserSchema }), createUser);
router.get("/", validate({ query: getUsersQuerySchema }), getUsers);
router.get("/:id", getUserById);
router.put("/:id", validate({ body: updateUserSchema }), updateUser);
router.patch("/:id", validate({ body: updateUserSchema }), updateUser);
router.patch("/:id/status", validate({ body: updateStatusSchema }), updateUserStatus);
router.delete("/:id", deleteUser);

export default router;
