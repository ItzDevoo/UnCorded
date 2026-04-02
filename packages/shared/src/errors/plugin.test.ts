import { describe, it, expect } from "vitest";
import { PluginError } from "./plugin.js";
import type { PluginErrorPayload } from "./plugin.js";

describe("PluginError", () => {
  it("constructs with all fields", () => {
    const err = new PluginError("TEST_CODE", "test message", "network", true, {
      pluginId: "my-plugin",
      causeCode: "ORIGINAL",
    });

    expect(err.code).toBe("TEST_CODE");
    expect(err.message).toBe("test message");
    expect(err.category).toBe("network");
    expect(err.retryable).toBe(true);
    expect(err.pluginId).toBe("my-plugin");
    expect(err.causeCode).toBe("ORIGINAL");
    expect(err._tag).toBe("PluginError");
    expect(err.statusCode).toBe(502); // network → 502
  });

  it("constructs without optional fields", () => {
    const err = new PluginError("CODE", "msg", "internal", false);
    expect(err.pluginId).toBeUndefined();
    expect(err.causeCode).toBeUndefined();
    expect(err.statusCode).toBe(500); // internal → 500
  });

  it("maps category to correct status code", () => {
    const cases: [string, number][] = [
      ["configuration", 500],
      ["permission", 403],
      ["validation", 400],
      ["network", 502],
      ["resource", 503],
      ["lifecycle", 500],
      ["internal", 500],
    ];

    for (const [category, expected] of cases) {
      const err = new PluginError("X", "x", category as PluginErrorPayload["category"], false);
      expect(err.statusCode).toBe(expected);
    }
  });

  it("extends Error", () => {
    const err = new PluginError("X", "msg", "internal", false);
    expect(err).toBeInstanceOf(Error);
  });
});

describe("PluginError.toPayload()", () => {
  it("serializes all fields", () => {
    const err = new PluginError("CODE", "msg", "permission", false, {
      pluginId: "p1",
      causeCode: "ORIG",
    });

    const payload = err.toPayload();
    expect(payload).toEqual({
      code: "CODE",
      message: "msg",
      category: "permission",
      retryable: false,
      pluginId: "p1",
      causeCode: "ORIG",
    });
  });

  it("omits undefined optional fields", () => {
    const err = new PluginError("CODE", "msg", "internal", true);
    const payload = err.toPayload();

    expect(payload).toEqual({
      code: "CODE",
      message: "msg",
      category: "internal",
      retryable: true,
    });
    expect("pluginId" in payload).toBe(false);
    expect("causeCode" in payload).toBe(false);
  });
});

describe("PluginError.fromPayload()", () => {
  it("round-trips with all fields", () => {
    const original = new PluginError("RC", "round trip", "lifecycle", true, {
      pluginId: "test",
      causeCode: "CAUSE",
    });

    const payload = original.toPayload();
    const reconstructed = PluginError.fromPayload(payload);

    expect(reconstructed.code).toBe(original.code);
    expect(reconstructed.message).toBe(original.message);
    expect(reconstructed.category).toBe(original.category);
    expect(reconstructed.retryable).toBe(original.retryable);
    expect(reconstructed.pluginId).toBe(original.pluginId);
    expect(reconstructed.causeCode).toBe(original.causeCode);
  });

  it("round-trips without optional fields", () => {
    const original = new PluginError("X", "y", "validation", false);
    const reconstructed = PluginError.fromPayload(original.toPayload());

    expect(reconstructed.pluginId).toBeUndefined();
    expect(reconstructed.causeCode).toBeUndefined();
  });
});

describe("PluginError.isPayload()", () => {
  it("returns true for valid payload", () => {
    const payload: PluginErrorPayload = {
      code: "X",
      message: "y",
      category: "internal",
      retryable: false,
    };
    expect(PluginError.isPayload(payload)).toBe(true);
  });

  it("returns true for payload with optional fields", () => {
    expect(
      PluginError.isPayload({
        code: "X",
        message: "y",
        category: "network",
        retryable: true,
        pluginId: "p",
        causeCode: "c",
      }),
    ).toBe(true);
  });

  it("returns false for plain error object", () => {
    expect(PluginError.isPayload({ code: "X", message: "y" })).toBe(false);
  });

  it("returns false for null", () => {
    expect(PluginError.isPayload(null)).toBe(false);
  });

  it("returns false for non-object", () => {
    expect(PluginError.isPayload("string")).toBe(false);
    expect(PluginError.isPayload(42)).toBe(false);
  });

  it("returns false for missing required fields", () => {
    expect(PluginError.isPayload({ code: "X", category: "internal", retryable: false })).toBe(
      false,
    );
    expect(PluginError.isPayload({ code: "X", message: "y", retryable: false })).toBe(false);
    expect(PluginError.isPayload({ code: "X", message: "y", category: "internal" })).toBe(false);
  });

  it("returns false for invalid category value", () => {
    expect(
      PluginError.isPayload({
        code: "X",
        message: "y",
        category: "bogus",
        retryable: false,
      }),
    ).toBe(false);
  });
});
