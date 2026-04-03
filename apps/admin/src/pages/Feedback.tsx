import { createSignal, onMount, Show, For } from "solid-js";
import type { FeedbackRow, FeedbackResponse } from "@uncorded/shared";
import { feedbackResponseSchema } from "@uncorded/shared";
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

const STATUS_OPTIONS = ["open", "in_progress", "completed", "rejected", "won_poll"] as const;

const AdminFeedback = () => {
  const [data, setData] = createSignal<FeedbackResponse>({
    feedback: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = createSignal(true);
  const [pendingRowId, setPendingRowId] = createSignal<string | null>(null);

  // Note modal
  const [noteOpen, setNoteOpen] = createSignal(false);
  const [noteTarget, setNoteTarget] = createSignal<FeedbackRow | null>(null);
  const [noteText, setNoteText] = createSignal("");
  const [noteSubmitting, setNoteSubmitting] = createSignal(false);

  let fetchCounter = 0;

  async function fetchFeedback(page: number) {
    const id = ++fetchCounter;
    setLoading(true);
    try {
      const res = await api(`/api/admin/feedback?page=${page}`, undefined, feedbackResponseSchema);
      if (id !== fetchCounter) return;
      setData(res as FeedbackResponse);
    } catch {
      if (id !== fetchCounter) return;
      showToast("Failed to load feedback", "error");
    } finally {
      if (id === fetchCounter) setLoading(false);
    }
  }

  onMount(() => fetchFeedback(1));

  async function updateStatus(id: string, status: string) {
    if (pendingRowId() === id) return;
    setPendingRowId(id);
    try {
      await api(`/api/admin/feedback/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status }),
      });
      showToast("Status updated", "info");
      await fetchFeedback(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    } finally {
      setPendingRowId(null);
    }
  }

  function openNoteModal(row: FeedbackRow) {
    setNoteTarget(row);
    setNoteText(row.adminNote ?? "");
    setNoteOpen(true);
  }

  async function submitNote() {
    const target = noteTarget();
    if (!target || noteSubmitting()) return;
    setNoteSubmitting(true);
    try {
      await api(`/api/admin/feedback/${target.id}`, {
        method: "PATCH",
        body: JSON.stringify({ adminNote: noteText().trim() || null }),
      });
      showToast("Note saved", "info");
      setNoteOpen(false);
      await fetchFeedback(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    } finally {
      setNoteSubmitting(false);
    }
  }

  async function deleteFeedback(id: string) {
    if (!window.confirm("Are you sure you want to delete this feedback?")) return;
    try {
      await api(`/api/admin/feedback/${id}`, { method: "DELETE" });
      showToast("Feedback deleted", "info");
      await fetchFeedback(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    }
  }

  const columns: Column<FeedbackRow>[] = [
    {
      header: "Title",
      accessor: (row) => (
        <div class="max-w-xs">
          <p class="truncate text-sm font-medium">{row.title}</p>
          <p class="text-xs text-muted-foreground">{row.authorUsername ?? "Deleted"}</p>
        </div>
      ),
    },
    {
      header: "Type",
      accessor: (row) => (
        <Badge variant={row.type === "bug" ? "destructive" : "info"}>{row.type}</Badge>
      ),
    },
    {
      header: "Status",
      accessor: (row) => (
        <div class="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <For each={STATUS_OPTIONS}>
            {(s) => (
              <button
                class={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
                  row.status === s
                    ? "bg-primary/15 text-primary"
                    : "text-muted-foreground hover:bg-accent hover:text-foreground"
                } ${pendingRowId() === row.id ? "pointer-events-none opacity-50" : ""}`}
                disabled={pendingRowId() === row.id}
                onClick={() => updateStatus(row.id, s)}
              >
                {s.replace(/_/g, " ")}
              </button>
            )}
          </For>
        </div>
      ),
    },
    {
      header: "Votes",
      accessor: (row) => <span class="text-sm font-medium tabular-nums">{row.voteCount}</span>,
    },
    {
      header: "",
      accessor: (row) => (
        <div class="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => openNoteModal(row)}>
            {row.adminNote ? "Edit Note" : "Add Note"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive"
            onClick={() => deleteFeedback(row.id)}
          >
            Delete
          </Button>
        </div>
      ),
      class: "text-right",
    },
  ];

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Feedback</h1>

      <DataTable
        columns={columns}
        data={data().feedback}
        total={data().total}
        page={data().page}
        pageSize={data().pageSize}
        onPageChange={(p) => fetchFeedback(p)}
        loading={loading()}
        expandRow={(row) => (
          <div class="space-y-3 text-xs">
            <div>
              <p class="text-muted-foreground">Description</p>
              <p class="mt-1 whitespace-pre-wrap text-sm">{row.description}</p>
            </div>
            <Show when={row.adminNote}>
              <div class="rounded-lg border border-primary/20 bg-primary/5 px-3 py-2">
                <p class="text-xs font-medium text-primary">Admin Note</p>
                <p class="mt-1 text-sm">{row.adminNote}</p>
              </div>
            </Show>
            <div class="flex gap-6 text-muted-foreground">
              <span>
                ID: <span class="font-mono text-foreground">{row.id}</span>
              </span>
              <span>Created: {new Date(row.createdAt).toLocaleString()}</span>
              <span>Updated: {new Date(row.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        )}
      />

      {/* Admin Note Modal */}
      <Dialog open={noteOpen()} onOpenChange={setNoteOpen}>
        <DialogContent onClose={() => setNoteOpen(false)}>
          <DialogHeader>
            <DialogTitle>Admin Note</DialogTitle>
            <DialogDescription>
              Add a response visible to the user for: {noteTarget()?.title}
            </DialogDescription>
          </DialogHeader>
          <textarea
            value={noteText()}
            onInput={(e) => setNoteText(e.currentTarget.value)}
            placeholder="Write your response..."
            rows={4}
            class="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
          />
          <DialogFooter>
            <Button variant="ghost" onClick={() => setNoteOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitNote} disabled={noteSubmitting()}>
              {noteSubmitting() ? "Saving..." : "Save Note"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminFeedback;
