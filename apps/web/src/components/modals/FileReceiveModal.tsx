import { Show, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import {
  getSession,
  activeReceiverSessionId,
  clearReceiverSession,
  leaveSession,
  saveReceivedFile,
} from "../../stores/share-session-store.js";
import { formatBytes } from "../FileMessage.js";
import { Button } from "../ui/button.js";

const FileReceiveModal = () => {
  const sessionId = () => activeReceiverSessionId();
  const session = () => {
    const id = sessionId();
    return id ? getSession(id) : undefined;
  };

  const handleClose = () => {
    const id = sessionId();
    if (id) {
      const s = session();
      // Only send leave if session is still active (not already closed/complete)
      if (s && s.status === "sharing") {
        leaveSession(id);
      }
    }
    clearReceiverSession();
  };

  const handleSave = () => {
    const id = sessionId();
    if (id) saveReceivedFile(id);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") handleClose();
  };

  const mount = () => document.addEventListener("keydown", handleKeyDown);
  const unmount = () => document.removeEventListener("keydown", handleKeyDown);
  mount();
  onCleanup(unmount);

  return (
    <Show when={session()}>
      {(s) => (
        <Portal mount={document.body}>
          <div class="fixed inset-0 z-50 flex items-center justify-center">
            <div class="fixed inset-0 bg-black/50 backdrop-blur-sm" />

            <div
              class="relative z-10 mx-4 w-full max-w-md rounded-xl border border-border bg-card p-6 shadow-lg animate-scale-in sm:mx-0"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div class="mb-4 flex items-center justify-between">
                <h2 class="text-lg font-semibold text-foreground">Receiving File</h2>
                <button
                  onClick={handleClose}
                  class="rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
                  title="Close"
                  aria-label="Close"
                >
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                  >
                    <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>

              {/* Sender info */}
              <div class="mb-4 flex items-center gap-3">
                <Show
                  when={s().senderAvatarUrl}
                  fallback={
                    <div class="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-sm font-medium text-muted-foreground">
                      {(s().senderDisplayName ?? s().senderUsername ?? "?").charAt(0).toUpperCase()}
                    </div>
                  }
                >
                  {(url) => <img src={url()} alt="" class="h-10 w-10 rounded-full object-cover" />}
                </Show>
                <div>
                  <p class="text-sm font-medium text-foreground">
                    {s().senderDisplayName ?? s().senderUsername}
                  </p>
                  <p class="text-xs text-muted-foreground">is sharing a file with you</p>
                </div>
              </div>

              {/* File info */}
              <div class="mb-4 rounded-lg bg-muted/30 px-4 py-3">
                <p class="text-sm font-medium text-foreground">{s().fileName}</p>
                <p class="text-xs text-muted-foreground">{formatBytes(s().fileSize)}</p>
              </div>

              {/* Status-specific content */}
              <Show when={s().status === "closed" && !s().downloadedFile}>
                <div class="mb-4 rounded-lg bg-muted/30 px-4 py-3 text-center">
                  <p class="text-sm text-muted-foreground">Share session ended</p>
                </div>
              </Show>

              <Show when={s().status === "sharing"}>
                {/* Progress bar */}
                <div class="mb-2">
                  <div class="mb-1 flex justify-between text-xs text-muted-foreground">
                    <span>{Math.round(s().receiverProgress * 100)}%</span>
                    <Show when={s().receiverSpeed > 0}>
                      <span>{formatBytes(s().receiverSpeed)}/s</span>
                    </Show>
                  </div>
                  <div class="h-2 w-full overflow-hidden rounded-full bg-muted">
                    <div
                      class="h-full rounded-full bg-primary transition-all duration-300"
                      style={{ width: `${Math.round(s().receiverProgress * 100)}%` }}
                    />
                  </div>
                </div>
                <p class="mb-4 text-xs text-muted-foreground">Downloading via P2P...</p>
              </Show>

              {/* Actions */}
              <div class="flex justify-end gap-3">
                <Show when={s().status === "closed" || s().status === "complete"}>
                  <Show when={s().downloadedFile}>
                    <Button onClick={handleSave}>Save to Device</Button>
                  </Show>
                  <Button variant="secondary" onClick={handleClose}>
                    Dismiss
                  </Button>
                </Show>
                <Show when={s().status === "sharing" && s().receiverProgress < 1}>
                  <Button variant="secondary" onClick={handleClose}>
                    Leave
                  </Button>
                </Show>
              </div>
            </div>
          </div>
        </Portal>
      )}
    </Show>
  );
};

export default FileReceiveModal;
