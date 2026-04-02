import { createSignal, createMemo, For, Show, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { MAX_FILE_SIZE_BYTES } from "@uncorded/shared";
import { readyData } from "../../lib/gateway-store.js";
import {
  createSession,
  closeSession,
  activeSenderSessionId,
  getSession,
} from "../../stores/share-session-store.js";
import { formatBytes } from "../FileMessage.js";
import { Button } from "../ui/button.js";
import { Input } from "../ui/input.js";
import ShareVisualization from "../ShareVisualization.js";

// Use the canonical protocol limit (1 GiB) to match server-side validation
const MAX_SINGLE_FILE_SIZE = MAX_FILE_SIZE_BYTES;

interface Props {
  onClose: () => void;
}

type Step = "file" | "friends" | "sharing";

const ShareFileModal = (props: Props) => {
  const [step, setStep] = createSignal<Step>("file");
  const [selectedFile, setSelectedFile] = createSignal<File | null>(null);
  const [selectedFriends, setSelectedFriends] = createSignal<Set<string>>(new Set());
  const [searchQuery, setSearchQuery] = createSignal("");
  const [error, setError] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [isDragging, setIsDragging] = createSignal(false);
  const [showCloseConfirm, setShowCloseConfirm] = createSignal(false);

  // ── File Selection ──────────────────────────────────────────────────────

  const validateFile = (file: File): string | null => {
    if (file.size > MAX_SINGLE_FILE_SIZE) {
      return `File too large. Maximum size is ${formatBytes(MAX_SINGLE_FILE_SIZE)}.`;
    }
    if (file.size === 0) {
      return "Cannot share an empty file.";
    }
    return null;
  };

  const handleFileSelect = (file: File) => {
    const err = validateFile(file);
    if (err) {
      setError(err);
      return;
    }
    setError("");
    setSelectedFile(file);
  };

  const handleFileDrop = (e: DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer?.files[0];
    if (file) handleFileSelect(file);
  };

  const handleFileInput = (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    if (file) handleFileSelect(file);
  };

  // ── Friend Selection ──────────────────────────────────────────────────

  const allAcceptedFriends = createMemo(() => {
    const all = readyData.data?.friends ?? [];
    return all.filter((f) => f.friendshipStatus === "accepted");
  });

  const friends = createMemo(() => {
    // P2P requires both peers online — only show online/idle friends
    return allAcceptedFriends().filter((f) => f.status === "online" || f.status === "idle");
  });

  const filteredFriends = createMemo(() => {
    const q = searchQuery().toLowerCase().trim();
    if (!q) return friends();
    return friends().filter(
      (f) => f.username?.toLowerCase().includes(q) || f.displayName?.toLowerCase().includes(q),
    );
  });

  const toggleFriend = (userId: string) => {
    setSelectedFriends((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
      } else {
        next.add(userId);
      }
      return next;
    });
  };

  const selectAll = () => {
    const ids = new Set<string>();
    for (const f of friends()) ids.add(f.userId);
    setSelectedFriends(ids);
  };

  const deselectAll = () => {
    setSelectedFriends(new Set<string>());
  };

  // ── Start Sharing ───────────────────────────────────────────────────────

  const handleStartSharing = async () => {
    const file = selectedFile();
    if (!file || selectedFriends().size === 0) return;

    setLoading(true);
    setError("");

    try {
      await createSession(file, [...selectedFriends()]);
      setStep("sharing");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to start sharing");
    } finally {
      setLoading(false);
    }
  };

  // ── Close Handling ────────────────────────────────────────────────────

  const handleClose = () => {
    if (step() === "sharing" && activeSenderSessionId()) {
      setShowCloseConfirm(true);
      return;
    }
    props.onClose();
  };

  const confirmClose = () => {
    const sessionId = activeSenderSessionId();
    if (sessionId) {
      closeSession(sessionId);
    }
    setShowCloseConfirm(false);
    props.onClose();
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") handleClose();
  };

  document.addEventListener("keydown", handleKeyDown);
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  // ── File input ref ────────────────────────────────────────────────────

  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref assigned via JSX
  let fileInputRef!: HTMLInputElement;

  return (
    <Portal mount={document.body}>
      <div class="fixed inset-0 z-50 flex items-center justify-center">
        {/* Backdrop */}
        <div
          class="fixed inset-0 bg-black/60 backdrop-blur-sm"
          onClick={step() !== "sharing" ? handleClose : undefined}
        />

        {/* Modal */}
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Send File"
          class="relative z-10 mx-4 flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-xl border border-border bg-card shadow-lg animate-scale-in sm:mx-0"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div class="flex items-center justify-between border-b border-border px-6 py-4">
            <h2 class="text-xl font-semibold text-foreground">
              <Show when={step() === "file"}>Select a File</Show>
              <Show when={step() === "friends"}>Choose Recipients</Show>
              <Show when={step() === "sharing"}>Sharing</Show>
            </h2>
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

          {/* Content */}
          <div class="flex-1 overflow-y-auto p-6">
            {/* Step 1: File Selection */}
            <Show when={step() === "file"}>
              <div
                class={`flex flex-col items-center justify-center rounded-lg border-2 border-dashed p-12 transition-colors ${
                  isDragging() ? "border-primary bg-primary/5" : "border-border"
                }`}
                onDragOver={(e) => {
                  e.preventDefault();
                  setIsDragging(true);
                }}
                onDragLeave={() => setIsDragging(false)}
                onDrop={handleFileDrop}
              >
                <Show
                  when={selectedFile()}
                  fallback={
                    <>
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="mb-4 h-12 w-12 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="1.5"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
                        />
                      </svg>
                      <p class="mb-2 text-sm text-foreground">Drag and drop a file here</p>
                      <p class="mb-4 text-xs text-muted-foreground">or click to browse</p>
                    </>
                  }
                >
                  {(file) => (
                    <div class="text-center">
                      <p class="mb-1 text-sm font-medium text-foreground">{file().name}</p>
                      <p class="mb-3 text-xs text-muted-foreground">{formatBytes(file().size)}</p>
                      <button
                        onClick={() => setSelectedFile(null)}
                        class="text-xs text-muted-foreground underline hover:text-foreground"
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </Show>

                <input ref={fileInputRef} type="file" class="hidden" onChange={handleFileInput} />

                <Show when={!selectedFile()}>
                  <Button variant="secondary" size="sm" onClick={() => fileInputRef.click()}>
                    Browse Files
                  </Button>
                </Show>
              </div>

              <Show when={error()}>
                <p class="mt-3 text-sm text-destructive-foreground">{error()}</p>
              </Show>

              <p class="mt-4 text-xs text-muted-foreground">
                Files are transferred directly between you and your friends via P2P (peer-to-peer).
                Your IP address will be visible to recipients.
              </p>

              <div class="mt-6 flex justify-end">
                <Button onClick={() => setStep("friends")} disabled={!selectedFile()}>
                  Next
                </Button>
              </div>
            </Show>

            {/* Step 2: Friend Selection */}
            <Show when={step() === "friends"}>
              <div class="mb-4 flex items-center gap-2">
                <Input
                  type="text"
                  placeholder="Search friends..."
                  value={searchQuery()}
                  onInput={(e) => setSearchQuery(e.currentTarget.value)}
                  class="flex-1"
                />
                <Button variant="ghost" size="sm" onClick={selectAll}>
                  Select All
                </Button>
                <Button variant="ghost" size="sm" onClick={deselectAll}>
                  Clear
                </Button>
              </div>

              <div class="mb-4 text-sm text-muted-foreground">
                {selectedFriends().size} friend{selectedFriends().size !== 1 ? "s" : ""} selected
              </div>

              <Show
                when={friends().length > 0}
                fallback={
                  <p class="py-8 text-center text-sm text-muted-foreground">
                    {allAcceptedFriends().length === 0
                      ? "No friends yet. Add friends to share files with them."
                      : "No friends are currently online."}
                  </p>
                }
              >
                <div class="max-h-60 space-y-1 overflow-y-auto">
                  <Show when={filteredFriends().length === 0 && searchQuery().trim()}>
                    <p class="py-4 text-center text-sm text-muted-foreground">
                      No friends match your search
                    </p>
                  </Show>
                  <For each={filteredFriends()}>
                    {(friend) => (
                      <button
                        class={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-colors ${
                          selectedFriends().has(friend.userId) ? "bg-primary/10" : "hover:bg-accent"
                        }`}
                        onClick={() => toggleFriend(friend.userId)}
                      >
                        <div class="relative">
                          <Show
                            when={friend.avatarUrl}
                            fallback={
                              <div class="flex h-8 w-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
                                {(friend.displayName ?? friend.username ?? "?")
                                  .charAt(0)
                                  .toUpperCase()}
                              </div>
                            }
                          >
                            {(url) => (
                              <img src={url()} alt="" class="h-8 w-8 rounded-full object-cover" />
                            )}
                          </Show>
                          <div
                            class={`absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-card ${
                              friend.status === "online" ? "bg-success" : "bg-warning"
                            }`}
                          />
                        </div>
                        <div class="min-w-0 flex-1">
                          <p class="truncate text-sm font-medium text-foreground">
                            {friend.displayName ?? friend.username}
                          </p>
                          <Show when={friend.displayName && friend.username}>
                            <p class="truncate text-xs text-muted-foreground">{friend.username}</p>
                          </Show>
                        </div>
                        <div
                          class={`flex h-5 w-5 items-center justify-center rounded border transition-colors ${
                            selectedFriends().has(friend.userId)
                              ? "border-primary bg-primary"
                              : "border-border"
                          }`}
                        >
                          <Show when={selectedFriends().has(friend.userId)}>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-3.5 w-3.5 text-primary-foreground"
                              viewBox="0 0 20 20"
                              fill="currentColor"
                            >
                              <path
                                fill-rule="evenodd"
                                d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                                clip-rule="evenodd"
                              />
                            </svg>
                          </Show>
                        </div>
                      </button>
                    )}
                  </For>
                </div>
              </Show>

              <Show when={error()}>
                <p class="mt-3 text-sm text-destructive-foreground">{error()}</p>
              </Show>

              <div class="mt-6 flex justify-between">
                <Button variant="secondary" onClick={() => setStep("file")}>
                  Back
                </Button>
                <Button
                  onClick={handleStartSharing}
                  disabled={selectedFriends().size === 0 || loading()}
                >
                  <Show when={loading()} fallback="Start Sharing">
                    <div class="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                    Starting...
                  </Show>
                </Button>
              </div>
            </Show>

            {/* Step 3: Live Transfer */}
            <Show when={step() === "sharing" && activeSenderSessionId()}>
              {(sessionId) => {
                const session = () => getSession(sessionId());
                return <Show when={session()}>{(s) => <ShareVisualization session={s()} />}</Show>;
              }}
            </Show>
          </div>
        </div>

        {/* Close confirmation dialog */}
        <Show when={showCloseConfirm()}>
          <div class="fixed inset-0 z-[60] flex items-center justify-center">
            <div class="fixed inset-0 bg-black/50" onClick={() => setShowCloseConfirm(false)} />
            <div
              class="relative z-10 mx-4 w-full max-w-sm rounded-xl border border-border bg-card p-6 shadow-lg"
              onClick={(e) => e.stopPropagation()}
            >
              <h3 class="mb-2 text-lg font-semibold text-foreground">End Share Session?</h3>
              <p class="mb-4 text-sm text-muted-foreground">
                Closing will end the share session for everyone. Recipients who haven't finished
                downloading will lose access.
              </p>
              <div class="flex justify-end gap-3">
                <Button variant="secondary" onClick={() => setShowCloseConfirm(false)}>
                  Cancel
                </Button>
                <Button variant="destructive" onClick={confirmClose}>
                  End Session
                </Button>
              </div>
            </div>
          </div>
        </Show>
      </div>
    </Portal>
  );
};

export default ShareFileModal;
