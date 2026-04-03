import { createSignal, onMount, For, Show } from "solid-js";
import type { UserRow, UsersResponse, UserBotsResponse } from "@uncorded/shared";
import { usersResponseSchema, userBotsResponseSchema } from "@uncorded/shared";
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
import { DataTable, type Column } from "../components/DataTable.js";

const hasActiveGift = (row: UserRow) =>
  row.giftedTier && row.giftExpiresAt && new Date(row.giftExpiresAt) > new Date();

const Users = () => {
  const [data, setData] = createSignal<UsersResponse>({
    users: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");

  const [actionInFlight, setActionInFlight] = createSignal<string | null>(null);

  // Gift modal state
  const [giftOpen, setGiftOpen] = createSignal(false);
  const [giftTarget, setGiftTarget] = createSignal<UserRow | null>(null);
  const [giftTier, setGiftTier] = createSignal("supporter");
  const [giftDays, setGiftDays] = createSignal("30");
  const [giftReason, setGiftReason] = createSignal("");
  const [giftSubmitting, setGiftSubmitting] = createSignal(false);

  // Confirm modal state
  const [confirmOpen, setConfirmOpen] = createSignal(false);
  const [confirmAction, setConfirmAction] = createSignal<{
    title: string;
    description: string;
    variant: "destructive" | "default";
    onConfirm: () => Promise<void>;
  } | null>(null);

  // Delete modal state
  const [deleteOpen, setDeleteOpen] = createSignal(false);
  const [deleteTarget, setDeleteTarget] = createSignal<UserRow | null>(null);
  const [deleteConfirmInput, setDeleteConfirmInput] = createSignal("");
  const [deleteSubmitting, setDeleteSubmitting] = createSignal(false);

  let fetchRequestId = 0;

  async function fetchUsers(page: number, searchQuery?: string) {
    const currentId = ++fetchRequestId;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (searchQuery) params.set("search", searchQuery);
      const res = await api(`/api/admin/users?${params}`, undefined, usersResponseSchema);
      if (currentId !== fetchRequestId) return;
      setData(res as UsersResponse);
    } catch {
      if (currentId !== fetchRequestId) return;
      showToast("Failed to load users", "error");
    } finally {
      if (currentId === fetchRequestId) setLoading(false);
    }
  }

  onMount(() => fetchUsers(1));

  function handleSearch(query: string) {
    setSearch(query);
    fetchUsers(1, query);
  }

  // ── Bots cache ────────────────────────────────────

  const [botsCache, setBotsCache] = createSignal<
    Record<string, UserBotsResponse | "loading" | "error">
  >({});

  async function fetchUserBots(userId: string) {
    const cached = botsCache()[userId];
    if (cached && cached !== "error") return;
    setBotsCache((prev) => ({ ...prev, [userId]: "loading" }));
    try {
      const res = await api(`/api/admin/users/${userId}/bots`, undefined, userBotsResponseSchema);
      setBotsCache((prev) => ({ ...prev, [userId]: res as UserBotsResponse }));
    } catch {
      setBotsCache((prev) => ({ ...prev, [userId]: "error" }));
    }
  }

  // ── Gift actions ──────────────────────────────────

  function openGiftModal(userRow: UserRow) {
    setGiftTarget(userRow);
    setGiftTier(userRow.subscriptionTier === "server_owner" ? "server_owner" : "supporter");
    setGiftDays("30");
    setGiftReason("");
    setGiftOpen(true);
  }

  async function submitGift() {
    const target = giftTarget();
    if (!target || giftSubmitting() || actionInFlight()) return;
    setGiftSubmitting(true);
    setActionInFlight("giftTier");
    try {
      const parsed = parseInt(giftDays(), 10);
      const rawDays = isNaN(parsed) ? 30 : parsed;
      const clampedDays = Math.max(1, Math.min(365, rawDays));
      await api(`/api/admin/users/${target.id}/gift-tier`, {
        method: "POST",
        body: JSON.stringify({
          tier: giftTier(),
          days: clampedDays,
          reason: giftReason().trim() || undefined,
        }),
      });
      showToast(`Gifted ${giftTier()} for ${clampedDays} days`, "info");
      setGiftOpen(false);
      await fetchUsers(data().page, search());
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to gift";
      showToast(msg, "error");
    } finally {
      setGiftSubmitting(false);
      setActionInFlight(null);
    }
  }

  async function revokeGift(userId: string) {
    if (actionInFlight()) return;
    setActionInFlight("revokeGift");
    try {
      await api(`/api/admin/users/${userId}/revoke-gift`, { method: "POST" });
      showToast("Gift revoked", "info");
      await fetchUsers(data().page, search());
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    } finally {
      setActionInFlight(null);
    }
  }

  // ── Confirm actions ───────────────────────────────

  function confirmBan(user: UserRow) {
    setConfirmAction({
      title: user.banned ? "Unban User" : "Ban User",
      description: user.banned
        ? `Unban ${user.username ?? user.email}? They will regain access.`
        : `Ban ${user.username ?? user.email}? They will be immediately disconnected and unable to log in.`,
      variant: user.banned ? "default" : "destructive",
      onConfirm: async () => {
        await api(`/api/admin/users/${user.id}/${user.banned ? "unban" : "ban"}`, {
          method: "POST",
        });
        showToast(user.banned ? "User unbanned" : "User banned", "info");
        await fetchUsers(data().page, search());
      },
    });
    setConfirmOpen(true);
  }

  async function handleConfirm() {
    const action = confirmAction();
    if (!action || actionInFlight()) return;
    setActionInFlight("confirm");
    try {
      await action.onConfirm();
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    } finally {
      setActionInFlight(null);
      setConfirmOpen(false);
    }
  }

  // ── Delete actions ──────────────────────────────────

  function confirmDelete(userRow: UserRow) {
    setDeleteTarget(userRow);
    setDeleteConfirmInput("");
    setDeleteOpen(true);
  }

  async function handleDelete() {
    const target = deleteTarget();
    if (!target || deleteSubmitting() || actionInFlight()) return;
    const expectedName = target.username ?? target.email;
    if (deleteConfirmInput() !== expectedName) return;

    setDeleteSubmitting(true);
    setActionInFlight("delete");
    try {
      await api(`/api/admin/users/${target.id}`, { method: "DELETE" });
      showToast("User deleted", "info");
      setDeleteOpen(false);
      await fetchUsers(data().page, search());
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Failed to delete user";
      showToast(msg, "error");
    } finally {
      setDeleteSubmitting(false);
      setActionInFlight(null);
    }
  }

  // ── Table columns ─────────────────────────────────

  const columns: Column<UserRow>[] = [
    {
      header: "User",
      accessor: (row) => (
        <div class="flex items-center gap-2">
          <div>
            <p class="font-medium">{row.username ?? row.displayName ?? "—"}</p>
            <p class="text-xs text-muted-foreground">{row.email}</p>
          </div>
          <Show when={row.botCount && row.botCount > 0}>
            <Badge variant="outline" class="text-[10px]">
              {row.botCount} {row.botCount === 1 ? "bot" : "bots"}
            </Badge>
          </Show>
        </div>
      ),
    },
    {
      header: "Tier",
      accessor: (row) => (
        <div class="flex flex-col gap-1">
          <Badge variant={row.subscriptionTier === "free" ? "outline" : "default"}>
            {row.subscriptionTier}
          </Badge>
          {hasActiveGift(row) && (
            <span class="text-[10px] text-info">
              gifted until {new Date(row.giftExpiresAt!).toLocaleDateString()}
            </span>
          )}
        </div>
      ),
    },
    {
      header: "Status",
      accessor: (row) =>
        row.banned ? (
          <Badge variant="destructive">Banned</Badge>
        ) : (
          <span class="text-xs text-muted-foreground capitalize">{row.status}</span>
        ),
    },
    {
      header: "Joined",
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
          {hasActiveGift(row) ? (
            <Button variant="ghost" size="sm" onClick={() => revokeGift(row.id)}>
              Revoke
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={() => openGiftModal(row)}>
              Gift
            </Button>
          )}
          <Button
            variant="ghost"
            size="sm"
            class={row.banned ? "text-success" : "text-destructive"}
            onClick={() => confirmBan(row)}
          >
            {row.banned ? "Unban" : "Ban"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            class="text-destructive"
            onClick={() => confirmDelete(row)}
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
      <h1 class="mb-6 text-xl font-semibold">Users</h1>

      <DataTable
        columns={columns}
        data={data().users}
        total={data().total}
        page={data().page}
        pageSize={data().pageSize}
        onPageChange={(p) => fetchUsers(p, search())}
        searchPlaceholder="Search by username or email..."
        onSearch={handleSearch}
        loading={loading()}
        onExpand={(row) => fetchUserBots(row.id)}
        expandRow={(row) => {
          const botData = () => botsCache()[row.id];
          return (
            <div class="space-y-4">
              <div class="grid grid-cols-2 gap-x-8 gap-y-2 text-xs sm:grid-cols-4">
                <div>
                  <p class="text-muted-foreground">User ID</p>
                  <p class="font-mono">{row.id}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Email</p>
                  <p>{row.email}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Subscription Tier</p>
                  <p>{row.subscriptionTier}</p>
                </div>
                <div>
                  <p class="text-muted-foreground">Gifted Tier</p>
                  <p>
                    {hasActiveGift(row)
                      ? `${row.giftedTier} (expires ${new Date(row.giftExpiresAt!).toLocaleDateString()})`
                      : "None"}
                  </p>
                </div>
              </div>

              {/* Bots section */}
              <div class="border-t border-border pt-3">
                <p class="mb-2 text-xs font-medium text-muted-foreground">Bots</p>
                {(() => {
                  const raw = botData();
                  if (raw === "loading" || raw === undefined) {
                    return <p class="text-xs text-muted-foreground">Loading bots...</p>;
                  }
                  if (raw === "error") {
                    return (
                      <div class="flex items-center gap-2 text-xs">
                        <p class="text-destructive">Failed to load bots</p>
                        <Button variant="ghost" size="sm" onClick={() => fetchUserBots(row.id)}>
                          Retry
                        </Button>
                      </div>
                    );
                  }
                  if (raw.bots.length === 0) {
                    return <p class="text-xs text-muted-foreground">No bots</p>;
                  }
                  return (
                    <div class="space-y-2">
                      <For each={raw.bots}>
                        {(bot) => (
                          <div class="flex items-center gap-4 rounded-lg border border-border bg-card px-3 py-2 text-xs">
                            <div class="min-w-0 flex-1">
                              <p class="font-medium">{bot.name}</p>
                              <p class="text-muted-foreground">{bot.username ?? "No username"}</p>
                            </div>
                            <div>
                              <p class="text-muted-foreground">Token</p>
                              <p class="font-mono">{bot.tokenPrefix}••••••</p>
                            </div>
                            <div>
                              <p class="text-muted-foreground">Last used</p>
                              <p>
                                {bot.lastUsedAt
                                  ? new Date(bot.lastUsedAt).toLocaleDateString()
                                  : "Never"}
                              </p>
                            </div>
                            <div>
                              <p class="text-muted-foreground">Created</p>
                              <p>{new Date(bot.createdAt).toLocaleDateString()}</p>
                            </div>
                          </div>
                        )}
                      </For>
                    </div>
                  );
                })()}
              </div>
            </div>
          );
        }}
      />

      {/* ── Gift Tier Modal ────────────────────────── */}
      <Dialog open={giftOpen()} onOpenChange={setGiftOpen}>
        <DialogContent onClose={() => setGiftOpen(false)}>
          <DialogHeader>
            <DialogTitle>Gift Subscription</DialogTitle>
            <DialogDescription>
              Gift a tier to {giftTarget()?.username ?? giftTarget()?.email}
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-4 py-2">
            <div>
              <label
                id="gift-tier-label"
                class="mb-2 block text-xs font-medium text-muted-foreground"
              >
                Tier
              </label>
              <div class="flex gap-2" role="radiogroup" aria-labelledby="gift-tier-label">
                <For
                  each={
                    [
                      ["supporter", "Supporter"],
                      ["server_owner", "Server Owner"],
                    ] as const
                  }
                >
                  {([value, label]) => {
                    const currentTier = () => giftTarget()?.subscriptionTier ?? "free";
                    const isCurrentOrBelow = () =>
                      value === "supporter" && currentTier() === "server_owner";
                    const isSelected = () => giftTier() === value;
                    return (
                      <button
                        type="button"
                        role="radio"
                        aria-checked={isSelected()}
                        disabled={isCurrentOrBelow()}
                        class={`flex-1 rounded-lg border px-4 py-2.5 text-sm font-medium transition-all ${
                          isCurrentOrBelow()
                            ? "cursor-not-allowed border-border bg-muted/30 text-muted-foreground/40"
                            : isSelected()
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border bg-input text-muted-foreground hover:border-border/80 hover:text-foreground"
                        }`}
                        onClick={() => !isCurrentOrBelow() && setGiftTier(value)}
                      >
                        {label}
                        {value === currentTier() && (
                          <span class="ml-1.5 text-[10px] text-muted-foreground">(current)</span>
                        )}
                      </button>
                    );
                  }}
                </For>
              </div>
            </div>
            <div>
              <label
                for="gift-duration"
                class="mb-1 block text-xs font-medium text-muted-foreground"
              >
                Duration (days)
              </label>
              <Input
                id="gift-duration"
                type="number"
                min="1"
                max="365"
                value={giftDays()}
                onInput={(e) => setGiftDays(e.currentTarget.value)}
                aria-label="Duration in days"
              />
            </div>
            <div>
              <label for="gift-reason" class="mb-1 block text-xs font-medium text-muted-foreground">
                Reason (optional)
              </label>
              <textarea
                id="gift-reason"
                value={giftReason()}
                onInput={(e) => setGiftReason(e.currentTarget.value)}
                placeholder="e.g. Early access tester, friend..."
                rows={2}
                class="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setGiftOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitGift} disabled={giftSubmitting()}>
              {giftSubmitting() ? "Gifting..." : "Gift Tier"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Confirm Modal ──────────────────────────── */}
      <Dialog open={confirmOpen()} onOpenChange={setConfirmOpen}>
        <DialogContent onClose={() => setConfirmOpen(false)}>
          <DialogHeader>
            <DialogTitle>{confirmAction()?.title}</DialogTitle>
            <DialogDescription>{confirmAction()?.description}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirmOpen(false)}>
              Cancel
            </Button>
            <Button
              variant={confirmAction()?.variant ?? "default"}
              onClick={handleConfirm}
              disabled={actionInFlight() !== null}
            >
              {actionInFlight() ? "Processing..." : "Confirm"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete User Modal ────────────────────── */}
      <Dialog
        open={deleteOpen()}
        onOpenChange={(open) => {
          if (!open) setDeleteConfirmInput("");
          setDeleteOpen(open);
        }}
      >
        <DialogContent
          onClose={() => {
            setDeleteConfirmInput("");
            setDeleteOpen(false);
          }}
        >
          <DialogHeader>
            <DialogTitle>Delete User</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span class="font-semibold">{deleteTarget()?.username ?? deleteTarget()?.email}</span>
              's account and all associated data. This action cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3 py-2">
            <div>
              <label for="delete-confirm" class="mb-1.5 block text-sm font-medium text-foreground">
                Type{" "}
                <span class="font-mono text-destructive">
                  {deleteTarget()?.username ?? deleteTarget()?.email}
                </span>{" "}
                to confirm
              </label>
              <Input
                id="delete-confirm"
                value={deleteConfirmInput()}
                onInput={(e) => setDeleteConfirmInput(e.currentTarget.value)}
                placeholder={deleteTarget()?.username ?? deleteTarget()?.email ?? ""}
              />
            </div>
          </div>

          <DialogFooter>
            <Button
              variant="ghost"
              onClick={() => {
                setDeleteConfirmInput("");
                setDeleteOpen(false);
              }}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={handleDelete}
              disabled={
                deleteSubmitting() ||
                deleteConfirmInput() !== (deleteTarget()?.username ?? deleteTarget()?.email)
              }
            >
              {deleteSubmitting() ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default Users;
