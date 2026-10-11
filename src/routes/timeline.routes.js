import { Router } from "express";
import { getTimeline } from "../controllers/timeline.controller.js";
import { authenticate } from "../middleware/auth.middleware.js";

const router = Router();

router.use(authenticate);

router.get("/:entityType/:entityId", getTimeline);

export default router;
