import { eq } from "drizzle-orm";
import { UnauthorizedError, ForbiddenError } from "@uncorded/shared";
import { db } from "../db/index.js";
import { admins } from "../db/schema.js";
import { getSession } from "./auth.js";

/** Reusable `.resolve()` callback that gates routes behind admin authentication. */
export function adminResolve() {
  return async ({ request }: { request: Request }) => {
    const session = await getSession(request.headers);
    if (!session) {
      throw new UnauthorizedError();
    }

    if ((session.user as Record<string, unknown>).banned === true) {
      throw new ForbiddenError("Account banned");
    }

    const [adminRecord] = await db
      .select({ level: admins.level })
      .from(admins)
      .where(eq(admins.userId, session.user.id))
      .limit(1);

    if (!adminRecord) {
      throw new ForbiddenError("Admin access required");
    }

    return {
      user: session.user,
      session: session.session,
      adminLevel: adminRecord.level,
    };
  };
}
