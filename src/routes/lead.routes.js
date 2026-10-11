import { Router } from "express";
import {
  createLead,
  getLeads,
  getLeadById,
  updateLead,
  updateLeadStatus,
  assignLead,
  deleteLead,
  convertLead
} from "../controllers/lead.controller.js";
import { authenticate, authorize } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { ROLES } from "../utils/usedConstants.js";
import {
  createLeadSchema,
  updateLeadSchema,
  updateLeadStatusSchema,
  assignLeadSchema,
  convertLeadSchema,
  getLeadsQuerySchema
} from "../validators/lead.validator.js";

const router = Router();

router.use(authenticate);

router.post("/", validate({ body: createLeadSchema }), createLead);
router.get("/", validate({ query: getLeadsQuerySchema }), getLeads);
router.get("/:id", getLeadById);
router.put("/:id", validate({ body: updateLeadSchema }), updateLead);
router.patch("/:id", validate({ body: updateLeadSchema }), updateLead);
router.patch("/:id/status", validate({ body: updateLeadStatusSchema }), updateLeadStatus);
router.post("/:id/convert", validate({ body: convertLeadSchema }), convertLead);
router.patch(
  "/:id/assign",
  authorize(ROLES.ADMIN, ROLES.SALES_MANAGER),
  validate({ body: assignLeadSchema }),
  assignLead
);
router.delete("/:id", authorize(ROLES.ADMIN, ROLES.SALES_MANAGER), deleteLead);

export default router;
