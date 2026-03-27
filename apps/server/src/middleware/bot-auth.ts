import { eq } from "drizzle-orm";
import { db } from "../db/index.js";
import { bots, user } from "../db/schema.js";

export async function getBotSession(headers: Headers) {
  const auth = headers.get("Authorization");
  if (!auth?.startsWith("Bearer uncrd_")) return null;

  const token = auth.slice(7); // remove "Bearer "
  const hash = new Bun.CryptoHasher("sha256").update(token).digest("hex");

  const rows = await db
    .select()
    .from(bots)
    .innerJoin(user, eq(bots.userId, user.id))
    .where(eq(bots.tokenHash, hash))
    .limit(1);

  const row = rows[0];
  if (!row) return null;

  // Update lastUsedAt (fire and forget)
  db.update(bots)
    .set({ lastUsedAt: new Date() })
    .where(eq(bots.id, row.bots.id))
    .catch(() => {});

  return {
    user: row.user,
    bot: row.bots,
  };
}
