import { Elysia } from "elysia";
import { authResolve } from "../middleware/auth.js";
import { redis } from "../lib/redis.js";

// ── In-memory fallback (same pattern as ip-rate-limit.ts) ───────────────────

const tickets = new Map<string, string>();

function storeTicketInMemory(ticket: string, uid: string, ttlMs: number) {
  tickets.set(ticket, uid);
  const timer = setTimeout(() => tickets.delete(ticket), ttlMs);
  timer.unref();
}

// ── Public helpers ──────────────────────────────────────────────────────────

const TICKET_TTL_SECONDS = 30;

export async function consumeTicket(ticket: string): Promise<string | null> {
  const redisKey = `ws:ticket:${ticket}`;

  if (redis) {
    try {
      const uid = await redis.getdel<string>(redisKey);
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
  .resolve(authResolve())
  .post("/ticket", async ({ user: sessionUser }) => {
    const ticket = crypto.randomUUID();
    const redisKey = `ws:ticket:${ticket}`;

    if (redis) {
      try {
        await redis.set(redisKey, sessionUser.id, { ex: TICKET_TTL_SECONDS });
      } catch {
        storeTicketInMemory(ticket, sessionUser.id, TICKET_TTL_SECONDS * 1000);
      }
    } else {
      storeTicketInMemory(ticket, sessionUser.id, TICKET_TTL_SECONDS * 1000);
    }

    return { ticket };
  });
