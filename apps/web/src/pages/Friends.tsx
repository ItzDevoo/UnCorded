import { createSignal, createMemo, createEffect, onCleanup, For, Show } from "solid-js";
import { readyData } from "../lib/gateway-store.js";
import {
  sendFriendRequest,
  acceptFriendRequest,
  declineFriendRequest,
  removeFriendApi,
  fetchMoreFriends,
  loadingMoreFriends,
} from "../stores/friend-store.js";
import { api } from "../lib/api.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { Input } from "../components/ui/input.js";
import { Empty } from "../components/ui/empty.js";
import StatusDot, { type UserStatus } from "../components/StatusDot.js";

interface SearchUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

type Tab = "all" | "pending" | "blocked";

function displayName(f: { displayName: string | null; username: string | null }) {
  return f.displayName ?? f.username ?? "Unknown";
}

const Friends = () => {
  const [tab, setTab] = createSignal<Tab>("all");
  const [addUsername, setAddUsername] = createSignal("");
  const [error, setError] = createSignal<string | null>(null);
  const [actionError, setActionError] = createSignal<string | null>(null);
  const [sending, setSending] = createSignal(false);
  const [searchQuery, setSearchQuery] = createSignal("");
  const [searchSuggestions, setSearchSuggestions] = createSignal<SearchUser[]>([]);
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1);

  // Debounced user search for Add Friend input
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchAbort: AbortController | undefined;
  let suppressNextSearch = false;

  createEffect(() => {
    const q = addUsername().trim();

    if (suppressNextSearch) {
      suppressNextSearch = false;
      return;
    }

    // Clear immediately if empty
    if (q.length < 1) {
      clearTimeout(searchTimer);
      if (searchAbort) searchAbort.abort();
      setSearchSuggestions([]);
      return;
    }

    // Cancel previous request
    if (searchAbort) searchAbort.abort();
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      const controller = new AbortController();
      searchAbort = controller;

      api<{ users: SearchUser[] }>(
        `/api/users/search?q=${encodeURIComponent(q)}`,
        { signal: controller.signal },
      )
        .then((res) => {
          if (!controller.signal.aborted) {
            setSearchSuggestions(res.users);
          }
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!controller.signal.aborted) setSearchSuggestions([]);
        });
    }, 300);
  });

  onCleanup(() => {
    clearTimeout(searchTimer);
    if (searchAbort) searchAbort.abort();
  });

  const friends = () => readyData.data?.friends ?? [];

  const allFriends = createMemo(() => friends().filter((f) => f.friendshipStatus === "accepted"));

  const pendingIncoming = createMemo(() =>
    friends().filter((f) => f.friendshipStatus === "pending" && f.incoming),
  );

  const pendingOutgoing = createMemo(() =>
    friends().filter((f) => f.friendshipStatus === "pending" && !f.incoming),
  );

  const blockedFriends = createMemo(() =>
    friends().filter((f) => f.friendshipStatus === "blocked"),
  );

  const filteredFriends = createMemo(() => {
    const query = searchQuery().trim().toLowerCase();
    if (!query) return allFriends();
    const matches = allFriends().filter((f) => {
      const name = (f.displayName ?? "").toLowerCase();
      const uname = (f.username ?? "").toLowerCase();
      return name.includes(query) || uname.includes(query);
    });
    return matches
      .toSorted((a, b) => {
        const aName = (a.displayName ?? "").toLowerCase();
        const aUser = (a.username ?? "").toLowerCase();
        const bName = (b.displayName ?? "").toLowerCase();
        const bUser = (b.username ?? "").toLowerCase();
        const aStarts = aName.startsWith(query) || aUser.startsWith(query);
        const bStarts = bName.startsWith(query) || bUser.startsWith(query);
        if (aStarts && !bStarts) return -1;
        if (!aStarts && bStarts) return 1;
        return 0;
      })
      .slice(0, 5);
  });

  async function handleAddFriend() {
    const name = addUsername().trim();
    if (!name) return;
    setError(null);
    setSending(true);
    try {
      await sendFriendRequest(name);
      setAddUsername("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      setSending(false);
    }
  }

  return (
    <div class="flex h-full flex-col">
      <div class="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
        <span class="font-semibold text-foreground">Friends</span>
        <div class="flex gap-1">
          <Button
            size="sm"
            variant={tab() === "all" ? "default" : "ghost"}
            onClick={() => { setTab("all"); setSearchQuery(""); }}
          >
            All
          </Button>
          <Button
            size="sm"
            variant={tab() === "pending" ? "default" : "ghost"}
            onClick={() => { setTab("pending"); setSearchQuery(""); }}
          >
            Pending
            <Show when={pendingIncoming().length + pendingOutgoing().length > 0}>
              <Badge variant="destructive" class="ml-1">
                {pendingIncoming().length + pendingOutgoing().length}
              </Badge>
            </Show>
          </Button>
          <Button
            size="sm"
            variant={tab() === "blocked" ? "default" : "ghost"}
            onClick={() => { setTab("blocked"); setSearchQuery(""); }}
          >
            Blocked
          </Button>
        </div>
      </div>

      <div class="flex-1 overflow-y-auto p-4">
        <Show when={actionError()}>
          <p class="mb-4 text-xs text-destructive">{actionError()}</p>
        </Show>
        {/* Add Friend */}
        <div class="mb-6">
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">Add Friend</h3>
          <div class="flex gap-2">
            <Input
              type="text"
              placeholder="Enter a username"
              value={addUsername()}
              onInput={(e) => {
                setAddUsername(e.currentTarget.value);
                setHighlightedIndex(-1);
              }}
              onKeyDown={(e) => {
                const suggestions = searchSuggestions();
                if (suggestions.length > 0) {
                  if (e.key === "ArrowDown") {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i + 1) % suggestions.length);
                    return;
                  }
                  if (e.key === "ArrowUp") {
                    e.preventDefault();
                    setHighlightedIndex((i) => (i - 1 + suggestions.length) % suggestions.length);
                    return;
                  }
                  if (e.key === "Enter" && highlightedIndex() >= 0) {
                    e.preventDefault();
                    const selected = suggestions[highlightedIndex()];
                    if (selected) {
                      suppressNextSearch = true;
                      setAddUsername(selected.username ?? "");
                      setSearchSuggestions([]);
                      setHighlightedIndex(-1);
                    }
                    return;
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setSearchSuggestions([]);
                    setHighlightedIndex(-1);
                    return;
                  }
                }
                if (e.key === "Enter") handleAddFriend();
              }}
              class="flex-1"
            />
            <Button onClick={handleAddFriend} disabled={sending() || !addUsername().trim()}>
              Send Request
            </Button>
          </div>
          <Show when={searchSuggestions().length > 0}>
            <div class="mt-1 rounded-md border border-border bg-popover shadow-md">
              <For each={searchSuggestions()}>
                {(suggestion, index) => (
                  <button
                    type="button"
                    class={`flex w-full cursor-pointer items-center gap-2 px-3 py-2 text-left hover:bg-accent ${highlightedIndex() === index() ? "bg-accent" : ""}`}
                    onMouseEnter={() => setHighlightedIndex(index())}
                    onClick={() => {
                      suppressNextSearch = true;
                      setAddUsername(suggestion.username ?? "");
                      setSearchSuggestions([]);
                      setHighlightedIndex(-1);
                    }}
                  >
                    <Show
                      when={suggestion.avatarUrl}
                      fallback={
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-white">
                          {(suggestion.displayName ?? suggestion.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      }
                    >
                      {(url) => (
                        <img
                          src={url()}
                          alt={suggestion.displayName ?? suggestion.username ?? "User"}
                          class="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      )}
                    </Show>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">
                        {suggestion.displayName ?? suggestion.username ?? "Unknown"}
                      </p>
                      <Show when={suggestion.username}>
                        {(uname) => (
                          <p class="truncate text-xs text-muted-foreground">{uname()}</p>
                        )}
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
          <Show when={error()}>
            <p class="mt-1 text-xs text-destructive">{error()}</p>
          </Show>
        </div>

        {/* All Friends */}
        <Show when={tab() === "all"}>
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            All Friends —{" "}
            <Show when={searchQuery().trim()} fallback={allFriends().length}>
              {filteredFriends().length} of {allFriends().length}
            </Show>
          </h3>
          <Input
            type="text"
            placeholder="Search friends..."
            value={searchQuery()}
            onInput={(e) => setSearchQuery(e.currentTarget.value)}
            class="mb-3"
          />
          <Show when={filteredFriends().length === 0}>
            <Show
              when={searchQuery().trim()}
              fallback={<Empty title="No friends yet" description="Send a friend request to get started!" />}
            >
              <Empty title="No matches" description="No friends match your search." />
            </Show>
          </Show>
          <For each={filteredFriends()}>
            {(friend) => (
              <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <div class="relative shrink-0">
                  <Show
                    when={friend.avatarUrl}
                    fallback={
                      <div class="flex h-10 w-10 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                        {displayName(friend).charAt(0).toUpperCase()}
                      </div>
                    }
                  >
                    {(url) => (
                      <img src={url()} alt={displayName(friend)} class="h-10 w-10 rounded-full object-cover" />
                    )}
                  </Show>
                  <StatusDot status={friend.status as UserStatus} />
                </div>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                  <p class="text-xs text-muted-foreground capitalize">{friend.status}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  class="text-destructive"
                  onClick={async () => {
                    try {
                      setActionError(null);
                      await removeFriendApi(friend.userId);
                    } catch (err) {
                      setActionError(
                        err instanceof Error ? err.message : "Failed to remove friend",
                      );
                    }
                  }}
                >
                  Remove
                </Button>
              </div>
            )}
          </For>
          <Show when={readyData.data?.hasMoreFriends}>
            <div class="mt-2 flex justify-center">
              <Button
                size="sm"
                variant="ghost"
                disabled={loadingMoreFriends()}
                onClick={() => fetchMoreFriends()}
              >
                {loadingMoreFriends() ? "Loading..." : "Load more"}
              </Button>
            </div>
          </Show>
        </Show>

        {/* Pending */}
        <Show when={tab() === "pending"}>
          <Show when={pendingIncoming().length === 0 && pendingOutgoing().length === 0}>
            <Empty
              title="No pending requests"
              description="Friend requests you send or receive will appear here."
            />
          </Show>

          <Show when={pendingIncoming().length > 0}>
            <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">
              Incoming — {pendingIncoming().length}
            </h3>
            <For each={pendingIncoming()}>
              {(friend) => (
                <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                  <Show
                    when={friend.avatarUrl}
                    fallback={
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-sm font-bold text-white">
                        {displayName(friend).charAt(0).toUpperCase()}
                      </div>
                    }
                  >
                    {(url) => (
                      <img src={url()} alt={displayName(friend)} class="h-10 w-10 shrink-0 rounded-full object-cover" />
                    )}
                  </Show>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                  </div>
                  <div class="flex gap-1">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={async () => {
                        try {
                          setActionError(null);
                          await acceptFriendRequest(friend.userId);
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : "Failed to accept request",
                          );
                        }
                      }}
                    >
                      Accept
                    </Button>
                    <Button
                      size="sm"
                      variant="ghost"
                      onClick={async () => {
                        try {
                          setActionError(null);
                          await declineFriendRequest(friend.userId);
                        } catch (err) {
                          setActionError(
                            err instanceof Error ? err.message : "Failed to decline request",
                          );
                        }
                      }}
                    >
                      Decline
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </Show>

          <Show when={pendingOutgoing().length > 0}>
            <h3 class="mb-2 mt-4 text-sm font-semibold uppercase text-muted-foreground">
              Outgoing — {pendingOutgoing().length}
            </h3>
            <For each={pendingOutgoing()}>
              {(friend) => (
                <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                  <Show
                    when={friend.avatarUrl}
                    fallback={
                      <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-muted text-sm font-bold text-muted-foreground">
                        {displayName(friend).charAt(0).toUpperCase()}
                      </div>
                    }
                  >
                    {(url) => (
                      <img src={url()} alt={displayName(friend)} class="h-10 w-10 shrink-0 rounded-full object-cover" />
                    )}
                  </Show>
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                    <p class="text-xs text-muted-foreground">Request sent</p>
                  </div>
                </div>
              )}
            </For>
          </Show>
        </Show>

        {/* Blocked */}
        <Show when={tab() === "blocked"}>
          <h3 class="mb-2 text-sm font-semibold uppercase text-muted-foreground">
            Blocked — {blockedFriends().length}
          </h3>
          <Show when={blockedFriends().length === 0}>
            <Empty title="No blocked users" description="Users you block will appear here." />
          </Show>
          <For each={blockedFriends()}>
            {(friend) => (
              <div class="flex items-center gap-3 rounded-md px-2 py-2 hover:bg-accent">
                <Show
                  when={friend.avatarUrl}
                  fallback={
                    <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-secondary text-sm font-bold text-secondary-foreground">
                      {displayName(friend).charAt(0).toUpperCase()}
                    </div>
                  }
                >
                  {(url) => (
                    <img src={url()} alt={displayName(friend)} class="h-10 w-10 shrink-0 rounded-full object-cover" />
                  )}
                </Show>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-foreground">{displayName(friend)}</p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  onClick={async () => {
                    try {
                      setActionError(null);
                      await removeFriendApi(friend.userId);
                    } catch (err) {
                      setActionError(err instanceof Error ? err.message : "Failed to unblock user");
                    }
                  }}
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
