import { createAuthClient } from 'better-auth/solid';
import { usernameClient } from 'better-auth/client/plugins';
import { API_BASE } from './config.js';

export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
