import { z } from "zod";

const objectIdRegex = /^[0-9a-fA-F]{24}$/;

export const analyticsQuerySchema = z.object({
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  assignedTo: z.string().regex(objectIdRegex, "Invalid assignedTo format").optional(),
  managerId: z.string().regex(objectIdRegex, "Invalid managerId format").optional()
});
