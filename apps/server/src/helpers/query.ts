import { NotFoundError } from "@uncorded/shared";
import { user } from "../db/schema.js";

export const userPublicFields = {
  id: user.id,
  username: user.username,
  displayName: user.displayName,
  avatarUrl: user.avatarUrl,
  status: user.status,
};

export async function findOrThrow<T>(
  query: Promise<T[]>,
  entityName: string,
): Promise<T> {
  const [row] = await query;
  if (!row) throw new NotFoundError(entityName);
  return row;
}
