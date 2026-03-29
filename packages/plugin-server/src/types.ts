/** Server information returned by the bridge. */
export interface Server {
  id: string;
  name: string;
  iconUrl: string | null;
  memberCount: number;
  channelCount: number;
}

/** A server member. */
export interface Member {
  id: string;
  username: string;
  displayName: string;
  avatarUrl: string | null;
  roles: string[];
  joinedAt: string;
}

/** A channel. */
export interface Channel {
  id: string;
  name: string;
  type: string;
  position: number;
}

/** A chat message. */
export interface Message {
  id: string;
  channelId: string;
  authorId: string;
  content: string;
  createdAt: string;
  editedAt: string | null;
}

/** A user profile. */
export interface User {
  id: string;
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
}
