import type { Message } from '../stores/message-store.js';

function formatTimestamp(iso: string): string {
  const date = new Date(iso);
  const now = Date.now();
  const diff = now - date.getTime();

  if (diff < 60_000) return 'just now';
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`;
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`;

  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

const MessageBubble = (props: { message: Message; isOwn: boolean }) => {
  const displayName = () =>
    props.message.author.displayName || props.message.author.username || 'Unknown';

  return (
    <div class={`group flex gap-3 px-4 py-1 hover:bg-bg-hover ${props.isOwn ? 'bg-brand/5' : ''}`}>
      <div class="mt-0.5 h-8 w-8 shrink-0 rounded-full bg-bg-active" />
      <div class="min-w-0 flex-1">
        <div class="flex items-baseline gap-2">
          <span
            class={`text-sm font-semibold ${props.isOwn ? 'text-brand' : 'text-text-primary'}`}
          >
            {displayName()}
          </span>
          <span class="text-xs text-text-muted">{formatTimestamp(props.message.createdAt)}</span>
        </div>
        <p class="break-words text-sm text-text-secondary">
          {props.message.content}
          {props.message.editedAt && (
            <span class="ml-1 text-xs text-text-muted">(edited)</span>
          )}
        </p>
      </div>
    </div>
  );
};

export default MessageBubble;
