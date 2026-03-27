import { Elysia } from "elysia";
import { UnauthorizedError, ForbiddenError } from "@uncorded/shared";
import { auth } from "../auth/index.js";
import { getBotSession } from "./bot-auth.js";

export const betterAuthPlugin = new Elysia({ name: "better-auth" }).mount(auth.handler);

export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

/** Reusable `.resolve()` callback that gates routes behind authentication. */
export function authResolve() {
  return async ({ request }: { request: Request }) => {
    // Try session auth first (existing flow)
    const session = await getSession(request.headers);

    if (!session) {
      // Try bot token auth as fallback
      const botSession = await getBotSession(request.headers);
      if (botSession) {
        if ((botSession.user as Record<string, unknown>).banned === true) {
          throw new ForbiddenError("Account banned");
        }
        return { user: botSession.user, session: null };
      }
      throw new UnauthorizedError();
    }

    // Block banned users from all authenticated endpoints
    if ((session.user as Record<string, unknown>).banned === true) {
      throw new ForbiddenError("Account banned");
    }

    return {
      user: session.user,
      session: session.session,
    };
  };
}
