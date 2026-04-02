import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import type { UserId } from "@uncorded/protocol";
import { sendFriendRequest } from "../../stores/friend-store.js";
import { api } from "../../lib/api.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Button } from "../ui/button.js";

interface SearchUser {
  id: UserId;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

interface Props {
  onClose: () => void;
}

const AddFriendModal = (props: Props) => {
  const [username, setUsername] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [error, setError] = createSignal<string | null>(null);
  const [suggestions, setSuggestions] = createSignal<SearchUser[]>([]);
  const [highlightedIndex, setHighlightedIndex] = createSignal(-1);

  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchAbort: AbortController | undefined;
  let suppressNextSearch = false;
  let sendInFlight = false;

  createEffect(() => {
    const q = username().trim();

    if (suppressNextSearch) {
      suppressNextSearch = false;
      return;
    }

    if (q.length < 1) {
      clearTimeout(searchTimer);
      if (searchAbort) searchAbort.abort();
      setSuggestions([]);
      return;
    }

    if (searchAbort) searchAbort.abort();
    clearTimeout(searchTimer);

    searchTimer = setTimeout(() => {
      const controller = new AbortController();
      searchAbort = controller;

      api<{ users: SearchUser[] }>(`/api/users/search?q=${encodeURIComponent(q)}`, {
        signal: controller.signal,
      })
        .then((res) => {
          if (!controller.signal.aborted) setSuggestions(res.users);
        })
        .catch((err) => {
          if (err instanceof DOMException && err.name === "AbortError") return;
          if (!controller.signal.aborted) setSuggestions([]);
        });
    }, 300);
  });

  onCleanup(() => {
    clearTimeout(searchTimer);
    if (searchAbort) searchAbort.abort();
  });

  const handleSend = async () => {
    const name = username().trim();
    if (!name || sendInFlight) return;
    setError(null);
    setSending(true);
    sendInFlight = true;
    try {
      await sendFriendRequest(name);
      props.onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send request");
    } finally {
      sendInFlight = false;
      setSending(false);
    }
  };

  const selectSuggestion = (user: SearchUser) => {
    suppressNextSearch = true;
    setUsername(user.username ?? "");
    setSuggestions([]);
    setHighlightedIndex(-1);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    const list = suggestions();
    if (list.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setHighlightedIndex((i) => (i + 1) % list.length);
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setHighlightedIndex((i) => (i - 1 + list.length) % list.length);
        return;
      }
      if (e.key === "Enter" && highlightedIndex() >= 0) {
        e.preventDefault();
        const selected = list[highlightedIndex()];
        if (selected) selectSuggestion(selected);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggestions([]);
        setHighlightedIndex(-1);
        return;
      }
    }
    if (e.key === "Enter") handleSend();
  };

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Add Friend</DialogTitle>
        </DialogHeader>

        <p class="mb-3 text-sm text-muted-foreground">Enter a username to send a friend request.</p>

        <div class="relative">
          <Input
            type="text"
            placeholder="Enter a username"
            value={username()}
            onInput={(e) => {
              setUsername(e.currentTarget.value);
              setHighlightedIndex(-1);
              setError(null);
            }}
            onKeyDown={handleKeyDown}
            autofocus
          />

          <Show when={suggestions().length > 0}>
            <div class="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
              <For each={suggestions()}>
                {(user, index) => (
                  <button
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2 text-left transition-colors hover:bg-accent"
                    classList={{ "bg-accent": highlightedIndex() === index() }}
                    onMouseEnter={() => setHighlightedIndex(index())}
                    onClick={() => selectSuggestion(user)}
                  >
                    <Show
                      when={user.avatarUrl}
                      fallback={
                        <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-primary-foreground">
                          {(user.displayName ?? user.username ?? "?").charAt(0).toUpperCase()}
                        </div>
                      }
                    >
                      {(url) => (
                        <img
                          src={url()}
                          alt={user.displayName ?? user.username ?? "User"}
                          class="h-8 w-8 shrink-0 rounded-full object-cover"
                        />
                      )}
                    </Show>
                    <div class="min-w-0 flex-1">
                      <p class="truncate text-sm font-medium text-foreground">
                        {user.displayName ?? user.username ?? "Unknown"}
                      </p>
                      <Show when={user.username}>
                        {(uname) => (
                          <p class="truncate text-xs text-muted-foreground">@{uname()}</p>
                        )}
                      </Show>
                    </div>
                  </button>
                )}
              </For>
            </div>
          </Show>
        </div>

        <Show when={error()}>
          <p class="mt-2 text-xs text-destructive">{error()}</p>
        </Show>

        <div class="mt-4 flex justify-end gap-2">
          <Button variant="secondary" onClick={props.onClose}>
            Cancel
          </Button>
          <Button onClick={handleSend} disabled={sending() || !username().trim()}>
            {sending() ? "Sending..." : "Send Request"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default AddFriendModal;
