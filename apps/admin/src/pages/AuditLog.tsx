import { createSignal, onMount } from "solid-js";
import type { AuditEntry, AuditResponse } from "@uncorded/shared";
import { api } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Badge } from "../components/ui/badge.js";
import { DataTable, type Column } from "../components/DataTable.js";

const ACTION_VARIANTS: Record<string, "default" | "destructive" | "warning" | "info" | "success"> = {
  ban_user: "destructive",
  unban_user: "success",
  delete_user: "destructive",
  gift_tier: "info",
  revoke_gift: "warning",
  resolve_report: "success",
  delete_report: "destructive",
  update_feedback: "info",
  delete_feedback: "destructive",
  add_admin: "info",
  remove_admin: "warning",
};

function formatDetails(details: string | null): string {
  if (!details) return "";
  try {
    const parsed: Record<string, unknown> = JSON.parse(details);
    return Object.entries(parsed)
      .map(([k, v]) => {
        const display = typeof v === "object" && v !== null ? JSON.stringify(v) : String(v);
        return `${k}: ${display}`;
      })
      .join(", ");
  } catch {
    return details;
  }
}

const AuditLog = () => {
  const [data, setData] = createSignal<AuditResponse>({
    entries: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = createSignal(true);

  async function fetchLog(page: number) {
    setLoading(true);
    try {
      const res = await api<AuditResponse>(`/api/admin/audit-log?page=${page}`);
      setData(res);
    } catch {
      showToast("Failed to load audit log", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(() => fetchLog(1));

  const columns: Column<AuditEntry>[] = [
    {
      header: "Admin",
      accessor: (row) => (
        <span class="text-sm font-medium">{row.adminUsername ?? "Unknown"}</span>
      ),
    },
    {
      header: "Action",
      accessor: (row) => (
        <Badge variant={ACTION_VARIANTS[row.action] ?? "outline"}>
          {row.action.replace(/_/g, " ")}
        </Badge>
      ),
    },
    {
      header: "Target",
      accessor: (row) => (
        <span class="text-xs text-muted-foreground">
          {row.targetType}
        </span>
      ),
    },
    {
      header: "When",
      accessor: (row) => (
        <span class="text-xs text-muted-foreground">
          {new Date(row.createdAt).toLocaleString()}
        </span>
      ),
    },
  ];

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Audit Log</h1>

      <DataTable
        columns={columns}
        data={data().entries}
        total={data().total}
        page={data().page}
        pageSize={data().pageSize}
        onPageChange={(p) => fetchLog(p)}
        loading={loading()}
        expandRow={(row) => (
          <div class="grid grid-cols-1 gap-3 text-xs sm:grid-cols-3">
            <div>
              <p class="text-muted-foreground">Target ID</p>
              <p class="font-mono text-foreground">{row.targetId}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Admin ID</p>
              <p class="font-mono text-foreground">{row.adminId}</p>
            </div>
            <div>
              <p class="text-muted-foreground">Details</p>
              <p class="text-foreground">{formatDetails(row.details) || "No details"}</p>
            </div>
          </div>
        )}
      />
    </div>
  );
};

export default AuditLog;
