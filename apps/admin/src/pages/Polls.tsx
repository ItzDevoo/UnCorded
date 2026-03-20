import { createSignal, onMount, Show, For } from "solid-js";
import type { PollRow, PollsResponse } from "@uncorded/shared";
import { pollsResponseSchema } from "@uncorded/shared";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import { DataTable, type Column } from "../components/DataTable.js";

const AdminPolls = () => {
  const [data, setData] = createSignal<PollsResponse>({
    polls: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = createSignal(true);
  const [creating, setCreating] = createSignal(false);
  const [confirmClose, setConfirmClose] = createSignal<PollRow | null>(null);
  const [closing, setClosing] = createSignal(false);

  let fetchCounter = 0;

  const hasActivePoll = () => data().polls.some((p) => p.closedAt === null);

  async function fetchPolls(page: number) {
    const id = ++fetchCounter;
    setLoading(true);
    try {
      const res = await api(`/api/admin/polls?page=${page}`, undefined, pollsResponseSchema);
      if (id !== fetchCounter) return;
      setData(res);
    } catch {
      if (id !== fetchCounter) return;
      showToast("Failed to load polls", "error");
    } finally {
      if (id === fetchCounter) setLoading(false);
    }
  }

  onMount(() => fetchPolls(1));

  async function createPoll() {
    if (creating()) return;
    setCreating(true);
    try {
      await api("/api/admin/polls", { method: "POST" });
      showToast("Poll created from top 5 features", "info");
      await fetchPolls(1);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to create poll";
      showToast(msg, "error");
    } finally {
      setCreating(false);
    }
  }

  async function closePoll() {
    const target = confirmClose();
    if (!target || closing()) return;
    setClosing(true);
    try {
      await api(`/api/admin/polls/${target.id}/close`, { method: "POST" });
      showToast("Poll closed", "info");
      setConfirmClose(null);
      await fetchPolls(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to close poll";
      showToast(msg, "error");
    } finally {
      setClosing(false);
    }
  }

  const columns: Column<PollRow>[] = [
    {
      header: "Created",
      accessor: (row) => (
        <span class="text-sm">{new Date(row.createdAt).toLocaleDateString()}</span>
      ),
    },
    {
      header: "Status",
      accessor: (row) => (
        <Badge variant={row.closedAt === null ? "success" : "outline"}>
          {row.closedAt === null ? "Active" : "Closed"}
        </Badge>
      ),
    },
    {
      header: "Total Votes",
      accessor: (row) => (
        <span class="text-sm font-medium tabular-nums">{row.totalVotes}</span>
      ),
    },
    {
      header: "Winner",
      accessor: (row) => {
        if (row.closedAt === null) return <span class="text-xs text-muted-foreground">—</span>;
        if (!row.winnerId) return <span class="text-xs text-muted-foreground">No votes</span>;
        const winner = row.entries.find((e) => e.feedbackId === row.winnerId);
        return (
          <span class="text-sm font-medium text-primary">
            {winner?.title ?? "Unknown"}
          </span>
        );
      },
    },
    {
      header: "",
      accessor: (row) => (
        <div class="flex justify-end" onClick={(e) => e.stopPropagation()}>
          <Show when={row.closedAt === null}>
            <Button
              variant="destructive"
              size="sm"
              onClick={() => setConfirmClose(row)}
            >
              Close Poll
            </Button>
          </Show>
        </div>
      ),
      class: "text-right",
    },
  ];

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Polls</h1>

      <DataTable
        columns={columns}
        data={data().polls}
        total={data().total}
        page={data().page}
        pageSize={data().pageSize}
        onPageChange={(p) => fetchPolls(p)}
        loading={loading()}
        actions={
          <Button
            onClick={createPoll}
            disabled={creating() || hasActivePoll()}
          >
            {creating() ? "Creating..." : "Create Poll"}
          </Button>
        }
        expandRow={(row) => (
          <div class="space-y-2">
            <p class="text-xs font-medium text-muted-foreground">
              Entries ({row.entries.length})
            </p>
            <div class="grid gap-2">
              <For each={row.entries}>
                {(entry) => {
                  const isWinner = row.winnerId === entry.feedbackId;
                  return (
                    <div class={`flex items-center justify-between rounded-lg border px-3 py-2 ${
                      isWinner ? "border-primary/30 bg-primary/5" : "border-border"
                    }`}>
                      <div class="min-w-0 flex-1">
                        <p class={`text-sm font-medium ${isWinner ? "text-primary" : ""}`}>
                          {entry.title}
                          <Show when={isWinner}>
                            <Badge variant="success" class="ml-2">Winner</Badge>
                          </Show>
                        </p>
                        <p class="mt-0.5 truncate text-xs text-muted-foreground">
                          {entry.description}
                        </p>
                      </div>
                      <span class="ml-4 shrink-0 text-sm font-medium tabular-nums">
                        {entry.pollVotes} {entry.pollVotes === 1 ? "vote" : "votes"}
                      </span>
                    </div>
                  );
                }}
              </For>
            </div>
            <div class="flex gap-6 text-xs text-muted-foreground">
              <span>ID: <span class="font-mono text-foreground">{row.id}</span></span>
              <span>Created: {new Date(row.createdAt).toLocaleString()}</span>
              <Show when={row.closedAt}>
                <span>Closed: {new Date(row.closedAt!).toLocaleString()}</span>
              </Show>
            </div>
          </div>
        )}
      />

      {/* Close Poll Confirmation Dialog */}
      <Dialog open={confirmClose() !== null} onOpenChange={(open) => { if (!open) setConfirmClose(null); }}>
        <DialogContent onClose={() => setConfirmClose(null)}>
          <DialogHeader>
            <DialogTitle>Close Poll</DialogTitle>
            <DialogDescription>
              This will close the active poll and set the winning feature's status to "won_poll". This action cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmClose(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={closePoll} disabled={closing()}>
              {closing() ? "Closing..." : "Close Poll"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPolls;
