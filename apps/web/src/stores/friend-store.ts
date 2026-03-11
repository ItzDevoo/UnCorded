import {
  Opcode,
  userId,
  dmChannelId,
  friendRequestEventSchema,
  friendAcceptEventSchema,
  friendRemoveEventSchema,
  dmChannelCreateEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { addDmChannel, addFriend, removeFriend, updateFriendStatus } from "../lib/gateway-store.js";
import { api } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";

// ── WS listeners ────────────────────────────────────────────────────────────

const unsubRequest = onGatewayEvent(Opcode.FRIEND_REQUEST, (data) => {
  const parsed = friendRequestEventSchema.safeParse(data);
  if (!parsed.success) return;
  const d = parsed.data;
  addFriend({
    userId: userId(d.userId),
    username: d.username,
    displayName: d.displayName,
    avatarUrl: d.avatarUrl,
    status: d.status,
    friendshipStatus: "pending",
    incoming: true,
  });
});

const unsubAccept = onGatewayEvent(Opcode.FRIEND_ACCEPT, (data) => {
  const parsed = friendAcceptEventSchema.safeParse(data);
  if (!parsed.success) return;
  const d = parsed.data;
  // If not in friends list yet (we sent the request), add them
  addFriend({
    userId: userId(d.userId),
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
  const parsed = friendRemoveEventSchema.safeParse(data);
  if (!parsed.success) return;
  removeFriend(userId(parsed.data.userId));
});

const unsubDmCreate = onGatewayEvent(Opcode.DM_CHANNEL_CREATE, (data) => {
  const parsed = dmChannelCreateEventSchema.safeParse(data);
  if (!parsed.success) return;
  const d = parsed.data;
  addDmChannel({
    id: dmChannelId(d.id),
    otherUser: {
      id: userId(d.otherUser.id),
      username: d.otherUser.username,
      displayName: d.otherUser.displayName,
      avatarUrl: d.otherUser.avatarUrl,
      status: d.otherUser.status,
    },
  });
});

// ── API functions ───────────────────────────────────────────────────────────

export async function sendFriendRequest(username: string): Promise<void> {
  try {
    await api("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ username }),
    });
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    throw err;
  }
}

export async function acceptFriendRequest(fromUserId: string): Promise<void> {
  try {
    await api(`/api/friends/${fromUserId}/accept`, { method: "POST" });
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    throw err;
  }
}

export async function declineFriendRequest(fromUserId: string): Promise<void> {
  try {
    await api(`/api/friends/${fromUserId}/decline`, { method: "POST" });
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    throw err;
  }
}

export async function removeFriendApi(friendUserId: string): Promise<void> {
  try {
    await api(`/api/friends/${friendUserId}`, { method: "DELETE" });
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    throw err;
  }
}

export async function blockUser(targetUserId: string): Promise<void> {
  try {
    await api(`/api/friends/${targetUserId}/block`, { method: "POST" });
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Something went wrong", "error");
    throw err;
  }
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    unsubRequest();
    unsubAccept();
    unsubRemove();
    unsubDmCreate();
  });
}
