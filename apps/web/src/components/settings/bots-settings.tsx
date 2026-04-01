import { createSignal, createResource, For, Show } from "solid-js";
import { MAX_AVATAR_SIZE_BYTES, ALLOWED_AVATAR_TYPES, BOT_LIMITS, type BotTier } from "@uncorded/shared";
import { api, apiUpload } from "../../lib/api.js";
import { readyData } from "../../lib/gateway-store.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface Bot {
  id: string;
  name: string;
  description: string | null;
  userId: string;
  username: string | null;
  avatarUrl: string | null;
  tokenPrefix: string;
  lastUsedAt: string | null;
  createdAt: string;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

// ── Component ────────────────────────────────────────────────────────────────

const BotsSettings = () => {
  const tier = () => (readyData.data?.user.subscriptionTier ?? "free") as BotTier;
  const limit = () => BOT_LIMITS[tier()] ?? 1;

  // Bot list resource
  const [botList, { refetch }] = createResource(async () => {
    const res = await api<{ bots: Bot[] }>("/api/bots");
    return res.bots;
  });

  // Create dialog state
  const [showCreate, setShowCreate] = createSignal(false);
  const [createName, setCreateName] = createSignal("");
  const [createDesc, setCreateDesc] = createSignal("");
  const [creating, setCreating] = createSignal(false);

  // Token reveal state (shown once after create/regenerate)
  const [revealedToken, setRevealedToken] = createSignal<string | null>(null);

  // Delete dialog state
  const [deleteTarget, setDeleteTarget] = createSignal<Bot | null>(null);
  const [deleting, setDeleting] = createSignal(false);

  // Regenerate dialog state
  const [regenTarget, setRegenTarget] = createSignal<Bot | null>(null);
  const [regenerating, setRegenerating] = createSignal(false);

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleCreate() {
    const name = createName().trim();
    if (!name || name.length < 2 || creating()) return;

    setCreating(true);
    try {
      const res = await api<{ bot: Bot; token: string }>("/api/bots", {
        method: "POST",
        body: JSON.stringify({
          name,
          description: createDesc().trim() || undefined,
        }),
      });
      setShowCreate(false);
      setCreateName("");
      setCreateDesc("");
      setRevealedToken(res.token);
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to create bot");
    } finally {
      setCreating(false);
    }
  }

  async function handleDelete() {
    const target = deleteTarget();
    if (!target || deleting()) return;

    setDeleting(true);
    try {
      await api(`/api/bots/${target.id}`, { method: "DELETE" });
      setDeleteTarget(null);
      showToast("Bot deleted", "info");
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to delete bot");
    } finally {
      setDeleting(false);
    }
  }

  async function handleRegenerate() {
    const target = regenTarget();
    if (!target || regenerating()) return;

    setRegenerating(true);
    try {
      const res = await api<{ token: string; tokenPrefix: string }>(
        `/api/bots/${target.id}/regenerate-token`,
        { method: "POST" },
      );
      setRegenTarget(null);
      setRevealedToken(res.token);
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to regenerate token");
    } finally {
      setRegenerating(false);
    }
  }

  async function handleAvatarUpload(bot: Bot, file: File) {
    if (!ALLOWED_AVATAR_TYPES.includes(file.type as (typeof ALLOWED_AVATAR_TYPES)[number])) {
      showToast("Invalid file type. Use PNG, JPEG, GIF, or WebP.", "error");
      return;
    }
    if (file.size > MAX_AVATAR_SIZE_BYTES) {
      showToast("File too large. Maximum size is 4 MB.", "error");
      return;
    }
    try {
      const formData = new FormData();
      formData.append("avatar", file);
      await apiUpload<{ avatarUrl: string }>(`/api/bots/${bot.id}/avatar`, formData);
      showToast("Bot avatar updated", "info");
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to upload avatar");
    }
  }

  async function copyToken() {
    const token = revealedToken();
    if (!token) return;
    try {
      await navigator.clipboard.writeText(token);
      showToast("Token copied to clipboard", "info");
    } catch {
      showToast("Failed to copy", "error");
    }
  }

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Bots</h2>
        <p class="text-sm text-muted-foreground">
          Create and manage bot accounts. Bots can connect to UnCorded via API.
        </p>
      </div>

      {/* Create button */}
      <Button
        onClick={() => setShowCreate(true)}
        disabled={(botList()?.length ?? 0) >= limit()}
      >
        + Create Bot
      </Button>

      {/* Bot list */}
      <Show when={!botList.loading} fallback={<p class="text-sm text-muted-foreground">Loading...</p>}>
        <Show when={!botList.error} fallback={
          <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
            <p class="text-sm text-destructive">Failed to load bots.</p>
            <Button variant="outline" size="sm" class="mt-2" onClick={() => refetch()}>
              Retry
            </Button>
          </div>
        }>
        <Show
          when={(botList()?.length ?? 0) > 0}
          fallback={
            <div class="rounded-lg border border-border p-6 text-center">
              <p class="text-sm text-muted-foreground">
                No bots yet. Create one to get started with the UnCorded API.
              </p>
            </div>
          }
        >
          <div class="space-y-3">
            <For each={botList()}>
              {(bot) => (
                <div class="rounded-lg border border-border p-4">
                  <div class="flex items-start justify-between gap-4">
                    {/* Bot avatar */}
                    <button
                      type="button"
                      class="group relative flex h-12 w-12 shrink-0 cursor-pointer items-center justify-center overflow-hidden rounded-full border-2 border-dashed border-border transition-colors hover:border-primary"
                      onClick={() => {
                        const input = document.createElement("input");
                        input.type = "file";
                        input.accept = "image/png,image/jpeg,image/gif,image/webp";
                        input.addEventListener("change", () => {
                          const file = input.files?.[0];
                          if (file) handleAvatarUpload(bot, file);
                        });
                        input.click();
                      }}
                      title="Change bot avatar"
                    >
                      <Show
                        when={bot.avatarUrl}
                        fallback={
                          <div class="flex h-full w-full items-center justify-center bg-primary/15 text-lg font-bold text-primary">
                            {bot.name[0]?.toUpperCase() ?? "?"}
                          </div>
                        }
                      >
                        {(url) => <img src={url()} alt={bot.name} class="h-full w-full object-cover" />}
                      </Show>
                      <div class="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100">
                        <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                          <path stroke-linecap="round" stroke-linejoin="round" d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                          <path stroke-linecap="round" stroke-linejoin="round" d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                        </svg>
                      </div>
                    </button>
                    <div class="min-w-0 flex-1">
                      <div class="flex items-center gap-2">
                        <span class="font-semibold text-foreground">{bot.name}</span>
                        <span class="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-bold uppercase text-primary">
                          Bot
                        </span>
                      </div>
                      <p class="text-sm text-muted-foreground">@{bot.username}</p>
                      <Show when={bot.description}>
                        <p class="mt-1 text-sm text-muted-foreground">{bot.description}</p>
                      </Show>
                      <div class="mt-2 flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                        <span>Token: {bot.tokenPrefix}...</span>
                        <span>Last used: {formatRelativeTime(bot.lastUsedAt)}</span>
                      </div>
                    </div>
                  </div>
                  <div class="mt-3 flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setRegenTarget(bot)}
                    >
                      Regenerate Token
                    </Button>
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setDeleteTarget(bot)}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              )}
            </For>
          </div>
        </Show>
        </Show>
      </Show>

      {/* Limit indicator */}
      <p class="text-xs text-muted-foreground">
        {botList()?.length ?? 0}/{limit()} bots ({tier()} tier: max {limit()})
      </p>

      {/* ── Create Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={showCreate()} onOpenChange={setShowCreate}>
        <DialogContent onClose={() => setShowCreate(false)}>
          <DialogHeader>
            <DialogTitle>Create Bot</DialogTitle>
            <DialogDescription>
              Give your bot a name. You'll receive an API token after creation.
            </DialogDescription>
          </DialogHeader>
          <div class="space-y-4 py-2">
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                value={createName()}
                onInput={(e) => setCreateName(e.currentTarget.value)}
                placeholder="My Bot"
                maxLength={32}
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <p class="mt-1 text-xs text-muted-foreground">2-32 characters</p>
            </div>
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">
                Description <span class="text-muted-foreground">(optional)</span>
              </label>
              <textarea
                value={createDesc()}
                onInput={(e) => setCreateDesc(e.currentTarget.value)}
                placeholder="What does this bot do?"
                maxLength={200}
                rows={2}
                class="w-full resize-none rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setShowCreate(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleCreate}
              disabled={creating() || createName().trim().length < 2}
            >
              {creating() ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Token Reveal Dialog ───────────────────────────────────────────── */}
      <Dialog open={!!revealedToken()} onOpenChange={(open) => { if (!open) setRevealedToken(null); }}>
        <DialogContent onClose={() => setRevealedToken(null)}>
          <DialogHeader>
            <DialogTitle>Bot Token</DialogTitle>
            <DialogDescription>
              This token will only be shown once. Copy it now and store it securely.
            </DialogDescription>
          </DialogHeader>
          <div class="py-2">
            <div class="flex items-center gap-2 rounded-lg bg-input p-3">
              <code class="min-w-0 flex-1 break-all text-sm text-foreground">
                {revealedToken()}
              </code>
              <Button size="sm" variant="outline" onClick={copyToken}>
                Copy
              </Button>
            </div>
            <p class="mt-2 text-xs font-medium text-destructive">
              Warning: You won't be able to see this token again.
            </p>
          </div>
          <DialogFooter>
            <Button onClick={() => setRevealedToken(null)}>Done</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Delete Dialog ─────────────────────────────────────────────────── */}
      <Dialog open={!!deleteTarget()} onOpenChange={(open) => { if (!open) setDeleteTarget(null); }}>
        <DialogContent onClose={() => setDeleteTarget(null)}>
          <DialogHeader>
            <DialogTitle>Delete Bot</DialogTitle>
            <DialogDescription>
              This will permanently delete <strong>{deleteTarget()?.name}</strong> and revoke its token. This cannot be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={handleDelete} disabled={deleting()}>
              {deleting() ? "Deleting..." : "Delete"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Regenerate Dialog ─────────────────────────────────────────────── */}
      <Dialog open={!!regenTarget()} onOpenChange={(open) => { if (!open) setRegenTarget(null); }}>
        <DialogContent onClose={() => setRegenTarget(null)}>
          <DialogHeader>
            <DialogTitle>Regenerate Token</DialogTitle>
            <DialogDescription>
              This will invalidate the current token for <strong>{regenTarget()?.name}</strong> and disconnect it from any active sessions.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setRegenTarget(null)}>
              Cancel
            </Button>
            <Button onClick={handleRegenerate} disabled={regenerating()}>
              {regenerating() ? "Regenerating..." : "Regenerate"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default BotsSettings;
