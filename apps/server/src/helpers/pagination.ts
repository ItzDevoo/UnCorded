import { z } from "zod";
import { LIST_PAGE_LIMIT, LIST_FETCH_MAX_LIMIT } from "@uncorded/shared";

/** Offset/limit pagination for list endpoints (members, friends, DMs). */
export const paginationQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(LIST_FETCH_MAX_LIMIT).default(LIST_PAGE_LIMIT),
  offset: z.coerce.number().int().min(0).default(0),
});

/** Page-based pagination with a fixed page size (admin, feedback). */
export function pageQuerySchema(pageSize: number) {
  return z
    .object({ page: z.coerce.number().int().min(1).default(1) })
    .transform(({ page }) => ({ page, pageSize, offset: (page - 1) * pageSize }));
}

/** Page-based pagination with a client-adjustable page size. */
export function flexPageQuerySchema(defaults: { pageSize: number; maxPageSize: number }) {
  return z
    .object({
      page: z.coerce.number().int().min(1).default(1),
      pageSize: z.coerce.number().int().min(1).max(defaults.maxPageSize).default(defaults.pageSize),
    })
    .transform(({ page, pageSize }) => ({ page, pageSize, offset: (page - 1) * pageSize }));
}
