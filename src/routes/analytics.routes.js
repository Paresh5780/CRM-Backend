import { Router } from "express";
import {
  getDashboardSummary,
  getPipelineStageDistribution,
  getLeadsBySource,
  getTeamPerformance
} from "../controllers/analytics.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../utils/usedConstants.js";
import { analyticsQuerySchema } from "../validators/analytics.validator.js";

const router = Router();

router.use(authenticate);

router.get("/summary", validate({ query: analyticsQuerySchema }), getDashboardSummary);
router.get("/dashboard", validate({ query: analyticsQuerySchema }), getDashboardSummary);
router.get("/pipeline", validate({ query: analyticsQuerySchema }), getPipelineStageDistribution);
router.get("/leads-by-source", validate({ query: analyticsQuerySchema }), getLeadsBySource);
router.get(
  "/team-performance",
  authorize(ROLES.ADMIN, ROLES.SALES_MANAGER),
  validate({ query: analyticsQuerySchema }),
  getTeamPerformance
);

export default router;
