import { describe, it, expect } from "vitest";
import { classifyBridgeError } from "./plugin-errors.js";

describe("classifyBridgeError", () => {
  const PLUGIN_ID = "test-plugin";

  it("classifies BAD_REQUEST as validation", () => {
    const payload = classifyBridgeError(
      { code: "BAD_REQUEST", message: "channelId required" },
      PLUGIN_ID,
    );
    expect(payload.category).toBe("validation");
    expect(payload.retryable).toBe(false);
    expect(payload.code).toBe("BAD_REQUEST");
    expect(payload.pluginId).toBe(PLUGIN_ID);
  });

  it("classifies FORBIDDEN as permission", () => {
    const payload = classifyBridgeError(
      { code: "FORBIDDEN", message: "Missing permission: messages.send" },
      PLUGIN_ID,
    );
    expect(payload.category).toBe("permission");
    expect(payload.retryable).toBe(false);
  });

  it("classifies UNKNOWN_METHOD as validation", () => {
    const payload = classifyBridgeError(
      { code: "UNKNOWN_METHOD", message: "Unknown method: foo" },
      PLUGIN_ID,
    );
    expect(payload.category).toBe("validation");
    expect(payload.retryable).toBe(false);
  });

  it("classifies RATE_LIMITED as network + retryable", () => {
    const payload = classifyBridgeError(
      { code: "RATE_LIMITED", message: "Too many requests" },
      PLUGIN_ID,
    );
    expect(payload.category).toBe("network");
    expect(payload.retryable).toBe(true);
  });

  it("classifies unknown code as internal", () => {
    const payload = classifyBridgeError(
      { code: "SOMETHING_NEW", message: "Unknown error" },
      PLUGIN_ID,
    );
    expect(payload.category).toBe("internal");
    expect(payload.retryable).toBe(false);
  });

  it("handles missing code/message", () => {
    const payload = classifyBridgeError({}, PLUGIN_ID);
    expect(payload.code).toBe("INTERNAL_ERROR");
    expect(payload.message).toBe("An unexpected error occurred");
    expect(payload.category).toBe("internal");
  });

  it("handles string throws", () => {
    const payload = classifyBridgeError("something broke", PLUGIN_ID);
    expect(payload.code).toBe("INTERNAL_ERROR");
    expect(payload.message).toBe("something broke");
    expect(payload.category).toBe("internal");
  });

  it("handles null", () => {
    const payload = classifyBridgeError(null, PLUGIN_ID);
    expect(payload.category).toBe("internal");
  });

  it("passes through existing PluginErrorPayload", () => {
    const existing = {
      code: "NETWORK_ERROR",
      message: "Timed out",
      category: "network" as const,
      retryable: true,
      pluginId: "other-plugin",
    };
    const payload = classifyBridgeError(existing, PLUGIN_ID);
    expect(payload.category).toBe("network");
    expect(payload.retryable).toBe(true);
    expect(payload.pluginId).toBe(PLUGIN_ID); // overwritten with current plugin
  });
});
