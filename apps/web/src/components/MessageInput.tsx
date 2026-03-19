import { createSignal, Show, For } from "solid-js";
import { Opcode, type AnyChannelId } from "@uncorded/protocol";
import { TYPING_THROTTLE_MS, MAX_FILE_SIZE_BYTES } from "@uncorded/shared";
import { showToast } from "./ui/toast.js";
import { api, ApiRequestError } from "../lib/api.js";
import { sendFrame } from "../lib/gateway.js";
import { getTypingUsers } from "../stores/message-store.js";
const TEXTAREA_MAX_HEIGHT = 200;

/** Keyed by ChannelId (branded string) — TS index signatures can't use branded types */
const lastTypingSent: Record<string, number> = {};

const MessageInput = (props: {
  channelId: AnyChannelId;
  onFileSelect?: (file: File) => void;
  fileDisabled?: boolean;
}) => {
  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern, assigned via JSX ref={}
  let textareaRef!: HTMLTextAreaElement;
  const [content, setContent] = createSignal("");
  const [sending, setSending] = createSignal(false);
  const [sendError, setSendError] = createSignal<string | null>(null);

  function resetHeight() {
    textareaRef.style.height = "auto";
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, TEXTAREA_MAX_HEIGHT) + "px";
  }

  function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    setContent(e.currentTarget.value);
    resetHeight();

    // Throttled typing indicator
    const now = Date.now();
    const last = lastTypingSent[props.channelId] ?? 0;
    if (now - last > TYPING_THROTTLE_MS) {
      lastTypingSent[props.channelId] = now;
      sendFrame({ op: Opcode.TYPING_START, d: { channelId: props.channelId } });
    }
  }

  async function send() {
    const text = content().trim();
    if (!text || sending()) return;

    setSending(true);
    setSendError(null);
    try {
      await api(`/api/channels/${props.channelId}/messages`, {
        method: "POST",
        body: JSON.stringify({ content: text }),
      });
      setContent("");
      textareaRef.style.height = "auto";
    } catch (err) {
      const message = err instanceof ApiRequestError ? err.body.message : "Failed to send message";
      setSendError(message);
    } finally {
      setSending(false);
    }
    textareaRef.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  function validateAndSelectFile(file: File): boolean {
    if (file.size > MAX_FILE_SIZE_BYTES) {
      const limitGb = (MAX_FILE_SIZE_BYTES / (1024 * 1024 * 1024)).toFixed(0);
      showToast(`File too large. Maximum size is ${limitGb} GB`, "error");
      return false;
    }
    props.onFileSelect?.(file);
    return true;
  }

  function handlePaste(e: ClipboardEvent) {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.kind === "file" && !props.fileDisabled && props.onFileSelect) {
        const file = item.getAsFile();
        if (file) {
          e.preventDefault();
          validateAndSelectFile(file);
          return;
        }
      }
    }
  }

  const typingUsers = () => getTypingUsers(props.channelId);

  const typingText = () => {
    const users = typingUsers();
    if (users.length === 0) return null;
    if (users.length === 1) return `${users[0]?.username} is typing`;
    if (users.length === 2) return `${users[0]?.username} and ${users[1]?.username} are typing`;
    return "Several people are typing";
  };

  // oxlint-disable-next-line no-unassigned-vars -- SolidJS ref pattern
  let fileInputRef!: HTMLInputElement;

  function handleFileClick() {
    if (!props.fileDisabled) fileInputRef.click();
  }

  function handleFileChange(e: Event & { currentTarget: HTMLInputElement }) {
    const file = e.currentTarget.files?.[0];
    if (!file) return;
    validateAndSelectFile(file);
    e.currentTarget.value = "";
  }

  return (
    <div class="shrink-0 px-4 pb-4">
      <input
        ref={fileInputRef}
        type="file"
        class="hidden"
        onChange={handleFileChange}
      />
      <div class="flex items-end gap-0 rounded-lg bg-input">
        <Show when={!props.fileDisabled && props.onFileSelect}>
          <button
            type="button"
            onClick={handleFileClick}
            class="shrink-0 p-3 text-muted-foreground transition-colors hover:text-foreground"
            title="Attach file"
            aria-label="Attach file"
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" />
            </svg>
          </button>
        </Show>
        <textarea
          ref={textareaRef}
          value={content()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder="Send a message..."
          rows={1}
          class={`block w-full resize-none bg-transparent py-3 text-sm text-foreground placeholder:text-muted-foreground outline-none ${!props.fileDisabled && props.onFileSelect ? "pr-4" : "px-4"}`}
          style={{ "max-height": `${TEXTAREA_MAX_HEIGHT}px` }}
        />
      </div>
      <Show when={sendError()}>
        <p class="px-2 pt-1 text-xs text-destructive">{sendError()}</p>
      </Show>
      <div class="h-5 px-2 pt-1">
        <Show when={typingText()}>
          {(text) => (
            <div class="flex items-center gap-1.5 h-5">
              <For each={typingUsers()}>
                {(user) => (
                  <div class="flex h-5 w-5 items-center justify-center rounded-full bg-primary/15 text-[10px] font-semibold text-primary">
                    {(user.username?.[0] ?? "?").toUpperCase()}
                  </div>
                )}
              </For>
              <span class="text-xs text-muted-foreground">
                {text()}
                <span class="typing-dots">
                  <span class="dot" />
                  <span class="dot" />
                  <span class="dot" />
                </span>
              </span>
            </div>
          )}
        </Show>
      </div>
    </div>
  );
};

export default MessageInput;
