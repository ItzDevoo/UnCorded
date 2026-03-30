import { createSignal, For, Show } from "solid-js";
import type { ServerId, ChannelId } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { currentChannels } from "../../stores/app-store.js";
import { setChannelsForServer, type ReadyChannel } from "../../lib/gateway-store.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../ui/button.js";
import CreateChannelModal from "../modals/CreateChannelModal.js";

interface ChannelManagementProps {
  serverId: ServerId;
}

const ChannelManagement = (props: ChannelManagementProps) => {
  const [editingId, setEditingId] = createSignal<ChannelId | null>(null);
  const [editName, setEditName] = createSignal("");
  const [deletingId, setDeletingId] = createSignal<ChannelId | null>(null);
  const [showCreate, setShowCreate] = createSignal(false);

  function startEdit(channel: ReadyChannel) {
    setEditingId(channel.id);
    setEditName(channel.name);
  }

  async function saveEdit(channelId: ChannelId) {
    const trimmed = editName().trim();
    if (!trimmed) {
      showToast("Channel name is required", "error");
      return;
    }

    try {
      await api(`/api/channels/${channelId}`, {
        method: "PATCH",
        body: JSON.stringify({ name: trimmed }),
      });

      // Refresh channels from server
      const channels = await api<ReadyChannel[]>(`/api/servers/${props.serverId}/channels`);
      setChannelsForServer(props.serverId, channels);
      showToast("Channel updated", "info");
    } catch (err) {
      handleApiError(err, "Failed to update");
    } finally {
      setEditingId(null);
    }
  }

  async function toggleFileSharing(channelId: ChannelId, current: boolean) {
    try {
      await api(`/api/channels/${channelId}`, {
        method: "PATCH",
        body: JSON.stringify({ fileSharingEnabled: !current }),
      });

      const channels = await api<ReadyChannel[]>(`/api/servers/${props.serverId}/channels`);
      setChannelsForServer(props.serverId, channels);
    } catch (err) {
      handleApiError(err, "Failed to update");
    }
  }

  async function deleteChannel(channelId: ChannelId) {
    try {
      await api(`/api/channels/${channelId}`, { method: "DELETE" });

      const channels = await api<ReadyChannel[]>(`/api/servers/${props.serverId}/channels`);
      setChannelsForServer(props.serverId, channels);
      showToast("Channel deleted", "info");
    } catch (err) {
      handleApiError(err, "Failed to delete");
    } finally {
      setDeletingId(null);
    }
  }

  return (
    <div class="space-y-6">
      <div class="flex items-center justify-between">
        <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Channels
        </h3>
        <Button variant="outline" size="sm" onClick={() => setShowCreate(true)}>
          Create Channel
        </Button>
      </div>

      <div class="space-y-1">
        <For
          each={currentChannels()}
          fallback={<p class="py-4 text-sm text-muted-foreground">No channels yet.</p>}
        >
          {(channel) => (
            <div class="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
              <span class="text-muted-foreground">#</span>

              {/* Name (editable) */}
              <Show
                when={editingId() === channel.id}
                fallback={
                  <button
                    type="button"
                    class="min-w-0 flex-1 truncate text-left text-sm text-foreground hover:text-primary"
                    onClick={() => startEdit(channel)}
                    title="Click to edit name"
                  >
                    {channel.name}
                  </button>
                }
              >
                <input
                  type="text"
                  value={editName()}
                  onInput={(e) => setEditName(e.currentTarget.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") saveEdit(channel.id);
                    if (e.key === "Escape") setEditingId(null);
                  }}
                  class="min-w-0 flex-1 rounded border border-border bg-input px-2 py-0.5 text-sm text-foreground outline-none focus:border-ring"
                  autofocus
                />
              </Show>

              {/* Type badge */}
              <span class="rounded bg-muted px-1.5 py-0.5 text-[10px] font-medium uppercase text-muted-foreground">
                {channel.type}
              </span>

              {/* File sharing toggle */}
              <button
                type="button"
                class={`rounded px-2 py-0.5 text-xs font-medium transition-colors ${
                  channel.fileSharingEnabled
                    ? "bg-success/20 text-success hover:bg-success/30"
                    : "bg-muted text-muted-foreground hover:bg-muted/80"
                }`}
                onClick={() => toggleFileSharing(channel.id, channel.fileSharingEnabled)}
                title={channel.fileSharingEnabled ? "Disable file sharing" : "Enable file sharing"}
                aria-label={
                  channel.fileSharingEnabled ? "Disable file sharing" : "Enable file sharing"
                }
              >
                {channel.fileSharingEnabled ? "Files On" : "Files Off"}
              </button>

              {/* Delete */}
              <Show
                when={deletingId() === channel.id}
                fallback={
                  <button
                    type="button"
                    class="rounded p-1 text-muted-foreground transition-colors hover:text-destructive"
                    onClick={() => setDeletingId(channel.id)}
                    title="Delete channel"
                    aria-label="Delete channel"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                      aria-hidden="true"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                      />
                    </svg>
                  </button>
                }
              >
                <div class="flex items-center gap-1">
                  <button
                    type="button"
                    class="rounded px-2 py-0.5 text-xs font-medium text-destructive-foreground transition-colors hover:bg-destructive/20"
                    onClick={() => deleteChannel(channel.id)}
                  >
                    Confirm
                  </button>
                  <button
                    type="button"
                    class="rounded px-2 py-0.5 text-xs text-muted-foreground transition-colors hover:bg-accent"
                    onClick={() => setDeletingId(null)}
                  >
                    Cancel
                  </button>
                </div>
              </Show>
            </div>
          )}
        </For>
      </div>

      <Show when={showCreate()}>
        <CreateChannelModal serverId={props.serverId} onClose={() => setShowCreate(false)} />
      </Show>
    </div>
  );
};

export default ChannelManagement;
