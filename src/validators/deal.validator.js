import { z } from "zod";
import { DEAL_STAGES } from "../utils/usedConstants.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createDealSchema = z.object({
  name: z.string().trim().min(2, "Deal name must be at least 2 characters"),
  customerId: z.string().regex(objectIdRegex, "Valid customerId is required"),
  leadId: z.string().regex(objectIdRegex, "Invalid leadId format").optional().nullable(),
  value: z.number().positive("Deal value must be greater than zero"),
  probability: z.number().min(0).max(100).optional(),
  stage: z.nativeEnum(DEAL_STAGES).default(DEAL_STAGES.QUALIFICATION),
  expectedClosingDate: z.string().datetime().optional().nullable(),
  description: z.string().trim().optional()
});

export const updateDealSchema = z.object({
  name: z.string().trim().min(2, "Deal name must be at least 2 characters").optional(),
  value: z.number().positive("Deal value must be greater than zero").optional(),
  probability: z.number().min(0).max(100).optional(),
  expectedClosingDate: z.string().datetime().optional().nullable(),
  description: z.string().trim().optional()
});

export const updateDealStageSchema = z.object({
  stage: z.nativeEnum(DEAL_STAGES, {
    required_error: "Stage is required and must be a valid stage number"
  }),
  lossReason: z.string().trim().optional()
});

export const getDealsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  stage: z.coerce.number().pipe(z.nativeEnum(DEAL_STAGES)).optional(),
  customerId: z.string().regex(objectIdRegex, "Invalid customerId format").optional(),
  assignedTo: z.string().regex(objectIdRegex, "Invalid assignedTo format").optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
