/** Mock server info. */
export const mockServer = {
  id: "mock-server-001",
  name: "Mock Server",
  iconUrl: null,
  memberCount: 3,
  channelCount: 2,
};

/** Mock members list. */
export const mockMembers = [
  {
    id: "user-001",
    username: "alice",
    displayName: "Alice",
    avatarUrl: null,
    roles: ["admin"],
    joinedAt: "2025-01-01T00:00:00Z",
  },
  {
    id: "user-002",
    username: "bob",
    displayName: "Bob",
    avatarUrl: null,
    roles: ["member"],
    joinedAt: "2025-01-02T00:00:00Z",
  },
  {
    id: "user-003",
    username: "charlie",
    displayName: "Charlie",
    avatarUrl: null,
    roles: ["member"],
    joinedAt: "2025-01-03T00:00:00Z",
  },
];

/** Mock channels list. */
export const mockChannels = [
  { id: "channel-001", name: "general", type: "text", position: 0 },
  { id: "channel-002", name: "random", type: "text", position: 1 },
];

/** Mock messages per channel. */
export const mockMessages: Record<
  string,
  Array<{
    id: string;
    channelId: string;
    authorId: string;
    content: string;
    createdAt: string;
    editedAt: string | null;
  }>
> = {
  "channel-001": [
    {
      id: "msg-001",
      channelId: "channel-001",
      authorId: "user-001",
      content: "Hello from the mock bridge!",
      createdAt: "2025-01-01T12:00:00Z",
      editedAt: null,
    },
    {
      id: "msg-002",
      channelId: "channel-001",
      authorId: "user-002",
      content: "Hey Alice!",
      createdAt: "2025-01-01T12:01:00Z",
      editedAt: null,
    },
  ],
  "channel-002": [
    {
      id: "msg-003",
      channelId: "channel-002",
      authorId: "user-003",
      content: "Anyone here?",
      createdAt: "2025-01-01T12:05:00Z",
      editedAt: null,
    },
  ],
};

/** Mock user lookup. */
export const mockUsers: Record<
  string,
  { id: string; username: string; displayName: string; avatarUrl: string | null }
> = {
  "user-001": { id: "user-001", username: "alice", displayName: "Alice", avatarUrl: null },
  "user-002": { id: "user-002", username: "bob", displayName: "Bob", avatarUrl: null },
  "user-003": { id: "user-003", username: "charlie", displayName: "Charlie", avatarUrl: null },
};

/** Mock config. */
export const mockConfig: Record<string, unknown> = {
  greeting: "Welcome to the mock plugin!",
  maxItems: 100,
};
