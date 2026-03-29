import { createSignal, Show, onCleanup } from "solid-js";
import type { AnyChannelId } from "@uncorded/protocol";
import { api } from "../lib/api.js";
import { readyData } from "../lib/gateway-store.js";
import { currentServer } from "../stores/app-store.js";
import { messageDensity } from "../stores/theme-store.js";
import { showToast } from "./ui/toast.js";
import { handleApiError } from "../lib/error-handling.js";
import { Button } from "./ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "./ui/dialog.js";
import type { Message } from "../stores/message-store.js";
import MessageContent from "./MessageContent.js";
import FileMessage from "./FileMessage.js";
import ReportDialog from "./ReportDialog.js";

const ONE_MINUTE_MS = 60_000;
const ONE_HOUR_MS = 3_600_000;
const ONE_DAY_MS = 86_400_000;

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < ONE_MINUTE_MS) return "just now";
  if (diff < ONE_HOUR_MS) return `${Math.floor(diff / ONE_MINUTE_MS)}m ago`;
  if (diff < ONE_DAY_MS) return `${Math.floor(diff / ONE_HOUR_MS)}h ago`;

  return date.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function getInitial(message: Message): string {
  const name = message.author.displayName || message.author.username || "?";
  return name[0]?.toUpperCase() ?? "?";
}

// ── SVG Icons ────────────────────────────────────────────────────────────────

const CopyIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <rect width="14" height="14" x="8" y="8" rx="2" ry="2" />
    <path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" />
  </svg>
);

const CheckIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M20 6 9 17l-5-5" />
  </svg>
);

const PencilIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    <path d="m15 5 4 4" />
  </svg>
);

const TrashIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M3 6h18" />
    <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
    <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
  </svg>
);

const FlagIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="14"
    height="14"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    stroke-width="2"
    stroke-linecap="round"
    stroke-linejoin="round"
  >
    <path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z" />
    <line x1="4" x2="4" y1="22" y2="15" />
  </svg>
);

// ── Component ────────────────────────────────────────────────────────────────

interface MessageBubbleProps {
  message: Message;
  isOwn: boolean;
  showHeader: boolean;
  channelId: AnyChannelId;
}

const MessageBubble = (props: MessageBubbleProps) => {
  const [editing, setEditing] = createSignal(false);
  // Initial value doesn't matter — startEdit() refreshes from props before use
  const [editContent, setEditContent] = createSignal(props.message.content ?? "");
  const [saving, setSaving] = createSignal(false);
  const [showDeleteDialog, setShowDeleteDialog] = createSignal(false);
  const [deleting, setDeleting] = createSignal(false);
  const [showReportDialog, setShowReportDialog] = createSignal(false);
  const [copied, setCopied] = createSignal(false);

  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));

  const displayName = () =>
    props.message.author.displayName || props.message.author.username || "Unknown";

  const canDelete = () => {
    if (props.isOwn) return true;
    const server = currentServer();
    if (!server) return false; // DM — own messages only
    return server.ownerId === readyData.data?.user.id;
  };

  // ── Actions ──────────────────────────────────────────────────────────────

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(props.message.content ?? "");
      showToast("Copied to clipboard", "info");
      setCopied(true);
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast("Failed to copy", "error");
    }
  }

  function startEdit() {
    setEditContent(props.message.content ?? "");
    setEditing(true);
  }

  async function saveEdit() {
    const text = editContent().trim();
    if (!text || saving()) return;
    if (text === props.message.content) {
      setEditing(false);
      return;
    }

    setSaving(true);
    try {
      await api(`/api/channels/${props.channelId}/messages/${props.message.id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: text }),
      });
      setEditing(false);
    } catch (err) {
      handleApiError(err, "Failed to edit message");
    } finally {
      setSaving(false);
    }
  }

  function cancelEdit() {
    setEditing(false);
    setEditContent(props.message.content ?? "");
  }

  function handleEditKeyDown(e: KeyboardEvent) {
    if (e.key === "Escape") {
      e.preventDefault();
      cancelEdit();
    } else if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      saveEdit();
    }
  }

  async function handleDelete() {
    if (deleting()) return;
    setDeleting(true);
    try {
      await api(`/api/channels/${props.channelId}/messages/${props.message.id}`, {
        method: "DELETE",
      });
      setShowDeleteDialog(false);
    } catch (err) {
      handleApiError(err, "Failed to delete message");
    } finally {
      setDeleting(false);
    }
  }

  // ── Toolbar ──────────────────────────────────────────────────────────────

  const toolbarBtnClass =
    "rounded p-1 text-muted-foreground hover:bg-accent hover:text-foreground transition-colors";

  const Toolbar = () => (
    <div class="ml-auto flex shrink-0 items-center gap-0.5 rounded-lg border border-border bg-card px-0.5 shadow-sm opacity-0 transition-opacity group-hover:opacity-100">
      <button
        type="button"
        class={toolbarBtnClass}
        title="Copy"
        aria-label="Copy"
        onClick={handleCopy}
      >
        <Show when={copied()} fallback={<CopyIcon />}>
          <CheckIcon />
        </Show>
      </button>
      <Show when={!props.isOwn}>
        <button
          type="button"
          class={toolbarBtnClass}
          title="Report"
          aria-label="Report"
          onClick={() => setShowReportDialog(true)}
        >
          <FlagIcon />
        </button>
      </Show>
      <Show when={props.isOwn}>
        <button
          type="button"
          class={toolbarBtnClass}
          title="Edit"
          aria-label="Edit"
          onClick={startEdit}
        >
          <PencilIcon />
        </button>
      </Show>
      <Show when={canDelete()}>
        <button
          type="button"
          class={toolbarBtnClass}
          title="Delete"
          aria-label="Delete"
          onClick={() => setShowDeleteDialog(true)}
        >
          <TrashIcon />
        </button>
      </Show>
    </div>
  );

  // ── Content (normal vs editing) ──────────────────────────────────────────

  const MessageBody = () => (
    <Show
      when={!editing()}
      fallback={
        <div class="mt-1">
          <textarea
            value={editContent()}
            onInput={(e) => setEditContent(e.currentTarget.value)}
            onKeyDown={handleEditKeyDown}
            rows={2}
            class="block w-full resize-none rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none"
          />
          <div class="mt-1 flex items-center gap-2">
            <Button size="sm" onClick={saveEdit} disabled={saving()}>
              {saving() ? "Saving..." : "Save"}
            </Button>
            <Button variant="ghost" size="sm" onClick={cancelEdit}>
              Cancel
            </Button>
            <span class="text-xs text-muted-foreground">Enter to save, Esc to cancel</span>
          </div>
        </div>
      }
    >
      <div>
        <Show when={props.message.content}>
          <MessageContent content={props.message.content!} />
          <Show when={props.message.editedAt}>
            <span class="ml-1 text-xs italic text-muted-foreground">(edited)</span>
          </Show>
        </Show>
        <Show when={props.message.fileReceipt}>
          {(receipt) => (
            <FileMessage
              receipt={{
                id: receipt().id as import("@uncorded/protocol").FileReceiptId,
                channelId: props.channelId,
                senderId: props.message.author.id as import("@uncorded/protocol").UserId,
                fileName: receipt().fileName,
                fileSize: receipt().fileSize,
                contentType: receipt().contentType,
                magnetUri: receipt().magnetUri,
                infoHash: receipt().infoHash,
              }}
              isOwn={props.isOwn}
            />
          )}
        </Show>
      </div>
    </Show>
  );

  // ── Avatar ───────────────────────────────────────────────────────────────

  const Avatar = () => (
    <Show
      when={props.message.author.avatarUrl}
      fallback={
        <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/15 text-sm font-semibold text-primary">
          {getInitial(props.message)}
        </div>
      }
    >
      {(url) => (
        <img src={url()} alt={displayName()} class="h-9 w-9 shrink-0 rounded-full object-cover" />
      )}
    </Show>
  );

  // ── Delete Dialog ────────────────────────────────────────────────────────

  const DeleteDialog = () => (
    <Dialog open={showDeleteDialog()} onOpenChange={setShowDeleteDialog}>
      <DialogContent onClose={() => setShowDeleteDialog(false)}>
        <DialogHeader>
          <DialogTitle>Delete Message</DialogTitle>
          <DialogDescription>Are you sure? This cannot be undone.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => setShowDeleteDialog(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={deleting()}>
            {deleting() ? "Deleting..." : "Delete"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );

  // ── Render ───────────────────────────────────────────────────────────────

  return (
    <>
      <Show
        when={props.showHeader}
        fallback={
          <div
            class={`group px-4 hover:bg-accent/50 ${messageDensity() === "compact" ? "py-px" : "py-0.5"} ${props.isOwn ? "border-l-2 border-primary/30" : ""}`}
          >
            <div class="flex gap-3">
              <div class="w-9 shrink-0" />
              <div class="flex min-w-0 flex-1 items-start gap-2">
                <div class="min-w-0 flex-1">
                  <MessageBody />
                </div>
                <Toolbar />
              </div>
            </div>
          </div>
        }
      >
        <div
          class={`group px-4 hover:bg-accent/50 ${messageDensity() === "compact" ? "pt-1.5 pb-0.5" : "pt-3 pb-1"} ${props.isOwn ? "border-l-2 border-primary/30" : ""}`}
        >
          <div class="flex gap-3">
            <Avatar />
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <span class="text-sm font-semibold text-foreground">{displayName()}</span>
                <Show when={props.message.author.isBot}>
                  <span class="rounded bg-primary/20 px-1 py-0.5 text-[9px] font-bold uppercase text-primary">
                    Bot
                  </span>
                </Show>
                <span class="font-mono text-xs text-muted-foreground">
                  {formatTimestamp(props.message.createdAt)}
                </span>
                <Toolbar />
              </div>
              <MessageBody />
            </div>
          </div>
        </div>
      </Show>
      <DeleteDialog />
      <ReportDialog
        open={showReportDialog()}
        onClose={() => setShowReportDialog(false)}
        messageId={props.message.id as string}
      />
    </>
  );
};

export default MessageBubble;
