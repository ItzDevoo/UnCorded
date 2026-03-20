import { z } from "zod";

export const reportCategorySchema = z.enum([
  "csam",
  "intimate_image",
  "harassment",
  "spam",
  "copyright",
  "malware",
  "other",
]);

export type ReportCategory = z.infer<typeof reportCategorySchema>;

export const reportTypeSchema = z.enum(["message", "file", "player", "server"]);

export type ReportType = z.infer<typeof reportTypeSchema>;

export const createReportSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("message"),
    messageId: z.string().min(1),
    category: reportCategorySchema,
    details: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("file"),
    fileReceiptId: z.string().min(1),
    category: reportCategorySchema,
    details: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("player"),
    targetUserId: z.string().min(1),
    category: reportCategorySchema,
    details: z.string().trim().max(1000).optional(),
  }),
  z.object({
    type: z.literal("server"),
    serverId: z.string().min(1),
    category: reportCategorySchema,
    details: z.string().trim().max(1000).optional(),
  }),
]);

export type CreateReport = z.infer<typeof createReportSchema>;
