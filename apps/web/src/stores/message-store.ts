import { createStore, produce } from "solid-js/store";
import { MESSAGE_PAGE_LIMIT, TYPING_TIMEOUT_MS } from "@uncorded/shared";
import { Opcode } from "@uncorded/protocol";
import type { MessageId, AnyChannelId, UserId } from "@uncorded/protocol";
import {
  channelId,
  messageId,
  userId,
  messageCreateEventSchema,
  messageUpdateEventSchema,
  messageDeleteEventSchema,
  typingStartEventSchema,
} from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { api } from "../lib/api.js";
import { readyData } from "../lib/gateway-store.js";

export interface MessageFileReceipt {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string;
  infoHash: string;
}

export interface Message {
  id: MessageId;
  channelId: AnyChannelId;
  content: string | null;
  editedAt: string | null;
  createdAt: string;
  author: {
    id: UserId;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
    isBot?: boolean;
  };
  fileReceipt?: MessageFileReceipt | null | undefined;
}

interface ChannelMessages {
  messages: Message[];
  loading: boolean;
  hasMore: boolean;
  fetchError: string | null;
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

const LIMIT = MESSAGE_PAGE_LIMIT;

const [store, setStore] = createStore<MessageStoreState>({
  channels: {},
  typing: {},
});

export async function fetchMessages(cId: AnyChannelId) {
  const key = cId as string;
  const existing = store.channels[key];
  if (existing?.loading) return;

  // Initialize channel entry if needed
  if (!existing) {
    setStore("channels", key, { messages: [], loading: true, hasMore: true, fetchError: null });
  } else {
    setStore("channels", key, "loading", true);
    setStore("channels", key, "fetchError", null);
  }

  const oldest = store.channels[key]?.messages[0];
  const query = oldest ? `?before=${oldest.id}&limit=${LIMIT}` : `?limit=${LIMIT}`;

  try {
    const res = await api<{ messages: Message[] }>(`/api/channels/${cId}/messages${query}`);
    setStore(
      "channels",
      key,
      produce((ch) => {
        if (!ch) return;
        ch.messages = [...res.messages, ...ch.messages];
        ch.hasMore = res.messages.length === LIMIT;
        ch.loading = false;
      }),
    );
  } catch (err) {
    setStore("channels", key, "loading", false);
    setStore(
      "channels",
      key,
      "fetchError",
      err instanceof Error ? err.message : "Failed to load messages",
    );
  }
}

export function addMessage(cId: AnyChannelId, message: Message) {
  const key = cId as string;
  if (!store.channels[key]) {
    setStore("channels", key, {
      messages: [message],
      loading: false,
      hasMore: true,
      fetchError: null,
    });
    return;
  }
  setStore("channels", key, "messages", (prev) => {
    if (prev.some((m) => m.id === message.id)) return prev;
    return [...prev, message];
  });
}

export function updateMessage(
  cId: AnyChannelId,
  mId: MessageId,
  updates: { content: string; editedAt: string | null },
) {
  const key = cId as string;
  setStore(
    "channels",
    key,
    produce((ch) => {
      if (!ch) return;
      const msg = ch.messages.find((m) => m.id === mId);
      if (msg) {
        msg.content = updates.content;
        msg.editedAt = updates.editedAt;
      }
    }),
  );
}

export function removeMessage(cId: AnyChannelId, mId: MessageId) {
  const key = cId as string;
  setStore(
    "channels",
    key,
    produce((ch) => {
      if (!ch) return;
      ch.messages = ch.messages.filter((m) => m.id !== mId);
    }),
  );
}

export function getMessages(cId: AnyChannelId): ChannelMessages | undefined {
  return store.channels[cId as string];
}

export function getTypingUsers(cId: AnyChannelId): TypingUser[] {
  const selfId = readyData.data?.user.id;
  const now = Date.now();
  return (store.typing[cId as string] ?? []).filter(
    (t) => t.expiresAt > now && t.userId !== selfId,
  );
}

export function addTypingUser(cId: AnyChannelId, uId: UserId, username: string) {
  const key = cId as string;
  if (!store.typing[key]) {
    setStore("typing", key, [{ userId: uId, username, expiresAt: Date.now() + TYPING_TIMEOUT_MS }]);
    return;
  }
  setStore(
    "typing",
    key,
    produce((users) => {
      const existing = users.find((t) => t.userId === uId);
      if (existing) {
        existing.expiresAt = Date.now() + TYPING_TIMEOUT_MS;
      } else {
        users.push({ userId: uId, username, expiresAt: Date.now() + TYPING_TIMEOUT_MS });
      }
    }),
  );
}

// --- WS listener unsub refs (module-level for HMR dispose access) ---

let unsubCreate: (() => void) | null = null;
let unsubUpdate: (() => void) | null = null;
let unsubDelete: (() => void) | null = null;
let unsubTyping: (() => void) | null = null;
let cleanupInterval: ReturnType<typeof setInterval> | null = null;

const TYPING_CLEANUP_INTERVAL_MS = 1_000;

function teardown() {
  unsubCreate?.();
  unsubUpdate?.();
  unsubDelete?.();
  unsubTyping?.();
  unsubCreate = null;
  unsubUpdate = null;
  unsubDelete = null;
  unsubTyping = null;
  if (cleanupInterval !== null) {
    clearInterval(cleanupInterval);
    cleanupInterval = null;
  }
}

export function setupMessageStore(): void {
  // Guard against double-init (HMR or reconnect)
  teardown();

  unsubCreate = onGatewayEvent(Opcode.MESSAGE_CREATE, (data) => {
    const parsed = messageCreateEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn("Invalid MESSAGE_CREATE payload:", parsed.error.issues);
      return;
    }
    const d = parsed.data;
    const msg: Message = {
      id: messageId(d.id),
      channelId: channelId(d.channelId),
      content: d.content,
      editedAt: d.editedAt,
      createdAt: d.createdAt,
      author: {
        id: userId(d.author.id),
        username: d.author.username,
        displayName: d.author.displayName,
        avatarUrl: d.author.avatarUrl,
        isBot: d.author.isBot,
      },
      fileReceipt: d.fileReceipt ?? null,
    };
    addMessage(msg.channelId, msg);
  });

  unsubUpdate = onGatewayEvent(Opcode.MESSAGE_UPDATE, (data) => {
    const parsed = messageUpdateEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn("Invalid MESSAGE_UPDATE payload:", parsed.error.issues);
      return;
    }
    const d = parsed.data;
    updateMessage(channelId(d.channelId), messageId(d.id), {
      content: d.content,
      editedAt: d.editedAt,
    });
  });

  unsubDelete = onGatewayEvent(Opcode.MESSAGE_DELETE, (data) => {
    const parsed = messageDeleteEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn("Invalid MESSAGE_DELETE payload:", parsed.error.issues);
      return;
    }
    const d = parsed.data;
    removeMessage(channelId(d.channelId), messageId(d.id));
  });

  unsubTyping = onGatewayEvent(Opcode.TYPING_START, (data) => {
    const parsed = typingStartEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV) console.warn("Invalid TYPING_START payload:", parsed.error.issues);
      return;
    }
    const d = parsed.data;
    addTypingUser(channelId(d.channelId), userId(d.userId), d.username);
  });

  // Typing cleanup interval
  cleanupInterval = setInterval(() => {
    const now = Date.now();
    for (const chId of Object.keys(store.typing)) {
      const users = store.typing[chId];
      if (users && users.some((t) => t.expiresAt <= now)) {
        const filtered = users.filter((t) => t.expiresAt > now);
        setStore("typing", chId, filtered);
      }
    }
  }, TYPING_CLEANUP_INTERVAL_MS);
}

// --- HMR cleanup ---

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
