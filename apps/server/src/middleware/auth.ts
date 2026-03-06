import { Elysia } from 'elysia';
import { auth } from '../auth/index.js';

export const betterAuthPlugin = new Elysia({ name: 'better-auth' }).mount(auth.handler);

export async function getSession(headers: Headers) {
  return auth.api.getSession({ headers });
}
