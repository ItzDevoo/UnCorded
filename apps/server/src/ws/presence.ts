// In-memory presence manager — idle timers and presence broadcasting.

import { eq, and, or } from "drizzle-orm";
import { Opcode } from "@uncorded/protocol";
import { IDLE_TIMEOUT_MS } from "@uncorded/shared";
import { db } from "../db/index.js";
import { user, friendships } from "../db/schema.js";
import { sendToUser } from "./connections.js";
import { getUserServerIds, getServerMembers } from "./server-members.js";

/** Per-user idle timer — fires after IDLE_TIMEOUT_MS of inactivity. */
const idleTimers = new Map<string, Timer>();

// ── Idle Timer ──────────────────────────────────────────────────────────────

export function resetIdleTimer(userId: string): void {
  clearIdleTimer(userId);

  const timer = setTimeout(async () => {
    idleTimers.delete(userId);
    try {
      const result = await db.update(user).set({ status: "idle" }).where(eq(user.id, userId));
      // Only broadcast if a row was actually updated
      if (result.rowCount && result.rowCount > 0) {
        await broadcastPresence(userId, "idle");
      }
    } catch (err) {
      if (process.env.NODE_ENV !== "production")
        console.error("[presence] Idle transition failed:", userId, err);
    }
  }, IDLE_TIMEOUT_MS);

  // Don't hold the process open for idle timers
  if (typeof timer === "object" && "unref" in timer) timer.unref();

  idleTimers.set(userId, timer);
}

export function clearIdleTimer(userId: string): void {
  const timer = idleTimers.get(userId);
  if (timer) {
    clearTimeout(timer);
    idleTimers.delete(userId);
  }
}

// ── Presence Broadcasting ───────────────────────────────────────────────────

/**
 * Broadcast a presence update to all users who should see it:
 * 1. Members of shared servers
 * 2. Accepted friends
 * Deduped into a single set to avoid double-sends.
 */
export async function broadcastPresence(
  userId: string,
  status: "online" | "idle" | "offline",
): Promise<void> {
  const recipients = new Set<string>();

  // 1. Server co-members
  const serverIds = getUserServerIds(userId);
  if (serverIds) {
    for (const sid of serverIds) {
      const members = getServerMembers(sid);
      if (members) {
        for (const uid of members) {
          if (uid !== userId) recipients.add(uid);
        }
      }
    }
  }

  // 2. Accepted friends
  const friendRows = await db
    .select({ usrId: friendships.userId, frdId: friendships.friendId })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.userId, userId), eq(friendships.friendId, userId)),
        eq(friendships.status, "accepted"),
      ),
    );

  for (const row of friendRows) {
    const peerId = row.usrId === userId ? row.frdId : row.usrId;
    recipients.add(peerId);
  }

  // 3. Send to all recipients
  const frame = {
    op: Opcode.PRESENCE_UPDATE,
    d: { userId, status },
  } as const;

  for (const uid of recipients) {
    sendToUser(uid, frame);
  }
}

// ── Cleanup ─────────────────────────────────────────────────────────────────

/** Full cleanup on disconnect (when last connection closes). */
export function cleanupPresence(userId: string): void {
  clearIdleTimer(userId);
}
