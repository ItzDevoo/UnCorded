import { createMemo, Show } from 'solid-js';
import { selectedChannelId, currentChannels } from '../stores/app-store.js';

const ChatArea = () => {
  const channelName = createMemo(() => {
    const id = selectedChannelId();
    return currentChannels().find((c) => c.id === id)?.name ?? null;
  });

  return (
    <div class="flex h-full flex-col">
      <Show when={channelName()}>
        {(name) => (
          <>
            <div class="flex h-12 shrink-0 items-center border-b border-border px-4">
              <span class="font-semibold text-text-primary"># {name()}</span>
            </div>
            <div class="flex flex-1 items-center justify-center">
              <p class="text-text-muted">Messages will appear here</p>
            </div>
          </>
        )}
      </Show>
      <Show when={!channelName()}>
        <div class="flex flex-1 items-center justify-center">
          <p class="text-text-muted">Select a channel to start chatting</p>
        </div>
      </Show>
    </div>
  );
};

export default ChatArea;
