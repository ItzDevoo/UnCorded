import { z } from "zod";
import { LIST_PAGE_LIMIT, LIST_FETCH_MAX_LIMIT } from "@uncorded/shared";

export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_FETCH_MAX_LIMIT).default(LIST_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});
