import { z } from "zod";

const optionalUrl = z
  .string()
  .transform((s) => (s === "" ? undefined : s))
  .pipe(z.string().url().optional());

const optionalString = z
  .string()
  .transform((s) => (s === "" ? undefined : s))
  .pipe(z.string().optional());

const envSchema = z.object({
  // Required
  DATABASE_URL: z.string().url(),
  BETTER_AUTH_SECRET: z.string().min(32),
  BETTER_AUTH_URL: z.string().url(),
  APP_URL: z
    .string()
    .default("")
    .transform((s) => (s === "" ? "http://localhost:3000" : s))
    .pipe(z.string().url()),
  CORS_ORIGIN: optionalUrl,

  // Optional with defaults
  PORT: z.coerce.number().default(3000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  RATE_LIMIT_MAX: z.coerce.number().default(300),
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60_000),

  // OAuth — optional (social login disabled without them)
  DISCORD_CLIENT_ID: optionalString,
  DISCORD_CLIENT_SECRET: optionalString,
  GOOGLE_CLIENT_ID: optionalString,
  GOOGLE_CLIENT_SECRET: optionalString,

  // Redis — optional for now (needed later for presence/pubsub)
  UPSTASH_REDIS_URL: optionalString,
  UPSTASH_REDIS_TOKEN: optionalString,

  // Stripe — optional until billing is implemented
  STRIPE_SECRET_KEY: optionalString,
  STRIPE_WEBHOOK_SECRET: optionalString,
  STRIPE_SUPPORTER_PRICE_ID: optionalString,
  STRIPE_SERVER_OWNER_PRICE_ID: optionalString,

  // TURN relay — optional (paid users get relay credentials)
  TURN_SERVER_URL: optionalString,
  TURN_SHARED_SECRET: optionalString,

  // Cloudflare R2 — optional (avatars disabled without them)
  R2_ACCOUNT_ID: optionalString,
  R2_ACCESS_KEY_ID: optionalString,
  R2_SECRET_ACCESS_KEY: optionalString,
  R2_BUCKET_NAME: optionalString,
  R2_PUBLIC_URL: optionalUrl,
});

const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error("Invalid environment variables:");
  console.error(parsed.error.flatten().fieldErrors);
  process.exit(1);
}

if (parsed.data.NODE_ENV === "production" && parsed.data.APP_URL === "http://localhost:3000") {
  console.error(
    "APP_URL must be set explicitly in production (currently falling back to localhost)",
  );
  process.exit(1);
}

export const env = parsed.data;
