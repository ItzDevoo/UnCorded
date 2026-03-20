import { createSignal, onMount, For, Show } from "solid-js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card.js";
import FeedbackDialog from "../components/modals/FeedbackDialog.js";

interface FeedbackItem {
  id: string;
  type: string;
  title: string;
  description: string;
  status: string;
  voteCount: number;
  adminNote: string | null;
  createdAt: string;
  authorUsername: string | null;
  voted: boolean;
}

interface FeedbackResponse {
  feedback: FeedbackItem[];
  page: number;
  pageSize: number;
}

const statusBadgeVariant = (status: string) => {
  switch (status) {
    case "completed":
      return "success" as const;
    case "rejected":
      return "destructive" as const;
    case "in_progress":
      return "info" as const;
    default:
      return "warning" as const;
  }
};

const Feedback = () => {
  const [items, setItems] = createSignal<FeedbackItem[]>([]);
  const [sort, setSort] = createSignal<"votes" | "recent">("votes");
  const [dialogOpen, setDialogOpen] = createSignal(false);
  const [loading, setLoading] = createSignal(true);

  async function fetchFeedback() {
    setLoading(true);
    try {
      const params = new URLSearchParams({
        type: "feature",
        sort: sort(),
      });
      const res = await api<FeedbackResponse>(`/api/feedback?${params}`);
      setItems(res.feedback);
    } catch {
      showToast("Failed to load feature requests", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchFeedback);

  async function toggleVote(id: string) {
    try {
      const res = await api<{ voted: boolean }>(`/api/feedback/${id}/vote`, {
        method: "POST",
      });
      setItems((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                voted: res.voted,
                voteCount: item.voteCount + (res.voted ? 1 : -1),
              }
            : item,
        ),
      );
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to vote";
      showToast(msg, "error");
    }
  }

  function switchSort(s: "votes" | "recent") {
    setSort(s);
    fetchFeedback();
  }

  return (
    <div class="mx-auto max-w-3xl p-6">
      <div class="mb-6 flex items-center justify-between">
        <h1 class="text-2xl font-bold">Feature Requests</h1>
        <Button onClick={() => setDialogOpen(true)}>Submit Feature Request</Button>
      </div>

      <div class="mb-4 flex items-center justify-end gap-2">
        <Button
          variant={sort() === "votes" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={sort() === "votes"}
          onClick={() => switchSort("votes")}
        >
          Top Voted
        </Button>
        <Button
          variant={sort() === "recent" ? "secondary" : "ghost"}
          size="sm"
          aria-pressed={sort() === "recent"}
          onClick={() => switchSort("recent")}
        >
          Recent
        </Button>
      </div>

      <Show
        when={!loading()}
        fallback={<p class="py-8 text-center text-muted-foreground">Loading...</p>}
      >
        <Show
          when={items().length > 0}
          fallback={
            <p class="py-8 text-center text-muted-foreground">
              No feature requests yet. Be the first!
            </p>
          }
        >
          <div class="space-y-3">
            <For each={items()}>
              {(item) => (
                <Card>
                  <CardHeader class="pb-2">
                    <div class="flex items-start gap-3">
                      <button
                        class={`mt-0.5 flex flex-col items-center rounded-lg border px-2.5 py-1.5 text-xs font-medium transition-colors ${
                          item.voted
                            ? "border-primary bg-primary/10 text-primary"
                            : "border-border text-muted-foreground hover:border-primary/50 hover:text-primary"
                        }`}
                        aria-label={item.voted ? `Remove upvote (${item.voteCount} votes)` : `Upvote (${item.voteCount} votes)`}
                        aria-pressed={item.voted}
                        onClick={() => toggleVote(item.id)}
                      >
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          width="12"
                          height="12"
                          viewBox="0 0 24 24"
                          fill={item.voted ? "currentColor" : "none"}
                          stroke="currentColor"
                          stroke-width="2"
                          stroke-linecap="round"
                          stroke-linejoin="round"
                        >
                          <path d="m18 15-6-6-6 6" />
                        </svg>
                        <span>{item.voteCount}</span>
                      </button>
                      <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-2">
                          <CardTitle class="text-base">{item.title}</CardTitle>
                          <Badge variant={statusBadgeVariant(item.status)}>
                            {item.status.replace("_", " ")}
                          </Badge>
                        </div>
                        <p class="mt-0.5 text-xs text-muted-foreground">
                          by {item.authorUsername ?? "Anonymous"} &middot;{" "}
                          {new Date(item.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent>
                    <p class="text-sm text-foreground/80">{item.description}</p>
                    <Show when={item.adminNote}>
                      <div class="mt-3 rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                        <p class="text-xs font-medium text-primary">Admin Response</p>
                        <p class="mt-1 text-sm text-foreground/80">{item.adminNote}</p>
                      </div>
                    </Show>
                  </CardContent>
                </Card>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <FeedbackDialog
        open={dialogOpen()}
        onClose={() => setDialogOpen(false)}
        onSubmitted={fetchFeedback}
      />
    </div>
  );
};

export default Feedback;
