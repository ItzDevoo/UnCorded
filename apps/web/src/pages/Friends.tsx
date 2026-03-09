import { createSignal, createMemo, For, Show } from "solid-js";
import { readyData } from "../lib/gateway-store.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriendApi,
} from "../stores/friend-store.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";

type Tab = "all" | "pending" | "blocked";

function displayName(f: { displayName: string | null; username: string | null }) {
  return f.displayName ?? f.username ?? "Unknown";
}

const Friends = () => {
  const [tab, setTab] = createSignal<Tab>("all");
  const [addUserId, setAddUserId] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [sending, setSending] = createSignal(false);

  const friends = () => readyData.data?.friends ?? [];

  const allFriends = createMemo(() => friends().filter((f) => f.friendshipStatus === "accepted"));

  const pendingFriends = createMemo(() =>
    friends().filter((f) => f.friendshipStatus === "pending" && f.incoming),
  );

  const blockedFriends = createMemo(() =>
    friends().filter((f) => f.friendshipStatus === "blocked"),
  );

  async function handleAddFriend() {
    const id = addUserId().trim();
    if (!id) return;
    setError(null);
    setSending(true);
    try {
      await sendFriendRequest(id);
      setAddUserId("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div class="flex h-full flex-col">
      <div class="flex h-12 shrink-0 items-center gap-4 border-b border-border px-4">
        <span class="font-semibold text-foreground">Friends</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            variant={tab() === "all" ? "default" : "ghost"}
            onClick={() => setTab("all")}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={tab() === "pending" ? "default" : "ghost"}
            onClick={() => setTab("pending")}
          >
            Pending
            <Show when={pendingFriends().length > 0}>
              <Badge variant="destructive" class="ml-1">
                {pendingFriends().length}
              </Badge>
            </Show>
          </Button>
          <Button
            size="sm"
            variant={tab() === "blocked" ? "default" : "ghost"}
            onClick={() => setTab("blocked")}
          >
            Blocked
          </Button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        {/* Add Friend */}
        <div class="mb-6">
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">Add Friend</h3>
          <div class="flex gap-2">
            <input
              type="text"
              placeholder="Enter a User ID"
              value={addUserId()}
              onInput={(e) => setAddUserId(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleAddFriend();
              }}
              class="flex-1 rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
            />
            <Button onClick={handleAddFriend} disabled={sending() || !addUserId().trim()}>
              Send Request
            </Button>
          </div>
          <Show when={error()}>
            <p class="mt-1 text-xs text-destructive">{error()}</p>
          </Show>
        </div>

        {/* All Friends */}
        <Show when={tab() === "all"}>
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            All Friends — {allFriends().length}
          </h3>
          <Show when={allFriends().length === 0}>
            <p class="text-sm text-muted-foreground">
              No friends yet. Send a friend request above!
            </p>
          </Show>
          <For each={allFriends()}>
            {(friend) => (
              <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <div class="relative flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {displayName(friend).charAt(0).toUpperCase()}
                  <Show when={friend.status === "online"}>
                    <div class="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full border-2 border-card bg-success" />
                  </Show>
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                  <p class="text-xs text-muted-foreground capitalize">{friend.status}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-destructive"
                  onClick={() => removeFriendApi(friend.userId as string)}
                >
                  Remove
                </Button>
              </div>
            )}
          </For>
        </Show>

        {/* Pending */}
        <Show when={tab() === "pending"}>
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Incoming Requests — {pendingFriends().length}
          </h3>
          <Show when={pendingFriends().length === 0}>
            <p class="text-sm text-muted-foreground">No pending friend requests.</p>
          </Show>
          <For each={pendingFriends()}>
            {(friend) => (
              <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                  {displayName(friend).charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                </div>
                <div class="flex gap-1">
                  <Button
                    size="sm"
                    variant="default"
                    onClick={() => acceptFriendRequest(friend.userId as string)}
                  >
                    Accept
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={() => declineFriendRequest(friend.userId as string)}
                  >
                    Decline
                  </Button>
                </div>
              </div>
            )}
          </For>
        </Show>

        {/* Blocked */}
        <Show when={tab() === "blocked"}>
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Blocked — {blockedFriends().length}
          </h3>
          <Show when={blockedFriends().length === 0}>
            <p class="text-sm text-muted-foreground">No blocked users.</p>
          </Show>
          <For each={blockedFriends()}>
            {(friend) => (
              <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                  {displayName(friend).charAt(0).toUpperCase()}
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={() => removeFriendApi(friend.userId as string)}
                >
                  Unblock
                </Button>
              </div>
            )}
          </For>
        </Show>
      </div>
    </div>
  );
};

export default Friends;
