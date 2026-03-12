import { describe, it, expect } from "vitest";
import { createServerSchema } from "./schemas/server.js";
import { createChannelSchema } from "./schemas/channel.js";
import { createMessageSchema, updateMessageSchema } from "./schemas/message.js";
import { updateUserSchema, USERNAME_MAX } from "./schemas/user.js";
import { createDmSchema } from "./schemas/dm.js";

describe("createServerSchema", () => {
  it("accepts valid server name", () => {
    const result = createServerSchema.safeParse({ name: "My Server" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createServerSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 100 chars", () => {
    const result = createServerSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts name at max length", () => {
    const result = createServerSchema.safeParse({ name: "a".repeat(100) });
    expect(result.success).toBe(true);
  });

  it("accepts optional iconUrl", () => {
    const result = createServerSchema.safeParse({
      name: "Test",
      iconUrl: "https://example.com/icon.png",
    });
    expect(result.success).toBe(true);
  });

  it("accepts null iconUrl", () => {
    const result = createServerSchema.safeParse({ name: "Test", iconUrl: null });
    expect(result.success).toBe(true);
  });

  it("rejects invalid iconUrl", () => {
    const result = createServerSchema.safeParse({ name: "Test", iconUrl: "not-a-url" });
    expect(result.success).toBe(false);
  });
});

describe("createChannelSchema", () => {
  it("accepts valid channel with name only", () => {
    const result = createChannelSchema.safeParse({ name: "general" });
    expect(result.success).toBe(true);
  });

  it("rejects empty name", () => {
    const result = createChannelSchema.safeParse({ name: "" });
    expect(result.success).toBe(false);
  });

  it("rejects name exceeding 100 chars", () => {
    const result = createChannelSchema.safeParse({ name: "a".repeat(101) });
    expect(result.success).toBe(false);
  });

  it("accepts valid type 'text'", () => {
    const result = createChannelSchema.safeParse({ name: "chat", type: "text" });
    expect(result.success).toBe(true);
  });

  it("accepts valid type 'category'", () => {
    const result = createChannelSchema.safeParse({ name: "info", type: "category" });
    expect(result.success).toBe(true);
  });

  it("rejects invalid type", () => {
    const result = createChannelSchema.safeParse({ name: "chat", type: "voice" });
    expect(result.success).toBe(false);
  });

  it("accepts optional fileSharingEnabled", () => {
    const result = createChannelSchema.safeParse({ name: "files", fileSharingEnabled: true });
    expect(result.success).toBe(true);
  });

  it("accepts optional topic within bounds", () => {
    const result = createChannelSchema.safeParse({ name: "dev", topic: "Development discussion" });
    expect(result.success).toBe(true);
  });

  it("rejects topic exceeding 1024 chars", () => {
    const result = createChannelSchema.safeParse({ name: "dev", topic: "x".repeat(1025) });
    expect(result.success).toBe(false);
  });
});

describe("createMessageSchema", () => {
  it("accepts valid content", () => {
    const result = createMessageSchema.safeParse({ content: "Hello world" });
    expect(result.success).toBe(true);
  });

  it("accepts omitted content (optional)", () => {
    const result = createMessageSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("rejects content exceeding 4000 chars", () => {
    const result = createMessageSchema.safeParse({ content: "x".repeat(4001) });
    expect(result.success).toBe(false);
  });

  it("accepts content at max length", () => {
    const result = createMessageSchema.safeParse({ content: "x".repeat(4000) });
    expect(result.success).toBe(true);
  });
});

describe("updateMessageSchema", () => {
  it("accepts valid content", () => {
    const result = updateMessageSchema.safeParse({ content: "Updated" });
    expect(result.success).toBe(true);
  });

  it("rejects empty content", () => {
    const result = updateMessageSchema.safeParse({ content: "" });
    expect(result.success).toBe(false);
  });

  it("rejects content exceeding 4000 chars", () => {
    const result = updateMessageSchema.safeParse({ content: "x".repeat(4001) });
    expect(result.success).toBe(false);
  });
});

describe("updateUserSchema", () => {
  it("accepts valid username", () => {
    const result = updateUserSchema.safeParse({ username: "test_user" });
    expect(result.success).toBe(true);
  });

  it("rejects username shorter than min", () => {
    const result = updateUserSchema.safeParse({ username: "a" });
    expect(result.success).toBe(false);
  });

  it("rejects username exceeding max", () => {
    const result = updateUserSchema.safeParse({ username: "a".repeat(USERNAME_MAX + 1) });
    expect(result.success).toBe(false);
  });

  it("rejects username with special characters", () => {
    const result = updateUserSchema.safeParse({ username: "user@name" });
    expect(result.success).toBe(false);
  });

  it("accepts username with underscores", () => {
    const result = updateUserSchema.safeParse({ username: "my_user_123" });
    expect(result.success).toBe(true);
  });

  it("accepts all fields as optional", () => {
    const result = updateUserSchema.safeParse({});
    expect(result.success).toBe(true);
  });

  it("accepts valid status values", () => {
    for (const status of ["online", "idle", "dnd", "offline"]) {
      const result = updateUserSchema.safeParse({ status });
      expect(result.success).toBe(true);
    }
  });

  it("rejects invalid status", () => {
    const result = updateUserSchema.safeParse({ status: "invisible" });
    expect(result.success).toBe(false);
  });

  it("accepts nullable displayName", () => {
    const result = updateUserSchema.safeParse({ displayName: null });
    expect(result.success).toBe(true);
  });

  it("rejects displayName exceeding 64 chars", () => {
    const result = updateUserSchema.safeParse({ displayName: "a".repeat(65) });
    expect(result.success).toBe(false);
  });
});

describe("createDmSchema", () => {
  it("accepts valid userId", () => {
    const result = createDmSchema.safeParse({ userId: "abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty userId", () => {
    const result = createDmSchema.safeParse({ userId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing userId", () => {
    const result = createDmSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});
