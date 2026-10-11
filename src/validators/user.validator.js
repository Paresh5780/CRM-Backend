import { z } from "zod";
import { ROLES } from "../utils/usedConstants.js";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const createUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters"),
  email: z.string().trim().email("Invalid email address"),
  password: z.string().min(6, "Password must be at least 6 characters"),
  phone: z.string().trim().optional(),
  role: z.nativeEnum(ROLES).default(ROLES.SALES_EXECUTIVE),
  managerId: z
    .string()
    .regex(objectIdRegex, "Invalid managerId ObjectId format")
    .optional()
    .nullable()
});

export const updateUserSchema = z.object({
  name: z.string().trim().min(2, "Name must be at least 2 characters").optional(),
  phone: z.string().trim().optional(),
  role: z.nativeEnum(ROLES).optional(),
  managerId: z
    .string()
    .regex(objectIdRegex, "Invalid managerId ObjectId format")
    .optional()
    .nullable()
});

export const updateStatusSchema = z.object({
  isActive: z.boolean({ required_error: "isActive boolean is required" })
});

export const getUsersQuerySchema = z.object({
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(10),
  search: z.string().trim().optional(),
  role: z.coerce.number().pipe(z.nativeEnum(ROLES)).optional(),
  isActive: z
    .enum(["true", "false"])
    .optional()
    .transform((val) => (val === undefined ? undefined : val === "true")),
  sortBy: z.string().default("createdAt"),
  sortOrder: z.enum(["asc", "desc"]).default("desc")
});
