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

export const createReportSchema = z
  .object({
    messageId: z.string().optional(),
    fileReceiptId: z.string().optional(),
    category: reportCategorySchema,
    details: z.string().trim().max(1000).optional(),
  })
  .refine((d) => (d.messageId ? 1 : 0) + (d.fileReceiptId ? 1 : 0) === 1, {
    message: "Provide exactly one of messageId or fileReceiptId",
  });

export type CreateReport = z.infer<typeof createReportSchema>;
