import { createSignal, createEffect, Show } from "solid-js";
import type { ServerId } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { updateServer } from "../../lib/gateway-store.js";
import { showToast } from "../ui/toast.js";
import { useAsyncAction } from "../../lib/use-async-action.js";
import { Button } from "../ui/button.js";
import { useNavigate } from "@solidjs/router";

interface OverviewProps {
  serverId: ServerId;
  serverName: string;
  serverIconUrl: string | null;
}

function validateName(val: string): string {
  if (val.trim().length < 1) return "Server name is required";
  if (val.trim().length > 100) return "Server name must be at most 100 characters";
  return "";
}

const ServerOverview = (props: OverviewProps) => {
  const navigate = useNavigate();

  const [name, setName] = createSignal(props.serverName);
  const [iconUrl, setIconUrl] = createSignal(props.serverIconUrl ?? "");
  const save = useAsyncAction();
  const [nameError, setNameError] = createSignal("");

  // Delete confirmation
  const [showDeleteConfirm, setShowDeleteConfirm] = createSignal(false);
  const [deleteInput, setDeleteInput] = createSignal("");
  const del = useAsyncAction();

  // Reset state when server changes
  createEffect(() => {
    void props.serverId;
    setName(props.serverName);
    setIconUrl(props.serverIconUrl ?? "");
    setNameError("");
    setDeleteInput("");
    setShowDeleteConfirm(false);
    save.reset();
    del.reset();
  });

  function handleNameInput(val: string) {
    setName(val);
    setNameError(validateName(val));
  }

  async function handleSave() {
    if (del.loading()) return;
    const validationErr = validateName(name());
    if (validationErr) {
      setNameError(validationErr);
      return;
    }

    const serverId = props.serverId;
    await save.run(async () => {
      const body: Record<string, string | null> = {};
      if (name() !== props.serverName) body.name = name();

      const trimmedIcon = iconUrl().trim();
      const currentIcon = props.serverIconUrl ?? "";
      if (trimmedIcon !== currentIcon) body.iconUrl = trimmedIcon || null;

      if (Object.keys(body).length === 0) {
        showToast("No changes to save", "info");
        return;
      }

      const result = await api<{ name: string; iconUrl: string | null }>(
        `/api/servers/${serverId}`,
        { method: "PATCH", body: JSON.stringify(body) },
      );

      if (serverId !== props.serverId) return;
      updateServer(serverId, { name: result.name, iconUrl: result.iconUrl });
      showToast("Server updated", "info");
    }, "Failed to save");
  }

  async function handleDelete() {
    if (save.loading()) return;
    const serverId = props.serverId;
    await del.run(async () => {
      await api(`/api/servers/${serverId}`, { method: "DELETE" });
      showToast("Server deleted", "info");
      navigate("/home");
    }, "Failed to delete server");
  }

  return (
    <div class="space-y-8">
      {/* Server Name */}
      <div>
        <label class="mb-1.5 block text-sm font-medium text-foreground" for="server-name">
          Server Name
        </label>
        <input
          id="server-name"
          type="text"
          value={name()}
          onInput={(e) => handleNameInput(e.currentTarget.value)}
          maxLength={100}
          class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <Show when={nameError()}>
          <p class="mt-1 text-xs text-destructive-foreground">{nameError()}</p>
        </Show>
      </div>

      {/* Icon URL */}
      <div>
        <label class="mb-1.5 block text-sm font-medium text-foreground" for="server-icon-url">
          Icon URL
        </label>
        <input
          id="server-icon-url"
          type="url"
          value={iconUrl()}
          onInput={(e) => setIconUrl(e.currentTarget.value)}
          placeholder="https://example.com/icon.png"
          class="block w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-ring"
        />
        <p class="mt-1 text-xs text-muted-foreground">Optional. Must be a valid URL.</p>
      </div>

      {/* Server ID */}
      <div>
        <span class="mb-1.5 block text-sm font-medium text-foreground">Server ID</span>
        <div class="flex items-center gap-2">
          <code class="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
            {props.serverId}
          </code>
          <button
            type="button"
            class="text-xs text-primary hover:underline"
            onClick={async () => {
              try {
                await navigator.clipboard.writeText(props.serverId);
                showToast("Copied to clipboard", "info");
              } catch {
                showToast("Copy failed", "error");
              }
            }}
          >
            Copy
          </button>
        </div>
      </div>

      {/* Save */}
      <Button onClick={handleSave} disabled={save.loading() || del.loading() || !!nameError()}>
        {save.loading() ? "Saving..." : "Save Changes"}
      </Button>

      {/* Danger Zone */}
      <div class="rounded-lg border border-destructive/30 p-6">
        <h3 class="mb-2 text-sm font-semibold text-destructive-foreground">Danger Zone</h3>
        <p class="mb-4 text-sm text-muted-foreground">
          Deleting a server is permanent and cannot be undone. All channels, messages, and members
          will be removed.
        </p>
        <Show
          when={showDeleteConfirm()}
          fallback={
            <Button variant="destructive" onClick={() => setShowDeleteConfirm(true)}>
              Delete Server
            </Button>
          }
        >
          <div class="space-y-3">
            <label class="block text-sm text-foreground" for="delete-confirm">
              Type <strong>{props.serverName}</strong> to confirm:
            </label>
            <input
              id="delete-confirm"
              type="text"
              value={deleteInput()}
              onInput={(e) => setDeleteInput(e.currentTarget.value)}
              class="block w-full rounded-lg border border-destructive/50 bg-input px-3 py-2 text-sm text-foreground outline-none transition-colors focus:border-destructive"
              aria-invalid={deleteInput() !== props.serverName}
            />
            <div class="flex gap-2">
              <Button
                variant="destructive"
                onClick={handleDelete}
                disabled={deleteInput() !== props.serverName || del.loading() || save.loading()}
              >
                {del.loading() ? "Deleting..." : "Confirm Delete"}
              </Button>
              <Button
                variant="outline"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                }}
              >
                Cancel
              </Button>
            </div>
          </div>
        </Show>
      </div>
    </div>
  );
};

export default ServerOverview;
