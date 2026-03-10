import { z } from "zod";

export const createDmSchema = z.object({ userId: z.string().min(1) });
