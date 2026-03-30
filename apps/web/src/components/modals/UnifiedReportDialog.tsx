import { createSignal, createEffect, onCleanup, For, Show } from "solid-js";
import type { ReportCategory } from "@uncorded/shared";
import { api } from "../../lib/api.js";
import { readyData } from "../../lib/gateway-store.js";
import { selectedServerId } from "../../stores/app-store.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog.js";

type ReportTab = "bug" | "player" | "server";

interface SearchUser {
  id: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
}

const REPORT_CATEGORIES: ReadonlyArray<{ value: ReportCategory; label: string }> = [
  { value: "harassment", label: "Harassment" },
  { value: "spam", label: "Spam" },
  { value: "other", label: "Other" },
];

interface Props {
  onClose: () => void;
}

const UnifiedReportDialog = (props: Props) => {
  const [tab, setTab] = createSignal<ReportTab>("bug");
  const [submitting, setSubmitting] = createSignal(false);

  // Bug form state
  const [bugTitle, setBugTitle] = createSignal("");
  const [bugDescription, setBugDescription] = createSignal("");

  // Player form state
  const [playerSearch, setPlayerSearch] = createSignal("");
  const [searchSuggestions, setSearchSuggestions] = createSignal<SearchUser[]>([]);
  const [selectedUser, setSelectedUser] = createSignal<SearchUser | null>(null);
  const [playerCategory, setPlayerCategory] = createSignal<ReportCategory>("harassment");
  const [playerDetails, setPlayerDetails] = createSignal("");

  // Server form state
  const [reportServerId, setReportServerId] = createSignal<string>("");
  const [serverCategory, setServerCategory] = createSignal<ReportCategory>("harassment");
  const [serverDetails, setServerDetails] = createSignal("");

  // Auto-fill server from current selection
  createEffect(() => {
    const sid = selectedServerId();
    if (sid) setReportServerId(sid);
  });

  // Debounced user search
  let searchTimer: ReturnType<typeof setTimeout> | undefined;
  let searchAbort: AbortController | undefined;
  let suppressNextSearch = false;

  createEffect(() => {
    const q = playerSearch().trim();

    if (suppressNextSearch) {
      suppressNextSearch = false;
      return;
    }

    if (q.length < 1) {
      clearTimeout(searchTimer);
      if (searchAbort) searchAbort.abort();
      setSearchSuggestions([]);
      return;
    }

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

  function selectUser(u: SearchUser) {
    suppressNextSearch = true;
    setSelectedUser(u);
    setPlayerSearch(u.displayName ?? u.username ?? "");
    setSearchSuggestions([]);
  }

  function resetForm() {
    setBugTitle("");
    setBugDescription("");
    setPlayerSearch("");
    setSearchSuggestions([]);
    setSelectedUser(null);
    setPlayerCategory("harassment");
    setPlayerDetails("");
    setServerCategory("harassment");
    setServerDetails("");
  }

  function handleClose() {
    resetForm();
    props.onClose();
  }

  async function handleSubmit() {
    if (submitting()) return;

    const currentTab = tab();

    if (currentTab === "bug") {
      if (!bugTitle().trim() || !bugDescription().trim()) {
        showToast("Please fill in all fields", "error");
        return;
      }
      setSubmitting(true);
      try {
        await api("/api/feedback", {
          method: "POST",
          body: JSON.stringify({
            type: "bug",
            title: bugTitle().trim(),
            description: bugDescription().trim(),
          }),
        });
        showToast("Bug report submitted", "info");
        handleClose();
      } catch (err) {
        handleApiError(err, "Failed to submit report");
      } finally {
        setSubmitting(false);
      }
    } else if (currentTab === "player") {
      const target = selectedUser();
      if (!target) {
        showToast("Please select a user to report", "error");
        return;
      }
      setSubmitting(true);
      try {
        await api("/api/reports", {
          method: "POST",
          body: JSON.stringify({
            type: "player",
            targetUserId: target.id,
            category: playerCategory(),
            details: playerDetails().trim() || undefined,
          }),
        });
        showToast("Player report submitted", "info");
        handleClose();
      } catch (err) {
        handleApiError(err, "Failed to submit report");
      } finally {
        setSubmitting(false);
      }
    } else if (currentTab === "server") {
      const sid = reportServerId();
      if (!sid) {
        showToast("Please select a server to report", "error");
        return;
      }
      setSubmitting(true);
      try {
        await api("/api/reports", {
          method: "POST",
          body: JSON.stringify({
            type: "server",
            serverId: sid,
            category: serverCategory(),
            details: serverDetails().trim() || undefined,
          }),
        });
        showToast("Server report submitted", "info");
        handleClose();
      } catch (err) {
        handleApiError(err, "Failed to submit report");
      } finally {
        setSubmitting(false);
      }
    }
  }

  const userServers = () => readyData.data?.servers ?? [];

  return (
    <Dialog open={true} onOpenChange={() => handleClose()}>
      <DialogContent onClose={handleClose}>
        <DialogHeader>
          <DialogTitle>Submit a Report</DialogTitle>
          <DialogDescription>Report a bug, player, or server</DialogDescription>
        </DialogHeader>

        {/* Type switcher */}
        <div class="flex gap-1 rounded-lg bg-muted p-1">
          <button
            type="button"
            aria-pressed={tab() === "bug"}
            class={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab() === "bug"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("bug")}
          >
            Bug
          </button>
          <button
            type="button"
            aria-pressed={tab() === "player"}
            class={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab() === "player"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("player")}
          >
            Player
          </button>
          <button
            type="button"
            aria-pressed={tab() === "server"}
            class={`flex-1 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              tab() === "server"
                ? "bg-card text-foreground shadow-xs"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setTab("server")}
          >
            Server
          </button>
        </div>

        <div class="space-y-3 py-2">
          {/* Bug form */}
          <Show when={tab() === "bug"}>
            <Input
              value={bugTitle()}
              onInput={(e) => setBugTitle(e.currentTarget.value)}
              placeholder="Bug title (max 200 characters)"
              maxLength={200}
              autofocus
            />
            <textarea
              value={bugDescription()}
              onInput={(e) => setBugDescription(e.currentTarget.value)}
              placeholder="Describe the bug in detail..."
              aria-label="Bug description"
              maxLength={2000}
              rows={5}
              class="block w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <p class="text-right text-xs text-muted-foreground">
              {bugDescription().length}/2000
            </p>
          </Show>

          {/* Player form */}
          <Show when={tab() === "player"}>
            <div class="relative">
              <Input
                value={playerSearch()}
                onInput={(e) => {
                  setPlayerSearch(e.currentTarget.value);
                  setSelectedUser(null);
                }}
                placeholder="Search for a user..."
                autofocus
              />
              <Show when={searchSuggestions().length > 0}>
                <div class="absolute left-0 right-0 top-full z-10 mt-1 max-h-48 overflow-y-auto rounded-md border border-border bg-popover shadow-md">
                  <For each={searchSuggestions()}>
                    {(u) => (
                      <button
                        type="button"
                        class="flex w-full items-center gap-2 px-3 py-2 text-left text-sm transition-colors hover:bg-accent"
                        onClick={() => selectUser(u)}
                      >
                        <Show
                          when={u.avatarUrl}
                          fallback={
                            <div class="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-white">
                              {(u.displayName ?? u.username ?? "?").charAt(0).toUpperCase()}
                            </div>
                          }
                        >
                          {(url) => (
                            <img
                              src={url()}
                              alt={u.displayName ?? u.username ?? "User"}
                              class="h-6 w-6 shrink-0 rounded-full object-cover"
                            />
                          )}
                        </Show>
                        <div class="min-w-0 flex-1">
                          <div class="truncate text-sm text-foreground">
                            {u.displayName ?? u.username}
                          </div>
                          <Show when={u.displayName && u.username}>
                            <div class="truncate text-xs text-muted-foreground">{u.username}</div>
                          </Show>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>
            </div>

            <Show when={selectedUser()}>
              {(u) => (
                <div class="flex items-center gap-2 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2 text-sm">
                  <span class="text-muted-foreground">Reporting:</span>
                  <span class="font-medium text-foreground">{u().displayName ?? u().username}</span>
                </div>
              )}
            </Show>

            <select
              value={playerCategory()}
              onChange={(e) => setPlayerCategory(e.currentTarget.value as ReportCategory)}
              aria-label="Report category"
              class="w-full cursor-pointer rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none [&>option]:bg-popover [&>option]:text-foreground"
            >
              <For each={REPORT_CATEGORIES}>
                {(cat) => <option value={cat.value}>{cat.label}</option>}
              </For>
            </select>

            <textarea
              value={playerDetails()}
              onInput={(e) => setPlayerDetails(e.currentTarget.value)}
              placeholder="Additional details (optional)"
              aria-label="Report details"
              maxLength={1000}
              rows={3}
              class="block w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </Show>

          {/* Server form */}
          <Show when={tab() === "server"}>
            <select
              value={reportServerId()}
              onChange={(e) => setReportServerId(e.currentTarget.value)}
              aria-label="Server"
              class="w-full cursor-pointer rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none [&>option]:bg-popover [&>option]:text-foreground"
            >
              <option value="">Select a server...</option>
              <For each={userServers()}>
                {(s) => <option value={s.id}>{s.name}</option>}
              </For>
            </select>

            <select
              value={serverCategory()}
              onChange={(e) => setServerCategory(e.currentTarget.value as ReportCategory)}
              aria-label="Report category"
              class="w-full cursor-pointer rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none [&>option]:bg-popover [&>option]:text-foreground"
            >
              <For each={REPORT_CATEGORIES}>
                {(cat) => <option value={cat.value}>{cat.label}</option>}
              </For>
            </select>

            <textarea
              value={serverDetails()}
              onInput={(e) => setServerDetails(e.currentTarget.value)}
              placeholder="Additional details (optional)"
              aria-label="Report details"
              maxLength={1000}
              rows={3}
              class="block w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </Show>
        </div>

        <DialogFooter>
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant={tab() === "bug" ? "default" : "destructive"}
            onClick={handleSubmit}
            disabled={submitting()}
          >
            {submitting() ? "Submitting..." : "Submit"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default UnifiedReportDialog;
