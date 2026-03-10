import { z } from "zod";
import { Opcode } from "@uncorded/protocol";
import type { UserId } from "@uncorded/protocol";
import { userId } from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { addFriend, removeFriend, updateFriendStatus } from "../lib/gateway-store.js";
import { api } from "../lib/api.js";

// ── Zod schemas for WS events ──────────────────────────────────────────────

const friendRequestSchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

const friendAcceptSchema = z.object({
  userId: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
  status: z.string(),
});

const friendRemoveSchema = z.object({
  userId: z.string(),
});

// ── WS listeners ────────────────────────────────────────────────────────────

const unsubRequest = onGatewayEvent(Opcode.FRIEND_REQUEST, (data) => {
  const parsed = friendRequestSchema.safeParse(data);
  if (!parsed.success) return;
  const d = parsed.data;
  addFriend({
    userId: userId(d.userId) as UserId,
    username: d.username,
    displayName: d.displayName,
    avatarUrl: d.avatarUrl,
    status: d.status,
    friendshipStatus: "pending",
    incoming: true,
  });
});

const unsubAccept = onGatewayEvent(Opcode.FRIEND_ACCEPT, (data) => {
  const parsed = friendAcceptSchema.safeParse(data);
  if (!parsed.success) return;
  const d = parsed.data;
  // If not in friends list yet (we sent the request), add them
  addFriend({
    userId: userId(d.userId) as UserId,
    username: d.username,
    displayName: d.displayName,
    avatarUrl: d.avatarUrl,
    status: d.status,
    friendshipStatus: "accepted",
    incoming: false,
  });
  updateFriendStatus(userId(d.userId), "accepted");
});

const unsubRemove = onGatewayEvent(Opcode.FRIEND_REMOVE, (data) => {
  const parsed = friendRemoveSchema.safeParse(data);
  if (!parsed.success) return;
  removeFriend(userId(parsed.data.userId));
});

// ── API functions ───────────────────────────────────────────────────────────

export async function sendFriendRequest(targetUserId: string): Promise<void> {
  await api("/api/friends/request", {
    method: "POST",
    body: JSON.stringify({ userId: targetUserId }),
  });
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  await api(`/api/friends/${fromUserId}/accept`, { method: "POST" });
}

export async function declineFriendRequest(fromUserId: string): Promise<void> {
  await api(`/api/friends/${fromUserId}/decline`, { method: "POST" });
}

export async function removeFriendApi(friendUserId: string): Promise<void> {
  await api(`/api/friends/${friendUserId}`, { method: "DELETE" });
}

export async function blockUser(targetUserId: string): Promise<void> {
  await api(`/api/friends/${targetUserId}/block`, { method: "POST" });
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubRequest();
    unsubAccept();
    unsubRemove();
  });
}
