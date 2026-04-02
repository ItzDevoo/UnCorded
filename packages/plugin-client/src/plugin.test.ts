// @vitest-environment happy-dom
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { UnCordedPlugin } from "./plugin.js";
import { BridgeError, PluginDestroyedError, RequestTimeoutError } from "./errors.js";
import { PluginError } from "@uncorded/shared";

const SHELL_ORIGIN = "http://localhost:3000";

/** Send a fake postMessage response from the "shell". */
function sendResponse(id: string, result?: unknown, error?: Record<string, unknown>): void {
  const data: Record<string, unknown> = { type: "uncorded:response", id };
  if (error) data.error = error;
  else data.result = result;

  window.dispatchEvent(
    new MessageEvent("message", {
      data,
      origin: SHELL_ORIGIN,
      source: window.parent,
    }),
  );
}

/** Send a fake postMessage event from the "shell". */
function sendEvent(event: string, eventData: unknown): void {
  window.dispatchEvent(
    new MessageEvent("message", {
      data: { type: "uncorded:event", event, data: eventData },
      origin: SHELL_ORIGIN,
      source: window.parent,
    }),
  );
}

/** Capture the next postMessage call and return its data. */
function capturePostMessage(): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const original = window.parent.postMessage.bind(window.parent);
    vi.spyOn(window.parent, "postMessage").mockImplementationOnce((data: unknown) => {
      resolve(data as Record<string, unknown>);
      // Restore for subsequent calls
      return original(data, "*");
    });
  });
}

describe("UnCordedPlugin", () => {
  let plugin: UnCordedPlugin;

  beforeEach(() => {
    plugin = new UnCordedPlugin({ shellOrigin: SHELL_ORIGIN });
  });

  afterEach(() => {
    plugin.destroy();
    vi.restoreAllMocks();
  });

  // ── Construction ──────────────────────────────────────

  it("constructs with explicit shellOrigin", () => {
    expect(plugin).toBeInstanceOf(UnCordedPlugin);
  });

  it("throws when shellOrigin cannot be derived", () => {
    // document.referrer is empty in test env, no shellOrigin provided
    expect(() => new UnCordedPlugin()).toThrow("Unable to determine shell origin");
  });

  // ── Request / Response ────────────────────────────────

  it("resolves request on successful response", async () => {
    const capture = capturePostMessage();
    const promise = plugin.getUser();

    const msg = await capture;
    sendResponse(msg.id as string, { id: "u1", username: "test" });

    const result = await promise;
    expect(result).toEqual({ id: "u1", username: "test" });
  });

  it("rejects with BridgeError for plain error response", async () => {
    const capture = capturePostMessage();
    const promise = plugin.getUser();

    const msg = await capture;
    sendResponse(msg.id as string, undefined, {
      code: "BAD_REQUEST",
      message: "Something wrong",
    });

    await expect(promise).rejects.toThrow(BridgeError);
    await expect(promise).rejects.toMatchObject({
      code: "BAD_REQUEST",
      message: "Something wrong",
    });
  });

  it("rejects with PluginError for structured error response", async () => {
    const capture = capturePostMessage();
    const promise = plugin.getUser();

    const msg = await capture;
    sendResponse(msg.id as string, undefined, {
      code: "FORBIDDEN",
      message: "Missing permission: members.read",
      category: "permission",
      retryable: false,
      pluginId: "test-plugin",
    });

    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PluginError);
    expect((err as PluginError).category).toBe("permission");
    expect((err as PluginError).retryable).toBe(false);
  });

  it("rejects with BridgeError when category is invalid (not a PluginErrorPayload)", async () => {
    const capture = capturePostMessage();
    const promise = plugin.getUser();

    const msg = await capture;
    sendResponse(msg.id as string, undefined, {
      code: "WEIRD",
      message: "bad category",
      category: "bogus",
      retryable: false,
    });

    // isPayload rejects "bogus" category, falls through to BridgeError
    const err = await promise.catch((e: unknown) => e);
    expect(err).toBeInstanceOf(BridgeError);
    expect(err).not.toBeInstanceOf(PluginError);
  });

  // ── Timeout ───────────────────────────────────────────

  it("rejects with RequestTimeoutError after timeout", async () => {
    const shortPlugin = new UnCordedPlugin({ shellOrigin: SHELL_ORIGIN, timeoutMs: 50 });

    await expect(shortPlugin.getUser()).rejects.toThrow(RequestTimeoutError);

    shortPlugin.destroy();
  });

  // ── Destroy ───────────────────────────────────────────

  it("rejects pending requests on destroy", async () => {
    const promise = plugin.getUser();
    plugin.destroy();

    await expect(promise).rejects.toThrow(PluginDestroyedError);
  });

  it("destroy is idempotent", () => {
    plugin.destroy();
    expect(() => plugin.destroy()).not.toThrow();
  });

  // ── Events ────────────────────────────────────────────

  it("dispatches events to subscribed handlers", () => {
    const handler = vi.fn();
    plugin.on("message:created", handler);

    sendEvent("message:created", { content: "hello" });

    expect(handler).toHaveBeenCalledWith({ content: "hello" });
  });

  it("does not dispatch events after off()", () => {
    const handler = vi.fn();
    plugin.on("message:created", handler);
    plugin.off("message:created", handler);

    sendEvent("message:created", { content: "hello" });

    expect(handler).not.toHaveBeenCalled();
  });

  it("deduplicates same handler registered twice", () => {
    const handler = vi.fn();
    plugin.on("test", handler);
    plugin.on("test", handler);

    sendEvent("test", {});

    expect(handler).toHaveBeenCalledTimes(1);
  });

  // ── Event handler error boundary ──────────────────────

  it("catches exceptions in event handlers without breaking other handlers", () => {
    const errSpy = vi.spyOn(console, "error").mockImplementation(() => {});
    const badHandler = () => { throw new Error("handler crash"); };
    const goodHandler = vi.fn();

    plugin.on("test", badHandler);
    plugin.on("test", goodHandler);

    sendEvent("test", { data: 1 });

    // Good handler still called despite bad handler throwing
    expect(goodHandler).toHaveBeenCalledWith({ data: 1 });
    expect(errSpy).toHaveBeenCalled();

    errSpy.mockRestore();
  });

  it("event handler error is forwarded to onError handlers", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const errorHandler = vi.fn();
    plugin.onError(errorHandler);

    const thrownError = new Error("handler crash");
    plugin.on("test", () => { throw thrownError; });

    sendEvent("test", {});

    expect(errorHandler).toHaveBeenCalledWith(thrownError);
  });

  // ── onError multi-handler ─────────────────────────────

  it("supports multiple onError handlers", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    plugin.onError(handler1);
    plugin.onError(handler2);

    plugin.on("test", () => { throw new Error("boom"); });
    sendEvent("test", {});

    expect(handler1).toHaveBeenCalledTimes(1);
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("onError cleanup removes only that handler", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const handler1 = vi.fn();
    const handler2 = vi.fn();

    const cleanup1 = plugin.onError(handler1);
    plugin.onError(handler2);

    cleanup1(); // Remove handler1

    plugin.on("test", () => { throw new Error("boom"); });
    sendEvent("test", {});

    expect(handler1).not.toHaveBeenCalled();
    expect(handler2).toHaveBeenCalledTimes(1);
  });

  it("onError wraps non-Error throws", () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    const errorHandler = vi.fn();
    plugin.onError(errorHandler);

    plugin.on("test", () => { throw "string error"; }); // eslint-disable-line no-throw-literal
    sendEvent("test", {});

    expect(errorHandler).toHaveBeenCalledWith(expect.any(Error));
    expect(errorHandler.mock.calls[0]![0]!.message).toBe("string error");
  });

  // ── Origin validation ─────────────────────────────────

  it("ignores messages from wrong origin", () => {
    const handler = vi.fn();
    plugin.on("test", handler);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "uncorded:event", event: "test", data: {} },
        origin: "http://evil.com",
        source: window.parent,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });

  it("ignores messages with null source", () => {
    const handler = vi.fn();
    plugin.on("test", handler);

    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "uncorded:event", event: "test", data: {} },
        origin: SHELL_ORIGIN,
        source: null,
      }),
    );

    expect(handler).not.toHaveBeenCalled();
  });
});
