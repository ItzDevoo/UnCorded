import { createSignal } from "solid-js";
import {
  Opcode,
  userId,
  dmChannelId,
  friendRequestEventSchema,
  friendAcceptEventSchema,
  friendRemoveEventSchema,
  dmChannelCreateEventSchema,
} from "@uncorded/protocol";
import { LIST_PAGE_LIMIT, friendRequestResponseSchema } from "@uncorded/shared";
import { onGatewayEvent } from "../lib/gateway.js";
import {
  readyData,
  addDmChannel,
  addFriend,
  removeFriend,
  updateFriendStatus,
  appendFriends,
  setHasMoreFriends,
  appendDmChannels,
  setHasMoreDmChannels,
  type ReadyFriend,
  type ReadyDmChannel,
} from "../lib/gateway-store.js";
import { api } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";

// ── Loading signals ─────────────────────────────────────────────────────────

const [loadingMoreFriends, setLoadingMoreFriends] = createSignal(false);
const [loadingMoreDms, setLoadingMoreDms] = createSignal(false);

// ── WS listener unsub refs ──────────────────────────────────────────────────

let unsubRequest: (() => void) | null = null;
let unsubAccept: (() => void) | null = null;
let unsubRemove: (() => void) | null = null;
let unsubDmCreate: (() => void) | null = null;

function teardown() {
  unsubRequest?.();
  unsubAccept?.();
  unsubRemove?.();
  unsubDmCreate?.();
  unsubRequest = null;
  unsubAccept = null;
  unsubRemove = null;
  unsubDmCreate = null;
}

export function setupFriendStore(): void {
  // Guard against double-init (HMR or reconnect)
  teardown();

  unsubRequest = onGatewayEvent(Opcode.FRIEND_REQUEST, (data) => {
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

  unsubAccept = onGatewayEvent(Opcode.FRIEND_ACCEPT, (data) => {
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

  unsubRemove = onGatewayEvent(Opcode.FRIEND_REMOVE, (data) => {
    const parsed = friendRemoveEventSchema.safeParse(data);
    if (!parsed.success) return;
    removeFriend(userId(parsed.data.userId));
  });

  unsubDmCreate = onGatewayEvent(Opcode.DM_CHANNEL_CREATE, (data) => {
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
}

// ── Pagination: fetch more ──────────────────────────────────────────────────

export async function fetchMoreFriends(): Promise<void> {
  const currentCount = readyData.data?.friends.length ?? 0;
  setLoadingMoreFriends(true);
  try {
    const res = await api<{ friends: ReadyFriend[]; hasMore: boolean }>(
      `/api/friends?limit=${LIST_PAGE_LIMIT}&offset=${currentCount}`,
    );
    appendFriends(res.friends);
    setHasMoreFriends(res.hasMore);
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Failed to load more friends", "error");
  } finally {
    setLoadingMoreFriends(false);
  }
}

export async function fetchMoreDms(): Promise<void> {
  const currentCount = readyData.data?.dmChannels.length ?? 0;
  setLoadingMoreDms(true);
  try {
    const res = await api<{ dmChannels: ReadyDmChannel[]; hasMore: boolean }>(
      `/api/dms?limit=${LIST_PAGE_LIMIT}&offset=${currentCount}`,
    );
    appendDmChannels(res.dmChannels);
    setHasMoreDmChannels(res.hasMore);
  } catch (err) {
    showToast(err instanceof Error ? err.message : "Failed to load more conversations", "error");
  } finally {
    setLoadingMoreDms(false);
  }
}

// ── API functions ───────────────────────────────────────────────────────────

export async function sendFriendRequest(username: string): Promise<void> {
  try {
    const raw = await api<unknown>("/api/friends/request", {
      method: "POST",
      body: JSON.stringify({ username }),
    });

    const parsed = friendRequestResponseSchema.safeParse(raw);
    if (!parsed.success) {
      if (import.meta.env.DEV)
        console.warn("[friend-store] Invalid response:", parsed.error.issues);
      showToast("Friend request sent", "info");
      return;
    }
    const res = parsed.data;

    // Add to local store so sender sees it in pending
    if (res.status === "pending") {
      if (res.user) {
        addFriend({
          userId: userId(res.user.userId),
          username: res.user.username,
          displayName: res.user.displayName,
          avatarUrl: res.user.avatarUrl,
          status: res.user.status,
          friendshipStatus: "pending",
          incoming: false,
        });
      }
      showToast("Friend request sent", "info");
    } else if (res.status === "accepted") {
      showToast("Friend request accepted!", "info");
    }
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

export { loadingMoreFriends, loadingMoreDms };

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
