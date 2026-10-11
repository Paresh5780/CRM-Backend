import { z } from "zod";
import {
  LEAD_SOURCES,
  LEAD_STATUSES,
  LEAD_PRIORITIES,
  DEAL_STAGES
} from "../utils/usedConstants.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createLeadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  source: z.nativeEnum(LEAD_SOURCES).default(LEAD_SOURCES.WEBSITE),
  status: z.nativeEnum(LEAD_STATUSES).default(LEAD_STATUSES.NEW),
  priority: z.nativeEnum(LEAD_PRIORITIES).default(LEAD_PRIORITIES.MEDIUM),
  assignedTo: z
    .string()
    .regex(objectIdRegex, "Invalid assignedTo ObjectId format")
    .optional()
    .nullable(),
  description: z.string().trim().optional()
});

export const updateLeadSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  source: z.nativeEnum(LEAD_SOURCES).optional(),
  status: z.nativeEnum(LEAD_STATUSES).optional(),
  priority: z.nativeEnum(LEAD_PRIORITIES).optional(),
  description: z.string().trim().optional()
});

export const updateLeadStatusSchema = z.object({
  status: z.nativeEnum(LEAD_STATUSES, {
    required_error: "Status is required and must be valid"
  })
});

export const assignLeadSchema = z.object({
  assignedTo: z
    .string()
    .regex(objectIdRegex, "Invalid assignedTo ObjectId format")
    .nullable()
});

export const convertLeadSchema = z.object({
  dealName: z.string().trim().min(2, "Deal name must be at least 2 characters").optional(),
  dealValue: z.number().positive("Deal value must be greater than zero"),
  stage: z.nativeEnum(DEAL_STAGES).default(DEAL_STAGES.QUALIFICATION),
  probability: z.number().min(0).max(100).optional(),
  expectedClosingDate: z.string().datetime().optional().nullable(),
  address: z.string().trim().optional()
});

export const getLeadsQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  status: z.coerce.number().pipe(z.nativeEnum(LEAD_STATUSES)).optional(),
  priority: z.coerce.number().pipe(z.nativeEnum(LEAD_PRIORITIES)).optional(),
  source: z.coerce.number().pipe(z.nativeEnum(LEAD_SOURCES)).optional(),
  assignedTo: z
    .string()
    .regex(objectIdRegex, "Invalid assignedTo ObjectId format")
    .optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
