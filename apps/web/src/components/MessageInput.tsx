import { createSignal } from 'solid-js';
import { Opcode } from '@uncorded/protocol';
import { api } from '../lib/api.js';
import { sendFrame } from '../lib/gateway.js';
import { getTypingUsers } from '../stores/message-store.js';

const MessageInput = (props: { channelId: string }) => {
  let textareaRef!: HTMLTextAreaElement;
  const [content, setContent] = createSignal('');
  const [sending, setSending] = createSignal(false);

  const lastTypingSent: Record<string, number> = {};

  function resetHeight() {
    textareaRef.style.height = 'auto';
    textareaRef.style.height = Math.min(textareaRef.scrollHeight, 200) + 'px';
  }

  function handleInput(e: InputEvent & { currentTarget: HTMLTextAreaElement }) {
    setContent(e.currentTarget.value);
    resetHeight();

    // Throttled typing indicator
    const now = Date.now();
    const last = lastTypingSent[props.channelId] ?? 0;
    if (now - last > 5000) {
      lastTypingSent[props.channelId] = now;
      sendFrame({ op: Opcode.TYPING_START, d: { channelId: props.channelId } });
    }
  }

  async function send() {
    const text = content().trim();
    if (!text || sending()) return;

    setSending(true);
    try {
      await api(`/api/channels/${props.channelId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ content: text }),
      });
      setContent('');
      textareaRef.style.height = 'auto';
    } finally {
      setSending(false);
    }
    textareaRef.focus();
  }

  function handleKeyDown(e: KeyboardEvent) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  }

  const typingUsers = () => getTypingUsers(props.channelId);

  const typingText = () => {
    const users = typingUsers();
    if (users.length === 0) return null;
    if (users.length === 1) return `${users[0]?.username} is typing`;
    if (users.length === 2) return `${users[0]?.username} and ${users[1]?.username} are typing`;
    return 'Several people are typing';
  };

  return (
    <div class="shrink-0 px-4 pb-4">
      <div class="rounded-lg bg-bg-input">
        <textarea
          ref={textareaRef}
          value={content()}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          placeholder="Send a message..."
          rows={1}
          class="block w-full resize-none bg-transparent px-4 py-3 text-sm text-text-primary placeholder:text-text-muted outline-none"
          style={{ "max-height": "200px" }}
        />
      </div>
      <div class="h-5 px-2 pt-1">
        {typingText() && (
          <span class="text-xs text-text-muted">
            {typingText()}
            <span class="typing-dots">
              <span class="dot" />
              <span class="dot" />
              <span class="dot" />
            </span>
          </span>
        )}
      </div>
    </div>
  );
};

export default MessageInput;
