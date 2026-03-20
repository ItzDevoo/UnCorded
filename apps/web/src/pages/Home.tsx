import { createSignal, onMount, Show, For } from "solid-js";
import { useSearchParams } from "@solidjs/router";
import type { ActivePoll, ActivePollEntry } from "@uncorded/shared";
import { readyData } from "../lib/gateway-store.js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../components/ui/dialog.js";

const Home = () => {
  const username = () => readyData.data?.user.displayName ?? readyData.data?.user.username;
  const [searchParams, setSearchParams] = useSearchParams();

  const [poll, setPoll] = createSignal<ActivePoll | null>(null);
  const [voting, setVoting] = createSignal(false);
  const [viewingEntry, setViewingEntry] = createSignal<ActivePollEntry | null>(null);

  onMount(() => {
    const checkout = searchParams.checkout;
    if (checkout === "success") {
      showToast("Subscription activated!", "info");
    } else if (checkout === "cancelled") {
      showToast("Checkout cancelled.", "info");
    }
    if (checkout) {
      setSearchParams({ checkout: undefined }, { replace: true });
    }

    fetchActivePoll();
  });

  async function fetchActivePoll() {
    try {
      const res = await api<{ poll: ActivePoll | null }>("/api/polls/active");
      setPoll(res.poll);
    } catch (err) {
      console.error("Poll fetch failed:", err);
    }
  }

  async function castVote(feedbackId: string) {
    const activePoll = poll();
    if (!activePoll || voting()) return;
    setVoting(true);

    // Optimistic update
    const previousPoll = activePoll;
    setPoll({
      ...activePoll,
      userVote: feedbackId,
      totalVotes: (activePoll.totalVotes ?? 0) + 1,
      entries: activePoll.entries.map((e) =>
        e.feedbackId === feedbackId ? { ...e, votes: (e.votes ?? 0) + 1 } : e,
      ),
    });

    try {
      const res = await api<{ votes: Record<string, number>; totalVotes: number }>(
        `/api/polls/${activePoll.id}/vote`,
        {
          method: "POST",
          body: JSON.stringify({ feedbackId }),
        },
      );

      // Apply server-authoritative counts
      setPoll((p) => {
        if (!p) return p;
        return {
          ...p,
          totalVotes: res.totalVotes,
          entries: p.entries.map((e) => ({
            ...e,
            votes: res.votes[e.feedbackId] ?? 0,
          })),
        };
      });
    } catch (err) {
      // Revert optimistic update, then refetch authoritative state
      setPoll(previousPoll);
      const msg = err instanceof ApiRequestError ? err.body.message : "Vote failed";
      showToast(msg, "error");
      fetchActivePoll().catch(() => {});
    } finally {
      setVoting(false);
    }
  }

  const hasVoted = () => poll()?.userVote !== null && poll()?.userVote !== undefined;

  return (
    <div class="flex h-full flex-col items-center justify-start gap-4 overflow-y-auto px-6 pt-[15vh] text-center">
      <h1 class="text-2xl font-bold text-foreground">
        Welcome back{username() ? `, ${username()}` : ""}
      </h1>
      <p class="max-w-md text-sm text-muted-foreground">
        Select a server from the sidebar or start a DM to begin chatting.
      </p>

      {/* Poll Widget */}
      <Show when={poll()}>
        {(activePoll) => (
          <div class="mt-4 w-full max-w-lg rounded-xl border border-border bg-card p-5 text-left">
            <div class="mb-4">
              <h2 class="text-base font-semibold text-foreground">Community Poll</h2>
              <p class="text-xs text-muted-foreground">Vote for the next feature</p>
            </div>

            <div class="flex flex-col gap-2">
              <For each={activePoll().entries}>
                {(entry) => (
                  <Show
                    when={hasVoted()}
                    fallback={
                      <div class="flex items-center gap-1">
                        <button
                          class={`flex flex-1 items-center gap-3 rounded-lg border px-3 py-2.5 text-left text-sm transition-colors ${
                            voting()
                              ? "pointer-events-none border-border opacity-50"
                              : "border-border hover:border-primary/50 hover:bg-accent"
                          }`}
                          disabled={voting()}
                          onClick={() => castVote(entry.feedbackId)}
                        >
                          <span class="flex size-4 shrink-0 items-center justify-center rounded-full border-2 border-muted-foreground" />
                          <span class="flex-1 font-medium">{entry.title}</span>
                        </button>
                        <button
                          class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                          title="View description"
                          aria-label={`View description for ${entry.title}`}
                          onClick={() => setViewingEntry(entry)}
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                          </svg>
                        </button>
                      </div>
                    }
                  >
                    {/* Results view */}
                    {(() => {
                      const total = activePoll().totalVotes ?? 0;
                      const votes = entry.votes ?? 0;
                      const pct = total > 0 ? Math.round((votes / total) * 100) : 0;
                      const isUserChoice = activePoll().userVote === entry.feedbackId;
                      return (
                        <div class="relative overflow-hidden rounded-lg border border-border px-3 py-2.5">
                          {/* Progress bar background */}
                          <div
                            class={`absolute inset-y-0 left-0 transition-all duration-500 ${
                              isUserChoice ? "bg-primary/15" : "bg-muted"
                            }`}
                            style={{ width: `${pct}%` }}
                          />
                          <div class="relative flex items-center gap-3">
                            <Show when={isUserChoice}>
                              <span class="flex size-4 shrink-0 items-center justify-center rounded-full bg-primary">
                                <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
                                  <polyline points="20 6 9 17 4 12" />
                                </svg>
                              </span>
                            </Show>
                            <span class={`flex-1 text-sm font-medium ${isUserChoice ? "text-primary" : ""}`}>
                              {entry.title}
                            </span>
                            <span class="text-xs font-medium tabular-nums text-muted-foreground">
                              {pct}%
                            </span>
                            <button
                              class="shrink-0 rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                              title="View description"
                              aria-label={`View description for ${entry.title}`}
                              onClick={() => setViewingEntry(entry)}
                            >
                              <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
                              </svg>
                            </button>
                          </div>
                        </div>
                      );
                    })()}
                  </Show>
                )}
              </For>
            </div>

            <Show when={activePoll().totalVotes != null}>
              <p class="mt-3 text-xs text-muted-foreground">
                {activePoll().totalVotes} {activePoll().totalVotes === 1 ? "vote" : "votes"}
              </p>
            </Show>
          </div>
        )}
      </Show>

      {/* Entry detail dialog */}
      <Dialog open={viewingEntry() !== null} onOpenChange={(open) => { if (!open) setViewingEntry(null); }}>
        <DialogContent onClose={() => setViewingEntry(null)}>
          <DialogHeader>
            <DialogTitle>{viewingEntry()?.title}</DialogTitle>
            <DialogDescription>Feature request details</DialogDescription>
          </DialogHeader>
          <p class="whitespace-pre-wrap text-sm text-foreground">
            {viewingEntry()?.description}
          </p>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Home;
