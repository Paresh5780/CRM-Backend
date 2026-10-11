import { Router } from "express";
import {
  createActivity,
  getActivities,
  getActivityById,
  updateActivity,
  completeActivity,
  deleteActivity
} from "../controllers/activity.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../utils/usedConstants.js";
import {
  createActivitySchema,
  updateActivitySchema,
  getActivitiesQuerySchema
} from "../validators/activity.validator.js";

const router = Router();

router.use(authenticate);

router.post("/", validate({ body: createActivitySchema }), createActivity);
router.get("/", validate({ query: getActivitiesQuerySchema }), getActivities);
router.get("/:id", getActivityById);
router.put("/:id", validate({ body: updateActivitySchema }), updateActivity);
router.patch("/:id", validate({ body: updateActivitySchema }), updateActivity);
router.patch("/:id/complete", completeActivity);
router.delete("/:id", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), deleteActivity);

export default router;
