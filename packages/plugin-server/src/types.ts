import type { ChannelId, MessageId, ServerId, UserId } from "@uncorded/protocol";

/** Server information returned by the bridge. */
export interface Server {
  id: ServerId;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  channelCount: number;
}

/** A server member. */
export interface Member {
  id: UserId;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  joinedAt: string;
}

/** A channel. */
export interface Channel {
  id: ChannelId;
  name: string;
  type: string;
  position: number;
}

/** A chat message. */
export interface Message {
  id: MessageId;
  channelId: ChannelId;
  authorId: UserId;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

/** A user profile. */
export interface User {
  id: UserId;
  username: string;
  displayName: string;
  avatarUrl: string | null;
}

/** Options for fetching messages. */
export interface GetMessagesOptions {
  limit?: number;
}

/** Options for setting a storage value. */
export interface SetStorageOptions {
  encrypt?: boolean;
}

/** Bridge constructor options. */
export interface BridgeOptions {
  /** Base URL of the sidecar bridge (default: UNCORDED_BRIDGE_URL env var). */
  baseUrl?: string;
  /** Bearer token for auth (default: UNCORDED_BRIDGE_TOKEN env var). */
  token?: string;
  /** Request timeout in ms. Defaults to 30000. */
  timeoutMs?: number;
}
