import { Router } from "express";
import {
  createDeal,
  getDeals,
  getDealById,
  updateDeal,
  updateDealStage,
  deleteDeal
} from "../controllers/deal.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../utils/usedConstants.js";
import {
  createDealSchema,
  updateDealSchema,
  updateDealStageSchema,
  getDealsQuerySchema
} from "../validators/deal.validator.js";

const router = Router();

router.use(authenticate);

router.post("/", validate({ body: createDealSchema }), createDeal);
router.get("/", validate({ query: getDealsQuerySchema }), getDeals);
router.get("/:id", getDealById);
router.put("/:id", validate({ body: updateDealSchema }), updateDeal);
router.patch("/:id", validate({ body: updateDealSchema }), updateDeal);
router.patch("/:id/stage", validate({ body: updateDealStageSchema }), updateDealStage);
router.delete("/:id", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), deleteDeal);

export default router;
