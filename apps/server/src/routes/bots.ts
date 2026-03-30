import { Elysia } from "elysia";
import { eq, and, count } from "drizzle-orm";
import { z } from "zod";
import {
  ValidationError,
  NotFoundError,
  ForbiddenError,
  InternalError,
  AppError,
  createId,
  MAX_AVATAR_SIZE_BYTES,
  ALLOWED_AVATAR_TYPES,
  BOT_LIMITS,
  type BotTier,
  BOT_TOKEN_BYTE_LENGTH,
  BOT_TOKEN_PREFIX_LENGTH,
} from "@uncorded/shared";
import { isR2Configured, uploadAvatar, deleteAvatar } from "../lib/r2.js";
import { db } from "../db/index.js";
import { bots, user, members } from "../db/schema.js";
import { authResolve } from "../middleware/auth.js";
import { disconnectUser, broadcastToServer } from "../ws/connections.js";
import { removeServerMember } from "../ws/server-members.js";
import { CloseCode, Opcode, serverId, userId } from "@uncorded/protocol";

// ── Schemas ──────────────────────────────────────────────────────────────────

const createBotSchema = z.object({
  name: z.string().trim().min(2).max(32),
  description: z.string().trim().max(200).optional(),
});

// ── Helpers ──────────────────────────────────────────────────────────────────

function generateToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(BOT_TOKEN_BYTE_LENGTH));
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
        avatarUrl: user.avatarUrl,
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

    const tierKey = sessionUser.subscriptionTier as BotTier;
    const limit = BOT_LIMITS[tierKey] ?? 1;

    const token = generateToken();
    const tokenH = hashToken(token);
    const tokenPfx = token.slice(0, BOT_TOKEN_PREFIX_LENGTH); // "uncrd_" + 8 chars

    const botId = createId();
    const botUserId = createId();
    const shortId = botId.slice(0, 4);
    const username = `bot_${sanitizeUsername(parsed.data.name)}_${shortId}`;

    const result = await db.transaction(async (tx) => {
      // Lock owner row to serialize concurrent bot creates per-owner
      await tx
        .select({ id: user.id })
        .from(user)
        .where(eq(user.id, sessionUser.id))
        .for("update");

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
          displayName: parsed.data.name,
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

    // Clean up server memberships so clients get MEMBER_REMOVE broadcasts
    const botMemberships = await db
      .select({ serverId: members.serverId })
      .from(members)
      .where(eq(members.userId, bot.userId));

    for (const m of botMemberships) {
      removeServerMember(m.serverId, bot.userId);
      broadcastToServer(m.serverId, {
        op: Opcode.MEMBER_REMOVE,
        d: { serverId: serverId(m.serverId), userId: userId(bot.userId) },
      });
    }

    // Disconnect the bot from WebSocket if connected
    disconnectUser(bot.userId, CloseCode.INVALID_SESSION, "Bot deleted");

    // Delete bot record, memberships, then the bot's user record
    await db.transaction(async (tx) => {
      await tx.delete(bots).where(eq(bots.id, bot.id));
      await tx.delete(members).where(eq(members.userId, bot.userId));
      await tx.delete(user).where(eq(user.id, bot.userId));
    });

    return { success: true };
  })

  // ── POST /api/bots/:id/regenerate-token — regenerate token ───────────
  .post("/:id/regenerate-token", async ({ user: sessionUser, params }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot regenerate tokens");
    }

    const token = generateToken();
    const tokenH = hashToken(token);
    const tokenPfx = token.slice(0, BOT_TOKEN_PREFIX_LENGTH);

    // Atomic update — no separate read needed
    const [updated] = await db
      .update(bots)
      .set({ tokenHash: tokenH, tokenPrefix: tokenPfx })
      .where(and(eq(bots.id, params.id), eq(bots.ownerId, sessionUser.id)))
      .returning({ userId: bots.userId });

    if (!updated) throw new NotFoundError("Bot");

    // Disconnect bot — old token is now invalid
    disconnectUser(updated.userId, CloseCode.INVALID_SESSION, "Token regenerated");

    return { token, tokenPrefix: tokenPfx };
  });

// ── Bot Avatar Routes (separate group for multipart parsing) ────────────────

export const botAvatarRoutes = new Elysia({ prefix: "/api/bots" })
  .resolve(authResolve())
  .onParse({ as: "local" }, async ({ request, contentType }) => {
    if (contentType?.startsWith("multipart/form-data")) {
      return await request.formData();
    }
  })
  .patch("/:id/avatar", async ({ user: sessionUser, params, body: rawBody }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot manage avatars");
    }

    if (!isR2Configured()) {
      throw new AppError(
        "AvatarUploadDisabled",
        501,
        "AVATAR_UPLOAD_DISABLED",
        "Avatar upload is not configured",
      );
    }

    const [bot] = await db
      .select({ id: bots.id, userId: bots.userId })
      .from(bots)
      .where(and(eq(bots.id, params.id), eq(bots.ownerId, sessionUser.id)))
      .limit(1);
    if (!bot) throw new NotFoundError("Bot");

    const formData = rawBody as FormData;
    const file = formData.get("avatar");

    if (!file || !(file instanceof File)) {
      throw new ValidationError("No avatar file provided");
    }
    if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
      throw new ValidationError("Invalid file type. Allowed: PNG, JPEG, GIF, WebP");
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      throw new ValidationError("File too large. Maximum size is 4 MB");
    }

    const [current] = await db
      .select({ avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, bot.userId))
      .limit(1);

    const buffer = await file.arrayBuffer();
    const avatarUrl = await uploadAvatar(bot.userId, buffer, file.type);

    await db
      .update(user)
      .set({ avatarUrl })
      .where(eq(user.id, bot.userId));

    if (current?.avatarUrl) {
      deleteAvatar(current.avatarUrl).catch((err) =>
        console.error("[r2] bot avatar cleanup failed:", err),
      );
    }

    return { avatarUrl };
  })
  .delete("/:id/avatar", async ({ user: sessionUser, params }) => {
    if ((sessionUser as Record<string, unknown>).isBot) {
      throw new ForbiddenError("Bots cannot manage avatars");
    }

    const [bot] = await db
      .select({ id: bots.id, userId: bots.userId })
      .from(bots)
      .where(and(eq(bots.id, params.id), eq(bots.ownerId, sessionUser.id)))
      .limit(1);
    if (!bot) throw new NotFoundError("Bot");

    const [current] = await db
      .select({ avatarUrl: user.avatarUrl })
      .from(user)
      .where(eq(user.id, bot.userId))
      .limit(1);

    await db
      .update(user)
      .set({ avatarUrl: null })
      .where(eq(user.id, bot.userId));

    if (current?.avatarUrl && isR2Configured()) {
      deleteAvatar(current.avatarUrl).catch((err) =>
        console.error("[r2] bot avatar cleanup failed:", err),
      );
    }

    return { success: true };
  });
