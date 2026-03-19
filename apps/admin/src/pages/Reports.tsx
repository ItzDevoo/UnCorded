import { createSignal, onMount, For } from "solid-js";
import type { ReportRow, ReportsResponse } from "@uncorded/shared";
import { reportsResponseSchema } from "@uncorded/shared";
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

const FILTERS = ["unresolved", "resolved", "all"] as const;

const Reports = () => {
  const [data, setData] = createSignal<ReportsResponse>({
    reports: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = createSignal(true);
  const [filter, setFilter] = createSignal<string>("unresolved");
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [confirmTarget, setConfirmTarget] = createSignal<{ id: string; action: "resolve" | "delete" } | null>(null);
  const [submitting, setSubmitting] = createSignal(false);

  let fetchCounter = 0;

  async function fetchReports(page: number, f?: string) {
    const id = ++fetchCounter;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      const filterValue = f ?? filter();
      if (filterValue !== "all") params.set("filter", filterValue);
      const res = await api(`/api/admin/reports?${params}`, undefined, reportsResponseSchema);
      if (id !== fetchCounter) return;
      setData(res);
    } catch {
      if (id !== fetchCounter) return;
      showToast("Failed to load reports", "error");
    } finally {
      if (id === fetchCounter) setLoading(false);
    }
  }

  onMount(() => fetchReports(1));

  function openConfirm(id: string, action: "resolve" | "delete") {
    setConfirmTarget({ id, action });
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    const target = confirmTarget();
    if (!target || submitting()) return;
    setSubmitting(true);
    try {
      if (target.action === "resolve") {
        await api(`/api/admin/reports/${target.id}/resolve`, { method: "POST" });
        showToast("Report resolved", "info");
      } else {
        await api(`/api/admin/reports/${target.id}`, { method: "DELETE" });
        showToast("Report deleted", "info");
      }
      await fetchReports(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    } finally {
      setSubmitting(false);
      setConfirmOpen(false);
    }
  }

  const columns: Column<ReportRow>[] = [
    {
      header: "Reporter",
      accessor: (row) => (
        <span class="text-sm">{row.reporterUsername ?? "Deleted user"}</span>
      ),
    },
    {
      header: "Category",
      accessor: (row) => (
        <Badge variant={row.category === "csam" || row.category === "intimate_image" ? "destructive" : "outline"}>
          {row.category.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      header: "Status",
      accessor: (row) =>
        row.resolved ? (
          <Badge variant="success">Resolved</Badge>
        ) : (
          <Badge variant="warning">Open</Badge>
        ),
    },
    {
      header: "Date",
      accessor: (row) => (
        <span class="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleDateString()}
        </span>
      ),
    },
    {
      header: "",
      accessor: (row) => (
        <div class="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          {!row.resolved && (
            <Button variant="outline" size="sm" onClick={() => openConfirm(row.id, "resolve")}>
              Resolve
            </Button>
          )}
          <Button variant="ghost" size="sm" class="text-destructive" onClick={() => openConfirm(row.id, "delete")}>
            Delete
          </Button>
        </div>
      ),
      class: "text-right",
    },
  ];

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Reports</h1>

      <DataTable
        columns={columns}
        data={data().reports}
        total={data().total}
        page={data().page}
        pageSize={data().pageSize}
        onPageChange={(p) => fetchReports(p)}
        loading={loading()}
        actions={
          <div class="flex rounded-lg border border-border p-0.5">
            <For each={FILTERS}>
              {(f) => (
                <button
                  class={`rounded-md px-3 py-1 text-xs font-medium transition-colors ${
                    filter() === f
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                  onClick={() => {
                    setFilter(f);
                    fetchReports(1, f);
                  }}
                >
                  {f.charAt(0).toUpperCase() + f.slice(1)}
                </button>
              )}
            </For>
          </div>
        }
        expandRow={(row) => (
          <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-2">
            <div>
              <p class="text-muted-foreground">Report ID</p>
              <p class="font-mono">{row.id}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Message ID</p>
              <p class="font-mono">{row.messageId ?? "N/A"}</p>
            </div>
            <div>
              <p class="text-muted-foreground">File Receipt ID</p>
              <p class="font-mono">{row.fileReceiptId ?? "N/A"}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Reporter ID</p>
              <p class="font-mono">{row.reporterId ?? "N/A"}</p>
            </div>
            <div class="sm:col-span-2">
              <p class="text-muted-foreground">Details</p>
              <p class="mt-1 whitespace-pre-wrap">{row.details || "No additional details"}</p>
            </div>
          </div>
        )}
      />

      {/* Confirm Modal */}
      <Dialog open={confirmOpen()} onOpenChange={setConfirmOpen}>
        <DialogContent onClose={() => setConfirmOpen(false)}>
          <DialogHeader>
            <DialogTitle>
              {confirmTarget()?.action === "resolve" ? "Resolve Report" : "Delete Report"}
            </DialogTitle>
            <DialogDescription>
              {confirmTarget()?.action === "resolve"
                ? "Mark this report as resolved?"
                : "Permanently delete this report? This cannot be undone."}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={confirmTarget()?.action === "delete" ? "destructive" : "default"}
              onClick={handleConfirm}
              disabled={submitting()}
            >
              {submitting()
                ? "Processing..."
                : confirmTarget()?.action === "resolve" ? "Resolve" : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Reports;
