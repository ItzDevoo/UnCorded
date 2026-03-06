import { Elysia } from 'elysia';
import { auth } from '../auth/index.js';

const BETTER_AUTH_ACCEPT_METHODS = ['POST', 'GET'];

export const betterAuthPlugin = new Elysia({ name: 'better-auth' }).all(
  '/api/auth/*',
  (context) => {
    if (!BETTER_AUTH_ACCEPT_METHODS.includes(context.request.method)) {
      context.set.status = 405;
      return { code: 'METHOD_NOT_ALLOWED', message: 'Method not allowed' };
    }
    return auth.handler(context.request);
  },
);

export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
