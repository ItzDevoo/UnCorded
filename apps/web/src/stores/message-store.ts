import { createStore, produce } from "solid-js/store";
import { z } from "zod";
import { MESSAGE_PAGE_LIMIT } from "@uncorded/shared";
import { Opcode } from "@uncorded/protocol";
import type { MessageId, AnyChannelId, UserId } from "@uncorded/protocol";
import { channelId, messageId, userId } from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { api } from "../lib/api.js";
import { readyData } from "../lib/gateway-store.js";

export interface Message {
  id: MessageId;
  channelId: AnyChannelId;
  content: string;
  editedAt: string | null;
  createdAt: string;
  author: {
    id: UserId;
    username: string | null;
    displayName: string | null;
    avatarUrl: string | null;
  };
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
// Must exceed TYPING_THROTTLE_MS (5s) so indicators don't flicker between sends
const TYPING_TIMEOUT_MS = 6000;

const [store, setStore] = createStore<MessageStoreState>({
  channels: {},
  typing: {},
});

// --- Zod schemas for WS event validation ---

const authorSchema = z.object({
  id: z.string(),
  username: z.string().nullable(),
  displayName: z.string().nullable(),
  avatarUrl: z.string().nullable(),
});

/** Accepts both ISO strings and Date objects (MessagePack preserves Dates). */
const coerceDate = z.union([z.string(), z.date().transform((d) => d.toISOString())]);
const coerceDateNullable = coerceDate.nullable();

const messageCreateSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  content: z.string(),
  editedAt: coerceDateNullable,
  createdAt: coerceDate,
  author: authorSchema,
});

const messageUpdateSchema = z.object({
  id: z.string(),
  channelId: z.string(),
  content: z.string(),
  editedAt: coerceDateNullable,
});

const messageDeleteSchema = z.object({
  id: z.string(),
  channelId: z.string(),
});

const typingStartSchema = z.object({
  channelId: z.string(),
  userId: z.string(),
  username: z.string(),
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
  setStore(
    "channels",
    key,
    produce((ch) => {
      if (ch.messages.some((m) => m.id === message.id)) return;
      ch.messages.push(message);
    }),
  );
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

// --- WS listeners (run once on import) ---

/* eslint-disable solid/reactivity -- these are event handlers, not tracked scopes */
const unsubCreate = onGatewayEvent(Opcode.MESSAGE_CREATE, (data) => {
  const parsed = messageCreateSchema.safeParse(data);
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
    },
  };
  addMessage(msg.channelId, msg);
});

const unsubUpdate = onGatewayEvent(Opcode.MESSAGE_UPDATE, (data) => {
  const parsed = messageUpdateSchema.safeParse(data);
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

const unsubDelete = onGatewayEvent(Opcode.MESSAGE_DELETE, (data) => {
  const parsed = messageDeleteSchema.safeParse(data);
  if (!parsed.success) {
    if (import.meta.env.DEV) console.warn("Invalid MESSAGE_DELETE payload:", parsed.error.issues);
    return;
  }
  const d = parsed.data;
  removeMessage(channelId(d.channelId), messageId(d.id));
});

const unsubTyping = onGatewayEvent(Opcode.TYPING_START, (data) => {
  const parsed = typingStartSchema.safeParse(data);
  if (!parsed.success) {
    if (import.meta.env.DEV) console.warn("Invalid TYPING_START payload:", parsed.error.issues);
    return;
  }
  const d = parsed.data;
  addTypingUser(channelId(d.channelId), userId(d.userId), d.username);
});
/* eslint-enable solid/reactivity */

// --- Typing cleanup interval ---

const cleanupInterval = setInterval(() => {
  const now = Date.now();
  for (const chId of Object.keys(store.typing)) {
    const users = store.typing[chId];
    if (users && users.some((t) => t.expiresAt <= now)) {
      setStore(
        "typing",
        chId,
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

// --- HMR cleanup ---

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(cleanupInterval);
    unsubCreate();
    unsubUpdate();
    unsubDelete();
    unsubTyping();
  });
}
