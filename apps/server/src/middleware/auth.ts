import { Elysia } from "elysia";
import { UnauthorizedError } from "@uncorded/shared";
import { auth } from "../auth/index.js";

export const betterAuthPlugin = new Elysia({ name: "better-auth" }).mount(auth.handler);

export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}

/** Reusable `.resolve()` callback that gates routes behind authentication. */
export function authResolve() {
  return async ({ request }: { request: Request }) => {
    const session = await getSession(request.headers);
    if (!session) {
      throw new UnauthorizedError();
    }
    return {
      user: session.user,
      session: session.session,
    };
  };
}
