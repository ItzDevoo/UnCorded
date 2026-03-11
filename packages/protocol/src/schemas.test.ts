import { describe, it, expect } from "vitest";
import {
  identifyRequestSchema,
  typingStartRequestSchema,
  readyEventSchema,
  fileShareRequestSchema,
  webRtcSignalRequestSchema,
  coerceDate,
  coerceDateNullable,
} from "./schemas.js";

describe("identifyRequestSchema", () => {
  it("accepts valid ticket", () => {
    const result = identifyRequestSchema.safeParse({ ticket: "my-ticket-uuid" });
    expect(result.success).toBe(true);
  });

  it("rejects missing ticket", () => {
    const result = identifyRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });

  it("rejects non-string ticket", () => {
    const result = identifyRequestSchema.safeParse({ ticket: 123 });
    expect(result.success).toBe(false);
  });
});

describe("typingStartRequestSchema", () => {
  it("accepts valid channelId", () => {
    const result = typingStartRequestSchema.safeParse({ channelId: "ch_abc123" });
    expect(result.success).toBe(true);
  });

  it("rejects empty channelId", () => {
    const result = typingStartRequestSchema.safeParse({ channelId: "" });
    expect(result.success).toBe(false);
  });

  it("rejects missing channelId", () => {
    const result = typingStartRequestSchema.safeParse({});
    expect(result.success).toBe(false);
  });
});

describe("fileShareRequestSchema", () => {
  it("accepts valid file share request", () => {
    const result = fileShareRequestSchema.safeParse({
      channelId: "ch_1",
      fileName: "photo.jpg",
      fileSize: 1024,
      contentType: "image/jpeg",
      magnetUri: "magnet:?xt=urn:btih:abc123",
      infoHash: "abc123",
    });
    expect(result.success).toBe(true);
  });

  it("rejects negative fileSize", () => {
    const result = fileShareRequestSchema.safeParse({
      channelId: "ch_1",
      fileName: "file.txt",
      fileSize: -1,
      contentType: "text/plain",
      magnetUri: "magnet:?xt=urn:btih:abc",
      infoHash: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects magnetUri without magnet: prefix", () => {
    const result = fileShareRequestSchema.safeParse({
      channelId: "ch_1",
      fileName: "file.txt",
      fileSize: 100,
      contentType: "text/plain",
      magnetUri: "http://example.com",
      infoHash: "abc",
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty fileName", () => {
    const result = fileShareRequestSchema.safeParse({
      channelId: "ch_1",
      fileName: "",
      fileSize: 100,
      contentType: "text/plain",
      magnetUri: "magnet:?xt=urn:btih:abc",
      infoHash: "abc",
    });
    expect(result.success).toBe(false);
  });
});

describe("readyEventSchema", () => {
  const validReady = {
    user: {
      id: "u1",
      username: "testuser",
      displayName: null,
      avatarUrl: null,
      status: "online",
      subscriptionTier: "free",
    },
    servers: [
      { id: "s1", name: "Test Server", iconUrl: null, ownerId: "u1" },
    ],
    dmChannels: [],
    hasMoreDmChannels: false,
    friends: [],
    hasMoreFriends: false,
  };

  it("accepts valid full payload", () => {
    const result = readyEventSchema.safeParse(validReady);
    expect(result.success).toBe(true);
  });

  it("accepts payload without optional dmChannels (uses default)", () => {
    const { dmChannels: _, ...withoutDm } = validReady;
    const result = readyEventSchema.safeParse(withoutDm);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dmChannels).toEqual([]);
    }
  });

  it("accepts payload without optional friends (uses default)", () => {
    const { friends: _, ...withoutFriends } = validReady;
    const result = readyEventSchema.safeParse(withoutFriends);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.friends).toEqual([]);
    }
  });

  it("rejects payload missing user", () => {
    const { user: _, ...withoutUser } = validReady;
    const result = readyEventSchema.safeParse(withoutUser);
    expect(result.success).toBe(false);
  });

  it("rejects payload missing servers", () => {
    const { servers: _, ...withoutServers } = validReady;
    const result = readyEventSchema.safeParse(withoutServers);
    expect(result.success).toBe(false);
  });

  it("rejects payload missing hasMoreDmChannels", () => {
    const { hasMoreDmChannels: _, ...withoutFlag } = validReady;
    const result = readyEventSchema.safeParse(withoutFlag);
    expect(result.success).toBe(false);
  });
});

describe("coerceDate", () => {
  it("accepts ISO string", () => {
    const result = coerceDate.safeParse("2024-01-01T00:00:00.000Z");
    expect(result.success).toBe(true);
  });

  it("accepts Date object and transforms to ISO string", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const result = coerceDate.safeParse(date);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe("2024-01-01T00:00:00.000Z");
    }
  });

  it("rejects non-date values", () => {
    const result = coerceDate.safeParse(12345);
    expect(result.success).toBe(false);
  });
});

describe("coerceDateNullable", () => {
  it("accepts null", () => {
    const result = coerceDateNullable.safeParse(null);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data).toBe(null);
    }
  });

  it("accepts ISO string", () => {
    const result = coerceDateNullable.safeParse("2024-06-15T12:00:00.000Z");
    expect(result.success).toBe(true);
  });
});

describe("webRtcSignalRequestSchema", () => {
  it("accepts SDP string", () => {
    const result = webRtcSignalRequestSchema.safeParse({
      targetUserId: "u2",
      channelId: "ch_1",
      data: "v=0\r\no=- 123 IN IP4 127.0.0.1\r\n",
    });
    expect(result.success).toBe(true);
  });

  it("accepts ICE candidate object", () => {
    const result = webRtcSignalRequestSchema.safeParse({
      targetUserId: "u2",
      channelId: "ch_1",
      data: { candidate: "candidate:1 1 udp 2113937151", sdpMid: "0" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects empty targetUserId", () => {
    const result = webRtcSignalRequestSchema.safeParse({
      targetUserId: "",
      channelId: "ch_1",
      data: "sdp-data",
    });
    expect(result.success).toBe(false);
  });
});
