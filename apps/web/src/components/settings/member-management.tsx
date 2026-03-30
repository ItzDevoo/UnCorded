import { createSignal, createEffect, For, Show } from "solid-js";
import type { ServerId, UserId } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { readyData, updateServer } from "../../lib/gateway-store.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { useAsyncAction } from "../../lib/use-async-action.js";
import { Button } from "../ui/button.js";
import StatusDot, { type UserStatus } from "../StatusDot.js";

interface MemberManagementProps {
  serverId: ServerId;
  ownerId: UserId;
}

interface MemberEntry {
  userId: UserId;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  nickname: string | null;
}

const MemberManagement = (props: MemberManagementProps) => {
  const [members, setMembers] = createSignal<MemberEntry[]>([]);
  const [loading, setLoading] = createSignal(true);
  const [search, setSearch] = createSignal("");
  const [kickingId, setKickingId] = createSignal<UserId | null>(null);

  // Transfer ownership
  const [transferTarget, setTransferTarget] = createSignal<MemberEntry | null>(null);
  const [transferInput, setTransferInput] = createSignal("");
  const transfer = useAsyncAction();

  const currentUserId = () => readyData.data?.user.id;

  async function fetchMembers(serverId: ServerId) {
    setLoading(true);
    try {
      const result = await api<{ members: MemberEntry[]; hasMore: boolean }>(
        `/api/servers/${serverId}/members?limit=100`,
      );
      if (serverId !== props.serverId) return;
      setMembers(result.members);
    } catch (err) {
      handleApiError(err, "Failed to load members");
    } finally {
      setLoading(false);
    }
  }

  createEffect(() => {
    const id = props.serverId;
    setKickingId(null);
    setTransferTarget(null);
    setTransferInput("");
    void fetchMembers(id);
  });

  const filteredMembers = () => {
    const q = search().toLowerCase();
    if (!q) return members();
    return members().filter(
      (m) => m.username?.toLowerCase().includes(q) || m.displayName?.toLowerCase().includes(q),
    );
  };

  async function kickMember(userId: UserId) {
    const serverId = props.serverId;
    try {
      await api(`/api/servers/${serverId}/members/${userId}`, { method: "DELETE" });
      if (serverId !== props.serverId) return;
      setMembers((prev) => prev.filter((m) => m.userId !== userId));
      showToast("Member kicked", "info");
    } catch (err) {
      handleApiError(err, "Failed to kick member");
    } finally {
      setKickingId(null);
    }
  }

  async function handleTransfer() {
    const target = transferTarget();
    if (!target) return;

    const serverId = props.serverId;
    await transfer.run(async () => {
      await api(`/api/servers/${serverId}/owner`, {
        method: "PATCH",
        body: JSON.stringify({ newOwnerId: target.userId }),
      });

      if (serverId !== props.serverId) return;
      updateServer(serverId, { ownerId: target.userId });
      showToast("Ownership transferred", "info");
      setTransferTarget(null);
      setTransferInput("");
    }, "Failed to transfer ownership");
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Members
        </h3>
        <span class="text-xs text-muted-foreground">{members().length} members</span>
      </div>

      {/* Search */}
      <input
        type="text"
        value={search()}
        onInput={(e) => setSearch(e.currentTarget.value)}
        placeholder="Search members..."
        class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
      />

      {/* Member list */}
      <Show
        when={!loading()}
        fallback={<p class="py-4 text-sm text-muted-foreground">Loading...</p>}
      >
        <div class="space-y-1">
          <For
            each={filteredMembers()}
            fallback={<p class="py-4 text-sm text-muted-foreground">No members found.</p>}
          >
            {(member) => {
              const displayName = () => member.displayName ?? member.username ?? "Unknown";
              const initial = () => displayName()[0]?.toUpperCase() ?? "?";
              const isSelf = () => member.userId === currentUserId();
              const isOwner = () => member.userId === props.ownerId;

              return (
                <div class="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  {/* Avatar */}
                  <div class="relative shrink-0">
                    <Show
                      when={member.avatarUrl}
                      fallback={
                        <div class="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-xs font-semibold text-primary">
                          {initial()}
                        </div>
                      }
                    >
                      {(url) => (
                        <img
                          src={url()}
                          alt={displayName()}
                          class="h-8 w-8 rounded-full object-cover"
                        />
                      )}
                    </Show>
                    <StatusDot status={member.status as UserStatus} />
                  </div>

                  {/* Name */}
                  <div class="min-w-0 flex-1">
                    <div class="flex items-center gap-1.5">
                      <span class="truncate text-sm font-medium text-foreground">
                        {displayName()}
                      </span>
                      <Show when={isOwner()}>
                        <span class="text-xs text-warning" title="Server Owner">
                          &#9733;
                        </span>
                      </Show>
                    </div>
                    <Show when={member.username}>
                      <span class="text-xs text-muted-foreground">@{member.username}</span>
                    </Show>
                  </div>

                  {/* Actions */}
                  <Show when={!isSelf() && !isOwner()}>
                    <Show
                      when={kickingId() === member.userId}
                      fallback={
                        <div class="flex items-center gap-1">
                          <button
                            type="button"
                            class="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                            onClick={() => setTransferTarget(member)}
                            title="Transfer ownership"
                            aria-label="Transfer ownership"
                          >
                            Transfer
                          </button>
                          <button
                            type="button"
                            class="rounded px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-destructive/20 hover:text-destructive-foreground"
                            onClick={() => setKickingId(member.userId)}
                            title="Kick member"
                            aria-label="Kick member"
                          >
                            Kick
                          </button>
                        </div>
                      }
                    >
                      <div class="flex items-center gap-1">
                        <button
                          type="button"
                          class="rounded px-2 py-0.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/20"
                          onClick={() => kickMember(member.userId)}
                        >
                          Confirm Kick
                        </button>
                        <button
                          type="button"
                          class="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                          onClick={() => setKickingId(null)}
                        >
                          Cancel
                        </button>
                      </div>
                    </Show>
                  </Show>
                </div>
              );
            }}
          </For>
        </div>
      </Show>

      {/* Transfer Ownership Dialog */}
      <Show when={transferTarget()}>
        {(target) => {
          const targetName = () => target().displayName ?? target().username ?? "Unknown";

          return (
            <div class="rounded-lg border border-warning/30 bg-warning/5 p-6">
              <h4 class="mb-2 text-sm font-semibold text-foreground">Transfer Ownership</h4>
              <p class="mb-4 text-sm text-muted-foreground">
                Transfer server ownership to <strong>{targetName()}</strong>. This action cannot be
                undone. You will lose all owner privileges.
              </p>
              <label class="mb-2 block text-sm text-foreground" for="transfer-confirm">
                Type <strong>{targetName()}</strong> to confirm:
              </label>
              <input
                id="transfer-confirm"
                type="text"
                value={transferInput()}
                onInput={(e) => setTransferInput(e.currentTarget.value)}
                class="mb-3 block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
              />
              <div class="flex gap-2">
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={handleTransfer}
                  disabled={transferInput() !== targetName() || transfer.loading()}
                >
                  {transfer.loading() ? "Transferring..." : "Confirm Transfer"}
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setTransferTarget(null);
                    setTransferInput("");
                  }}
                >
                  Cancel
                </Button>
              </div>
            </div>
          );
        }}
      </Show>
    </div>
  );
};

export default MemberManagement;
