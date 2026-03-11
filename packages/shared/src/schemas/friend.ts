import { z } from "zod";
import { USERNAME_MAX } from "./user.js";

export const friendRequestSchema = z.object({ username: z.string().min(1).max(USERNAME_MAX) });
