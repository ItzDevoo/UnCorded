import { z } from "zod";

export const feedbackTypeSchema = z.enum(["feature", "bug"]);

export const feedbackStatusSchema = z.enum([
  "open",
  "in_progress",
  "completed",
  "rejected",
  "won_poll",
]);

export const createFeedbackSchema = z.object({
  type: feedbackTypeSchema,
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(2000),
});

export const updateFeedbackSchema = z.object({
  status: feedbackStatusSchema.optional(),
  adminNote: z.string().max(2000).nullable().optional(),
});
