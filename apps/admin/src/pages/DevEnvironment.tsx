import { createSignal, onMount, Show, For } from "solid-js";
import { z } from "zod";
import { api } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Card, CardHeader, CardTitle, CardContent } from "../components/ui/card.js";

const devStatusSchema = z.object({
  branch: z.string(),
  switchedAt: z.string().nullable(),
  switchedBy: z.string().nullable(),
  status: z.enum(["active", "pending"]),
});

const branchesSchema = z.object({
  branches: z.array(z.string()),
});

type DevStatus = z.infer<typeof devStatusSchema>;

const formatDate = (iso: string | null) => {
  if (!iso) return "Never";
  return new Date(iso).toLocaleString();
};

const DevEnvironment = () => {
  const [status, setStatus] = createSignal<DevStatus | null>(null);
  const [branches, setBranches] = createSignal<string[]>([]);
  const [selectedBranch, setSelectedBranch] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [switching, setSwitching] = createSignal(false);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [statusRes, branchesRes] = await Promise.all([
        api<unknown>("/api/admin/dev-status"),
        api<unknown>("/api/admin/branches"),
      ]);

      const statusParsed = devStatusSchema.safeParse(statusRes);
      if (statusParsed.success) {
        setStatus(statusParsed.data);
      } else {
        setStatus(null);
        console.warn("dev-status parse failed:", statusParsed.error.message);
        showToast("Dev status response has unexpected shape", "error");
      }

      const branchesParsed = branchesSchema.safeParse(branchesRes);
      if (branchesParsed.success) {
        const newBranches = branchesParsed.data.branches;
        setBranches(newBranches);
        if (!selectedBranch() || !newBranches.includes(selectedBranch())) {
          setSelectedBranch(newBranches[0] ?? "");
        }
      } else {
        setBranches([]);
        setSelectedBranch("");
        console.warn("branches parse failed:", branchesParsed.error.message);
        showToast("Branches response has unexpected shape", "error");
      }
    } catch {
      setStatus(null);
      setBranches([]);
      setSelectedBranch("");
      showToast("Failed to load dev environment data", "error");
    } finally {
      setLoading(false);
    }
  };

  onMount(fetchData);

  const handleSwitch = async () => {
    const branch = selectedBranch();
    if (!branch) return;

    setSwitching(true);
    try {
      await api("/api/admin/switch-dev", {
        method: "POST",
        body: JSON.stringify({ branch }),
      });
      showToast(`Branch marked for switch to "${branch}"`, "info");
      await fetchData();
    } catch {
      showToast("Failed to switch branch", "error");
    } finally {
      setSwitching(false);
    }
  };

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Dev Environment</h1>

      <Show
        when={!loading()}
        fallback={
          <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <Card>
              <CardContent class="p-5">
                <div class="h-24 animate-pulse rounded-lg bg-muted" />
              </CardContent>
            </Card>
            <Card>
              <CardContent class="p-5">
                <div class="h-24 animate-pulse rounded-lg bg-muted" />
              </CardContent>
            </Card>
          </div>
        }
      >
        <div class="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {/* Current Status */}
          <Card>
            <CardHeader>
              <CardTitle>Current Status</CardTitle>
            </CardHeader>
            <CardContent>
              <Show when={status()} fallback={<p class="text-sm text-muted-foreground">No status available</p>}>
                {(s) => (
                  <div class="space-y-3">
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-muted-foreground">
                        {s().status === "pending" ? "Pending Branch" : "Active Branch"}
                      </span>
                      <span class="rounded-md bg-primary/10 px-2.5 py-1 text-sm font-medium text-primary">
                        {s().branch}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-muted-foreground">Status</span>
                      <span
                        class={`rounded-md px-2.5 py-1 text-sm font-medium ${
                          s().status === "active"
                            ? "bg-success/10 text-success"
                            : "bg-warning/10 text-warning"
                        }`}
                      >
                        {s().status === "active" ? "Active" : "Pending Rebuild"}
                      </span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-muted-foreground">Switched At</span>
                      <span class="text-sm">{formatDate(s().switchedAt)}</span>
                    </div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm text-muted-foreground">Switched By</span>
                      <span class="text-sm">{s().switchedBy ?? "—"}</span>
                    </div>
                  </div>
                )}
              </Show>
            </CardContent>
          </Card>

          {/* Branch Selector */}
          <Card>
            <CardHeader>
              <CardTitle>Switch Branch</CardTitle>
            </CardHeader>
            <CardContent>
              <div class="space-y-4">
                <div>
                  <label for="branch-select" class="mb-1.5 block text-sm font-medium text-muted-foreground">
                    Target Branch
                  </label>
                  <select
                    id="branch-select"
                    value={selectedBranch()}
                    onChange={(e) => setSelectedBranch(e.currentTarget.value)}
                    disabled={switching()}
                    class="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-primary focus:ring-1 focus:ring-primary disabled:opacity-50"
                  >
                    <For each={branches()}>
                      {(branch) => <option value={branch}>{branch}</option>}
                    </For>
                  </select>
                </div>

                <button
                  onClick={handleSwitch}
                  disabled={switching() || !selectedBranch() || selectedBranch() === status()?.branch}
                  class="w-full rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {switching() ? "Marking..." : "Mark for Switch"}
                </button>

                <Show when={status()?.status === "pending"}>
                  <p class="rounded-lg border border-warning/30 bg-warning/5 px-3 py-2 text-xs text-warning">
                    Rebuild pending — tell Git Manager: <span class="font-mono">switch dev to {status()?.branch}</span>
                  </p>
                </Show>
              </div>
            </CardContent>
          </Card>
        </div>
      </Show>
    </div>
  );
};

export default DevEnvironment;
