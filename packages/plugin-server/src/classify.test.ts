import { describe, it, expect } from "vitest";
import { classifyServerError } from "./classify.js";
import {
  BridgeConfigError,
  BridgeHttpError,
  BridgeNetworkError,
  BridgeNotFoundError,
} from "./errors.js";
import { PluginError } from "@uncorded/shared";

describe("classifyServerError", () => {
  const PLUGIN_ID = "test-plugin";

  it("classifies BridgeConfigError as configuration", () => {
    const err = new BridgeConfigError("Missing UNCORDED_BRIDGE_URL");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("configuration");
    expect(payload.retryable).toBe(false);
    expect(payload.pluginId).toBe(PLUGIN_ID);
  });

  it("classifies BridgeNetworkError as network + retryable", () => {
    const err = new BridgeNetworkError("Request timed out after 30000ms");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("network");
    expect(payload.retryable).toBe(true);
  });

  it("classifies BridgeNotFoundError as validation", () => {
    const err = new BridgeNotFoundError("/bridge/storage/missing-key");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("validation");
    expect(payload.retryable).toBe(false);
  });

  it("classifies BridgeHttpError 403 as permission", () => {
    const err = new BridgeHttpError("GET", "/bridge/members", 403, "Forbidden");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("permission");
    expect(payload.retryable).toBe(false);
    expect(payload.causeCode).toBe("BRIDGE_HTTP_ERROR");
  });

  it("classifies BridgeHttpError 429 as network + retryable", () => {
    const err = new BridgeHttpError("POST", "/bridge/messages", 429, "Too many requests");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("network");
    expect(payload.retryable).toBe(true);
    expect(payload.causeCode).toBe("BRIDGE_HTTP_ERROR");
  });

  it("classifies BridgeHttpError 500 as internal + retryable", () => {
    const err = new BridgeHttpError("GET", "/bridge/server", 500, "Internal error");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("internal");
    expect(payload.retryable).toBe(true);
  });

  it("classifies BridgeHttpError 400 as validation", () => {
    const err = new BridgeHttpError("POST", "/bridge/notify", 400, "Bad request");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("validation");
    expect(payload.retryable).toBe(false);
  });

  it("passes through existing PluginError", () => {
    const err = new PluginError("CUSTOM", "custom msg", "resource", false, {
      pluginId: "original",
    });
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("resource");
    expect(payload.pluginId).toBe(PLUGIN_ID);
  });

  it("classifies plain Error as internal", () => {
    const err = new Error("something unexpected");
    const payload = classifyServerError(err, PLUGIN_ID);
    expect(payload.category).toBe("internal");
    expect(payload.retryable).toBe(false);
    expect(payload.message).toBe("something unexpected");
  });

  it("classifies non-Error as internal", () => {
    const payload = classifyServerError("string error", PLUGIN_ID);
    expect(payload.category).toBe("internal");
    expect(payload.code).toBe("INTERNAL_ERROR");
  });

  it("works without pluginId", () => {
    const err = new BridgeNetworkError("timeout");
    const payload = classifyServerError(err);
    expect(payload.category).toBe("network");
    expect(payload.pluginId).toBeUndefined();
  });
});
