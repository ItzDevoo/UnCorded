import { createAuthClient } from 'better-auth/solid';
import { usernameClient } from 'better-auth/client/plugins';

const API_BASE = import.meta.env.VITE_API_URL || 'http://localhost:3000';

export const authClient = createAuthClient({
  baseURL: API_BASE,
  plugins: [usernameClient()],
});

export const { signIn, signUp, signOut, useSession } = authClient;
