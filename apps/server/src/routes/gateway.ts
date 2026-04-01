import { Elysia } from "elysia";
import { AppError } from "@uncorded/shared";
import { authResolve } from "../middleware/auth.js";
import { redis } from "../lib/redis.js";

// ── In-memory fallback (same pattern as ip-rate-limit.ts) ───────────────────

const MAX_IN_MEMORY_TICKETS = 10_000;
const tickets = new Map<string, string>();

// Per-user ticket cap (prevent a single user from exhausting the store)
const USER_MAX_TICKETS = 5;
const userTicketCounts = new Map<string, number>();

function storeTicketInMemory(ticket: string, uid: string, ttlMs: number): boolean {
  if (tickets.size >= MAX_IN_MEMORY_TICKETS) return false;
  tickets.set(ticket, uid);
  const timer = setTimeout(() => tickets.delete(ticket), ttlMs);
  timer.unref();
  return true;
}

// ── Public helpers ──────────────────────────────────────────────────────────

const TICKET_TTL_SECONDS = 30;

export async function consumeTicket(ticket: string): Promise<string | null> {
  const redisKey = `ws:ticket:${ticket}`;

  if (redis) {
    try {
      const uid = await redis.getdel(redisKey);
      if (!uid) return null;
      return uid;
    } catch {
      // Fall through to in-memory
    }
  }

  const uid = tickets.get(ticket);
  if (!uid) return null;
  tickets.delete(ticket);
  return uid;
}

// ── Route ───────────────────────────────────────────────────────────────────

export const gatewayTicketRoutes = new Elysia({ prefix: "/api/gateway" })
  .resolve(authResolve({ allowBots: true }))
  .post("/ticket", async ({ user: sessionUser }) => {
    // Per-user ticket cap
    const currentCount = userTicketCounts.get(sessionUser.id) ?? 0;
    if (currentCount >= USER_MAX_TICKETS) {
      throw new AppError(
        "RateLimitError",
        429,
        "RATE_LIMITED",
        "Too many outstanding tickets",
      );
    }

    const ticket = crypto.randomUUID();
    const redisKey = `ws:ticket:${ticket}`;

    if (redis) {
      try {
        await redis.set(redisKey, sessionUser.id, "EX", TICKET_TTL_SECONDS);
      } catch {
        if (!storeTicketInMemory(ticket, sessionUser.id, TICKET_TTL_SECONDS * 1000)) {
          throw new AppError(
            "ServiceUnavailableError",
            503,
            "SERVICE_UNAVAILABLE",
            "Ticket store at capacity",
          );
        }
      }
    } else {
      if (!storeTicketInMemory(ticket, sessionUser.id, TICKET_TTL_SECONDS * 1000)) {
        throw new AppError(
          "ServiceUnavailableError",
          503,
          "SERVICE_UNAVAILABLE",
          "Ticket store at capacity",
        );
      }
    }

    // Track per-user ticket count with auto-decrement on TTL
    userTicketCounts.set(sessionUser.id, (userTicketCounts.get(sessionUser.id) ?? 0) + 1);
    const timer = setTimeout(() => {
      const c = userTicketCounts.get(sessionUser.id);
      if (c !== undefined) {
        if (c <= 1) userTicketCounts.delete(sessionUser.id);
        else userTicketCounts.set(sessionUser.id, c - 1);
      }
    }, TICKET_TTL_SECONDS * 1000);
    timer.unref();

    return { ticket };
  });
