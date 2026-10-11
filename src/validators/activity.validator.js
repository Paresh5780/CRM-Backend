import { z } from "zod";
import { ACTIVITY_TYPES, ACTIVITY_STATUSES, ENTITY_TYPES } from "../utils/usedConstants.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createActivitySchema = z.object({
  type: z.nativeEnum(ACTIVITY_TYPES, {
    required_error: "Activity type is required"
  }),
  title: z.string().trim().min(2, "Title must be at least 2 characters"),
  description: z.string().trim().optional(),
  entityType: z.nativeEnum(ENTITY_TYPES, {
    required_error: "Entity type is required"
  }),
  entityId: z.string().regex(objectIdRegex, "Valid entityId is required"),
  assignedTo: z.string().regex(objectIdRegex, "Valid assignedTo is required").optional(),
  dueDate: z.string().datetime().optional().nullable()
});

export const updateActivitySchema = z.object({
  type: z.nativeEnum(ACTIVITY_TYPES).optional(),
  title: z.string().trim().min(2, "Title must be at least 2 characters").optional(),
  description: z.string().trim().optional(),
  dueDate: z.string().datetime().optional().nullable()
});

export const getActivitiesQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  entityType: z.coerce.number().pipe(z.nativeEnum(ENTITY_TYPES)).optional(),
  entityId: z.string().regex(objectIdRegex, "Invalid entityId format").optional(),
  type: z.coerce.number().pipe(z.nativeEnum(ACTIVITY_TYPES)).optional(),
  status: z.coerce.number().pipe(z.nativeEnum(ACTIVITY_STATUSES)).optional(),
  assignedTo: z.string().regex(objectIdRegex, "Invalid assignedTo format").optional(),
  overdue: z.preprocess((val) => val === "true" || val === true, z.boolean()).optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
