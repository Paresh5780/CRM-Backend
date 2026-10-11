import { z } from "zod";
import { CUSTOMER_STATUSES } from "../utils/usedConstants.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  address: z.string().trim().optional(),
  leadId: z.string().regex(objectIdRegex, "Invalid leadId format").optional().nullable(),
  assignedTo: z.string().regex(objectIdRegex, "Invalid assignedTo format").optional().nullable(),
  status: z.nativeEnum(CUSTOMER_STATUSES).default(CUSTOMER_STATUSES.ACTIVE)
});

export const updateCustomerSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  email: z.string().trim().email("Invalid email address").optional(),
  phone: z.string().trim().optional(),
  company: z.string().trim().optional(),
  address: z.string().trim().optional(),
  status: z.nativeEnum(CUSTOMER_STATUSES).optional()
});

export const getCustomersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  status: z.coerce.number().pipe(z.nativeEnum(CUSTOMER_STATUSES)).optional(),
  assignedTo: z.string().regex(objectIdRegex, "Invalid assignedTo format").optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
