import { Elysia } from "elysia";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
  createId,
} from "@uncorded/shared";
import { db } from "../db/index.js";
import { bots, user } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { disconnectUser } from "../ws/connections.js";
import { CloseCode } from "@uncorded/protocol";

// ── Schemas ──────────────────────────────────────────────────────────────────

const createBotSchema = z.object({
  name: z.string().trim().min(2).max(32),
  description: z.string().trim().max(200).optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

const BOT_LIMITS: Record<string, number> = {
  free: 1,
  supporter: 3,
  server_owner: 5,
};

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(24));
  const chars = Array.from(bytes, (b) => b.toString(36).padStart(2, "0")).join("").slice(0, 32);
  return `uncrd_${chars}`;
}

function hashToken(token: string): string {
  return new Bun.CryptoHasher("sha256").update(token).digest("hex");
}

function sanitizeUsername(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9_]/g, "_")
    .replace(/_+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 20);
}

// ── Routes ───────────────────────────────────────────────────────────────────

export const botRoutes = new Elysia({ prefix: "/api/bots" })
  .resolve(authResolve())

  // ── GET /api/bots — list user's bots ─────────────────────────────────
  .get("/", async ({ user: sessionUser }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot manage bots");
    }

    const rows = await db
      .select({
        id: bots.id,
        name: bots.name,
        description: bots.description,
        userId: bots.userId,
        tokenPrefix: bots.tokenPrefix,
        lastUsedAt: bots.lastUsedAt,
        createdAt: bots.createdAt,
        username: user.username,
      })
      .from(bots)
      .innerJoin(user, eq(bots.userId, user.id))
      .where(eq(bots.ownerId, sessionUser.id));

    return { bots: rows };
  })

  // ── POST /api/bots — create a new bot ────────────────────────────────
  .post("/", async ({ user: sessionUser, body, set }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot create bots");
    }

    if (!sessionUser.emailVerified) {
      throw new ForbiddenError("Verify your email to create bots");
    }

    const parsed = createBotSchema.safeParse(body);
    if (!parsed.success) {
      throw new ValidationError(parsed.error.issues[0]?.message ?? "Invalid input");
    }

    const tierKey = String(sessionUser.subscriptionTier);
    const limit = BOT_LIMITS[tierKey] ?? 1;

    const token = generateToken();
    const tokenH = hashToken(token);
    const tokenPfx = token.slice(0, 14); // "uncrd_" + 8 chars

    const botId = createId();
    const botUserId = createId();
    const shortId = botId.slice(0, 4);
    const username = `bot_${sanitizeUsername(parsed.data.name)}_${shortId}`;

    const result = await db.transaction(async (tx) => {
      // Check bot limit inside transaction to prevent races
      const [countRow] = await tx
        .select({ value: count() })
        .from(bots)
        .where(eq(bots.ownerId, sessionUser.id));

      if ((countRow?.value ?? 0) >= limit) {
        throw new ValidationError(
          `Bot limit reached (${limit} for ${sessionUser.subscriptionTier} tier)`,
        );
      }

      // Create user record for the bot
      const [botUser] = await tx
        .insert(user)
        .values({
          id: botUserId,
          name: parsed.data.name,
          username,
          displayUsername: username,
          email: `bot-${botId}@bots.uncorded.internal`,
          emailVerified: true,
          isBot: true,
          status: "offline",
        })
        .returning();

      if (!botUser) throw new InternalError("Failed to create bot user");

      // Create bot record
      const [bot] = await tx
        .insert(bots)
        .values({
          id: botId,
          ownerId: sessionUser.id,
          userId: botUserId,
          name: parsed.data.name,
          description: parsed.data.description ?? null,
          tokenHash: tokenH,
          tokenPrefix: tokenPfx,
        })
        .returning();

      if (!bot) throw new InternalError("Failed to create bot");

      return { bot, botUser };
    });

    set.status = 201;
    return {
      bot: {
        id: result.bot.id,
        name: result.bot.name,
        description: result.bot.description,
        userId: result.bot.userId,
        username: result.botUser.username,
        tokenPrefix: result.bot.tokenPrefix,
        createdAt: result.bot.createdAt,
      },
      token,
    };
  })

  // ── DELETE /api/bots/:id — delete a bot ──────────────────────────────
  .delete("/:id", async ({ user: sessionUser, params }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot delete bots");
    }

    const [bot] = await db
      .select()
      .from(bots)
      .where(and(eq(bots.id, params.id), eq(bots.ownerId, sessionUser.id)))
      .limit(1);

    if (!bot) throw new NotFoundError("Bot");

    // Disconnect the bot from WebSocket if connected
    disconnectUser(bot.userId, CloseCode.INVALID_SESSION, "Bot deleted");

    // Delete bot record first, then the bot's user record
    await db.transaction(async (tx) => {
      await tx.delete(bots).where(eq(bots.id, bot.id));
      await tx.delete(user).where(eq(user.id, bot.userId));
    });

    return { success: true };
  })

  // ── POST /api/bots/:id/regenerate-token — regenerate token ───────────
  .post("/:id/regenerate-token", async ({ user: sessionUser, params }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot regenerate tokens");
    }

    const [bot] = await db
      .select()
      .from(bots)
      .where(and(eq(bots.id, params.id), eq(bots.ownerId, sessionUser.id)))
      .limit(1);

    if (!bot) throw new NotFoundError("Bot");

    const token = generateToken();
    const tokenH = hashToken(token);
    const tokenPfx = token.slice(0, 14);

    await db
      .update(bots)
      .set({ tokenHash: tokenH, tokenPrefix: tokenPfx })
      .where(eq(bots.id, bot.id));

    // Disconnect bot — old token is now invalid
    disconnectUser(bot.userId, CloseCode.INVALID_SESSION, "Token regenerated");

    return { token, tokenPrefix: tokenPfx };
  });
