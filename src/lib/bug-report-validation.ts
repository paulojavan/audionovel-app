import { z } from "zod";

export const bugReportSchema = z.object({
  title: z.string().trim().min(3).max(120),
  description: z.string().trim().min(10).max(4000),
  pageUrl: z.string().trim().max(500).optional().or(z.literal("")),
});

export const bugReportStatusSchema = z.object({
  status: z.enum(["OPEN", "IN_REVIEW", "RESOLVED"]),
});
