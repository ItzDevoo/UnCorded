import { createStore, produce } from 'solid-js/store';
import { Opcode } from '@uncorded/protocol';
import { onGatewayEvent, sendFrame } from '../lib/gateway.js';
import { api } from '../lib/api.js';
import { readyData } from '../lib/gateway-store.js';

export interface Message {
  id: string;
  channelId: string;
  content: string;
  editedAt: string | null;
  createdAt: string;
  author: {
    id: string;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
}

interface ChannelMessages {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
}

interface TypingUser {
  userId: string;
  username: string;
  expiresAt: number;
}

interface MessageStoreState {
  channels: Record<string, ChannelMessages>;
  typing: Record<string, TypingUser[]>;
}

const LIMIT = 50;

const [store, setStore] = createStore<MessageStoreState>({
  channels: {},
  typing: {},
});

export async function fetchMessages(channelId: string) {
  const existing = store.channels[channelId];
  if (existing?.loading) return;

  // Initialize channel entry if needed
  if (!existing) {
    setStore('channels', channelId, { messages: [], loading: true, hasMore: true });
  } else {
    setStore('channels', channelId, 'loading', true);
  }

  const oldest = store.channels[channelId]?.messages[0];
  const query = oldest ? `?before=${oldest.id}&limit=${LIMIT}` : `?limit=${LIMIT}`;

  try {
    const res = await api<{ messages: Message[] }>(
      `/api/channels/${channelId}/messages${query}`,
    );
    setStore(
      'channels',
      channelId,
      produce((ch) => {
        if (!ch) return;
        ch.messages = [...res.messages, ...ch.messages];
        ch.hasMore = res.messages.length === LIMIT;
        ch.loading = false;
      }),
    );
  } catch {
    setStore('channels', channelId, 'loading', false);
  }
}

export function addMessage(channelId: string, message: Message) {
  setStore(
    'channels',
    channelId,
    produce((ch) => {
      if (!ch) {
        // Channel not loaded yet — bootstrap it
        return;
      }
      if (ch.messages.some((m) => m.id === message.id)) return;
      ch.messages.push(message);
    }),
  );

  // If channel wasn't in store, create it with this message
  if (!store.channels[channelId]) {
    setStore('channels', channelId, {
      messages: [message],
      loading: false,
      hasMore: true,
    });
  }
}

export function updateMessage(
  channelId: string,
  messageId: string,
  updates: { content: string; editedAt: string | null },
) {
  setStore(
    'channels',
    channelId,
    produce((ch) => {
      if (!ch) return;
      const msg = ch.messages.find((m) => m.id === messageId);
      if (msg) {
        msg.content = updates.content;
        msg.editedAt = updates.editedAt;
      }
    }),
  );
}

export function removeMessage(channelId: string, messageId: string) {
  setStore(
    'channels',
    channelId,
    produce((ch) => {
      if (!ch) return;
      ch.messages = ch.messages.filter((m) => m.id !== messageId);
    }),
  );
}

export function getMessages(channelId: string): ChannelMessages | undefined {
  return store.channels[channelId];
}

export function getTypingUsers(channelId: string): TypingUser[] {
  const selfId = readyData.data?.user.id;
  const now = Date.now();
  return (store.typing[channelId] ?? []).filter(
    (t) => t.expiresAt > now && t.userId !== selfId,
  );
}

export function addTypingUser(channelId: string, userId: string, username: string) {
  setStore(
    'typing',
    channelId,
    produce((users) => {
      if (!users) return;
      const existing = users.find((t) => t.userId === userId);
      if (existing) {
        existing.expiresAt = Date.now() + 6000;
      } else {
        users.push({ userId, username, expiresAt: Date.now() + 6000 });
      }
    }),
  );

  // Initialize if not present
  if (!store.typing[channelId]) {
    setStore('typing', channelId, [{ userId, username, expiresAt: Date.now() + 6000 }]);
  }
}

// --- WS listeners (run once on import) ---

/* eslint-disable solid/reactivity -- these are event handlers, not tracked scopes */
onGatewayEvent(Opcode.MESSAGE_CREATE, (data) => {
  const d = data as Message;
  addMessage(d.channelId, d);
});

onGatewayEvent(Opcode.MESSAGE_UPDATE, (data) => {
  const d = data as { id: string; channelId: string; content: string; editedAt: string | null };
  updateMessage(d.channelId, d.id, { content: d.content, editedAt: d.editedAt });
});

onGatewayEvent(Opcode.MESSAGE_DELETE, (data) => {
  const d = data as { id: string; channelId: string };
  removeMessage(d.channelId, d.id);
});

onGatewayEvent(Opcode.TYPING_START, (data) => {
  const d = data as { channelId: string; userId: string; username: string };
  addTypingUser(d.channelId, d.userId, d.username);
});
/* eslint-enable solid/reactivity */

// --- Typing cleanup interval ---

setInterval(() => {
  const now = Date.now();
  for (const channelId of Object.keys(store.typing)) {
    const users = store.typing[channelId];
    if (users && users.some((t) => t.expiresAt <= now)) {
      setStore(
        'typing',
        channelId,
        produce((arr) => {
          if (!arr) return;
          const filtered = arr.filter((t) => t.expiresAt > now);
          arr.length = 0;
          arr.push(...filtered);
        }),
      );
    }
  }
}, 1000);

export { sendFrame };
