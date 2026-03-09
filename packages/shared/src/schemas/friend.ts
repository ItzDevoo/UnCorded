import { z } from "zod";

export const friendRequestSchema = z.object({ userId: z.string().min(1) });
