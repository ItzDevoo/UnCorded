import { Elysia, t } from "elysia";
import {
  mockChannels,
  mockConfig,
  mockMembers,
  mockMessages,
  mockServer,
  mockUsers,
} from "./mock-data.js";
import { MockStorage } from "./storage.js";

/** Create the mock bridge Elysia server. */
// eslint-disable-next-line @typescript-eslint/explicit-function-return-type
export function createMockBridge() {
  const storage = new MockStorage();

  const app = new Elysia()
    // ── Auth middleware (accepts any Bearer token) ──────────
    .derive(({ headers }) => {
      const auth = headers["authorization"];
      if (!auth?.startsWith("Bearer ")) {
        throw new Error("Unauthorized");
      }
      return {
        pluginId: "mock-plugin",
        serverId: mockServer.id,
        scope: "server" as const,
        permissions: ["*"],
      };
    })

    // ── Server ─────────────────────────────────────────────
    .get("/bridge/server", () => mockServer)

    // ── Members ────────────────────────────────────────────
    .get("/bridge/members", () => ({ members: mockMembers }))

    // ── Channels ───────────────────────────────────────────
    .get("/bridge/channels", () => ({ channels: mockChannels }))

    // ── Messages ───────────────────────────────────────────
    .get(
      "/bridge/channels/:channelId/messages",
      ({ params, query }) => {
        const channelId = params.channelId;
        const limit = query.limit ? Number(query.limit) : 50;
        const messages = mockMessages[channelId] ?? [];
        return {
          channelId,
          messages: messages.slice(0, limit),
          limit,
        };
      },
      {
        query: t.Object({
          limit: t.Optional(t.String()),
        }),
      },
    )

    .post(
      "/bridge/channels/:channelId/messages",
      ({ params, body }) => {
        const channelId = params.channelId;
        const newMsg = {
          id: `msg-${Date.now()}`,
          channelId,
          authorId: "mock-plugin",
          content: (body as { content: string }).content,
          createdAt: new Date().toISOString(),
          editedAt: null,
        };
        const channelMsgs = mockMessages[channelId];
        if (channelMsgs) {
          channelMsgs.push(newMsg);
        } else {
          mockMessages[channelId] = [newMsg];
        }
        return { channelId, sent: true };
      },
      {
        body: t.Object({
          content: t.String(),
        }),
      },
    )

    // ── Users ──────────────────────────────────────────────
    .get("/bridge/users/:userId", ({ params }) => {
      const user = mockUsers[params.userId];
      if (!user) {
        throw new Error("User not found");
      }
      return user;
    })

    // ── Presence ───────────────────────────────────────────
    .get("/bridge/presence", () => ({ presence: [] }))

    // ── Notify ─────────────────────────────────────────────
    .post(
      "/bridge/notify",
      ({ body }) => {
        const { title, body: notifBody } = body as { title: string; body: string };
        console.log(`[mock-bridge] Notification: ${title} — ${notifBody}`);
        return { sent: true };
      },
      {
        body: t.Object({
          title: t.String(),
          body: t.String(),
        }),
      },
    )

    // ── Config ─────────────────────────────────────────────
    .get("/bridge/config", () => ({ config: mockConfig }))

    // ── Storage ────────────────────────────────────────────
    .get("/bridge/storage/:key", ({ params }) => {
      const value = storage.get(params.key);
      return { key: params.key, value };
    })

    .put(
      "/bridge/storage/:key",
      ({ params, body, query }) => {
        const encrypt = query.encrypt === "true";
        storage.set(params.key, (body as { value: unknown }).value, encrypt);
        return { key: params.key, stored: true };
      },
      {
        body: t.Object({
          value: t.Unknown(),
        }),
        query: t.Object({
          encrypt: t.Optional(t.String()),
        }),
      },
    )

    .delete("/bridge/storage/:key", ({ params }) => {
      const deleted = storage.delete(params.key);
      return { key: params.key, deleted };
    });

  return app;
}
