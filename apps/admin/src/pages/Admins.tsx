import { createSignal, onMount, Show, For } from "solid-js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { Input } from "../components/ui/input.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import { adminLevel } from "../components/AdminGuard.js";

interface AdminRow {
  id: string;
  userId: string;
  level: string;
  addedAt: string;
  username: string | null;
  email: string | null;
}

const Admins = () => {
  const [admins, setAdmins] = createSignal<AdminRow[]>([]);
  const [newUserId, setNewUserId] = createSignal("");
  const [loading, setLoading] = createSignal(true);
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [removeTarget, setRemoveTarget] = createSignal<AdminRow | null>(null);

  const isOwner = () => adminLevel() === "owner";

  async function fetchAdmins() {
    setLoading(true);
    try {
      const res = await api<{ admins: AdminRow[] }>("/api/admin/admins");
      setAdmins(res.admins);
    } catch {
      showToast("Failed to load admins", "error");
    } finally {
      setLoading(false);
    }
  }

  onMount(fetchAdmins);

  async function addAdmin() {
    const userId = newUserId().trim();
    if (!userId) return;
    try {
      await api("/api/admin/admins", {
        method: "POST",
        body: JSON.stringify({ userId }),
      });
      showToast("Admin added", "info");
      setNewUserId("");
      await fetchAdmins();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to add admin";
      showToast(msg, "error");
    }
  }

  function confirmRemove(admin: AdminRow) {
    setRemoveTarget(admin);
    setConfirmOpen(true);
  }

  async function handleRemove() {
    const target = removeTarget();
    if (!target) return;
    try {
      await api(`/api/admin/admins/${target.id}`, { method: "DELETE" });
      showToast("Admin removed", "info");
      await fetchAdmins();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to remove admin";
      showToast(msg, "error");
    }
    setConfirmOpen(false);
  }

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Admin Management</h1>

      <Show when={isOwner()}>
        <div class="mb-6 flex gap-3">
          <Input
            placeholder="User ID to add as admin"
            value={newUserId()}
            onInput={(e) => setNewUserId(e.currentTarget.value)}
            class="max-w-sm"
            onKeyDown={(e) => {
              if (e.key === "Enter") addAdmin();
            }}
          />
          <Button onClick={addAdmin}>Add Admin</Button>
        </div>
      </Show>

      <div class="overflow-x-auto rounded-xl border border-border">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b border-border bg-muted/30">
              <th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">User</th>
              <th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Level</th>
              <th class="px-4 py-2.5 text-left text-xs font-medium uppercase tracking-wider text-muted-foreground">Added</th>
              <Show when={isOwner()}>
                <th class="px-4 py-2.5 text-right text-xs font-medium uppercase tracking-wider text-muted-foreground">Actions</th>
              </Show>
            </tr>
          </thead>
          <tbody>
            <Show
              when={!loading()}
              fallback={
                <For each={Array.from({ length: 3 })}>
                  {() => (
                    <tr class="border-b border-border last:border-0">
                      <td class="px-4 py-3" colSpan={isOwner() ? 4 : 3}>
                        <div class="h-4 w-32 animate-pulse rounded bg-muted" />
                      </td>
                    </tr>
                  )}
                </For>
              }
            >
              <For each={admins()}>
                {(admin) => (
                  <tr class="border-b border-border last:border-0 hover:bg-accent/20 transition-colors">
                    <td class="px-4 py-2.5">
                      <div>
                        <p class="font-medium">{admin.username ?? "—"}</p>
                        <p class="text-xs text-muted-foreground">{admin.email ?? admin.userId}</p>
                      </div>
                    </td>
                    <td class="px-4 py-2.5">
                      <Badge variant={admin.level === "owner" ? "default" : "outline"}>
                        {admin.level}
                      </Badge>
                    </td>
                    <td class="px-4 py-2.5">
                      <span class="text-xs text-muted-foreground">
                        {new Date(admin.addedAt).toLocaleDateString()}
                      </span>
                    </td>
                    <Show when={isOwner()}>
                      <td class="px-4 py-2.5 text-right">
                        <Show when={admin.level !== "owner"}>
                          <Button
                            variant="ghost"
                            size="sm"
                            class="text-destructive"
                            onClick={() => confirmRemove(admin)}
                          >
                            Remove
                          </Button>
                        </Show>
                      </td>
                    </Show>
                  </tr>
                )}
              </For>
            </Show>
          </tbody>
        </table>
      </div>

      {/* Confirm Remove Modal */}
      <Dialog open={confirmOpen()} onOpenChange={setConfirmOpen}>
        <DialogContent onClose={() => setConfirmOpen(false)}>
          <DialogHeader>
            <DialogTitle>Remove Admin</DialogTitle>
            <DialogDescription>
              Remove {removeTarget()?.username ?? removeTarget()?.email} as admin?
              They will lose all admin privileges.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleRemove}>
              Remove
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Admins;
