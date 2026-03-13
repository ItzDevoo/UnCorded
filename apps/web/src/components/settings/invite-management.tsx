import { createSignal, createEffect, For, Show } from "solid-js";
import type { ServerId } from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";
import InviteModal from "../modals/InviteModal.js";

interface InviteManagementProps {
  serverId: ServerId;
}

interface InviteEntry {
  code: string;
  serverId: string;
  creatorId: string | null;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
  createdAt: string;
}

function formatExpiry(expiresAt: string | null): string {
  if (!expiresAt) return "Never";
  const date = new Date(expiresAt);
  if (date <= new Date()) return "Expired";
  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

const InviteManagement = (props: InviteManagementProps) => {
  const [invites, setInvites] = createSignal<InviteEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [revokingCode, setRevokingCode] = createSignal<string | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);

  async function fetchInvites(serverId: ServerId) {
    setLoading(true);
    try {
      const result = await api<InviteEntry[]>(`/api/servers/${serverId}/invites`);
      if (serverId !== props.serverId) return;
      setInvites(result);
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.body.message : "Failed to load invites";
      showToast(message, "error");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    const id = props.serverId;
    setRevokingCode(null);
    setShowCreate(false);
    void fetchInvites(id);
  });

  async function revokeInvite(code: string) {
    const serverId = props.serverId;
    try {
      await api(`/api/servers/${serverId}/invites/${code}`, { method: "DELETE" });
      if (serverId !== props.serverId) return;
      setInvites((prev) => prev.filter((inv) => inv.code !== code));
      showToast("Invite revoked", "info");
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.body.message : "Failed to revoke invite";
      showToast(message, "error");
    } finally {
      setRevokingCode(null);
    }
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Active Invites
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          Create Invite
        </Button>
      </div>

      <Show
        when={!loading()}
        fallback={<p class="py-4 text-sm text-muted-foreground">Loading...</p>}
      >
        <Show
          when={invites().length > 0}
          fallback={<p class="py-4 text-sm text-muted-foreground">No active invites.</p>}
        >
          <div class="space-y-1">
            <For each={invites()}>
              {(invite) => (
                <div class="flex items-center gap-4 rounded-lg border border-border bg-card px-4 py-3">
                  {/* Code */}
                  <div class="min-w-0 flex-1">
                    <code class="text-sm font-medium text-foreground">{invite.code}</code>
                    <div class="mt-0.5 flex items-center gap-3 text-xs text-muted-foreground">
                      <span>
                        Uses: {invite.uses}
                        {invite.maxUses != null ? `/${invite.maxUses}` : ""}
                      </span>
                      <span>Expires: {formatExpiry(invite.expiresAt)}</span>
                    </div>
                  </div>

                  {/* Copy */}
                  <button
                    type="button"
                    class="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                    onClick={async () => {
                      try {
                        await navigator.clipboard.writeText(invite.code);
                        showToast("Code copied", "info");
                      } catch {
                        showToast("Copy failed", "error");
                      }
                    }}
                    title="Copy invite code"
                    aria-label="Copy invite code"
                  >
                    Copy
                  </button>

                  {/* Revoke */}
                  <Show
                    when={revokingCode() === invite.code}
                    fallback={
                      <button
                        type="button"
                        class="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive-foreground"
                        onClick={() => setRevokingCode(invite.code)}
                        title="Revoke invite"
                        aria-label="Revoke invite"
                      >
                        Revoke
                      </button>
                    }
                  >
                    <div class="flex items-center gap-1">
                      <button
                        type="button"
                        class="rounded px-2 py-0.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/20"
                        onClick={() => revokeInvite(invite.code)}
                      >
                        Confirm
                      </button>
                      <button
                        type="button"
                        class="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                        onClick={() => setRevokingCode(null)}
                      >
                        Cancel
                      </button>
                    </div>
                  </Show>
                </div>
              )}
            </For>
          </div>
        </Show>
      </Show>

      <Show when={showCreate()}>
        <InviteModal
          serverId={props.serverId}
          onClose={() => {
            setShowCreate(false);
            void fetchInvites(props.serverId);
          }}
        />
      </Show>
    </div>
  );
};

export default InviteManagement;
