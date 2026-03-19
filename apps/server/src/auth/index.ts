import { betterAuth } from "better-auth";
import { username } from "better-auth/plugins";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { createId } from "@uncorded/shared";
import { db } from "../db/index.js";
import { env } from "../env.js";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,
  // APP_URL always has a value (see env.ts default), so this array is never empty
  trustedOrigins: [env.APP_URL, env.CORS_ORIGIN].filter(Boolean) as string[],
  emailAndPassword: { enabled: true },
  plugins: [username()],
  socialProviders: {
    ...(env.DISCORD_CLIENT_ID &&
      env.DISCORD_CLIENT_SECRET && {
        discord: {
          clientId: env.DISCORD_CLIENT_ID,
          clientSecret: env.DISCORD_CLIENT_SECRET,
        },
      }),
    ...(env.GOOGLE_CLIENT_ID &&
      env.GOOGLE_CLIENT_SECRET && {
        google: {
          clientId: env.GOOGLE_CLIENT_ID,
          clientSecret: env.GOOGLE_CLIENT_SECRET,
        },
      }),
  },
  user: {
    additionalFields: {
      displayName: {
        type: "string",
        input: true,
        required: false,
      },
      avatarUrl: {
        type: "string",
        input: false,
        required: false,
      },
      status: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "offline",
      },
      subscriptionTier: {
        type: "string",
        input: false,
        required: false,
        defaultValue: "free",
      },
      banned: {
        type: "boolean",
        input: false,
        required: false,
        defaultValue: false,
      },
    },
  },
  advanced: {
    database: {
      generateId: () => createId(),
    },
    cookiePrefix: "uncorded",
    ...(env.AUTH_COOKIE_DOMAIN
      ? {
          crossSubDomainCookies: {
            enabled: true,
            domain: env.AUTH_COOKIE_DOMAIN,
          },
        }
      : {}),
  },
});
