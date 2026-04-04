import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

describe("overlay-history", () => {
  let pushOverlay: typeof import("./overlay-history.js").pushOverlay;
  let popOverlay: typeof import("./overlay-history.js").popOverlay;

  let pushStateSpy: ReturnType<typeof vi.spyOn>;
  let backSpy: ReturnType<typeof vi.spyOn>;
  const closers: Record<string, ReturnType<typeof vi.fn<() => void>>> = {};

  // Track the popstate handler so we can clean it up between tests
  let popstateHandler: ((e: Event) => void) | null = null;

  beforeEach(async () => {
    vi.resetModules();

    // Intercept addEventListener to capture the popstate handler.
    // Must stay active until after pushOverlay's first call to ensureListening().
    const origAdd = window.addEventListener.bind(window);
    vi.spyOn(window, "addEventListener").mockImplementation(((
      type: string,
      listener: EventListenerOrEventListenerObject,
      options?: boolean | AddEventListenerOptions,
    ) => {
      if (type === "popstate") {
        popstateHandler = listener as (e: Event) => void;
      }
      origAdd(type, listener, options);
    }) as typeof window.addEventListener);

    const mod = await import("./overlay-history.js");
    pushOverlay = mod.pushOverlay;
    popOverlay = mod.popOverlay;

    pushStateSpy = vi.spyOn(history, "pushState").mockImplementation((state) => {
      Object.defineProperty(history, "state", { value: state, writable: true, configurable: true });
    });
    backSpy = vi.spyOn(history, "back").mockImplementation(() => {
      Object.defineProperty(history, "state", { value: null, writable: true, configurable: true });
    });
    vi.spyOn(history, "replaceState").mockImplementation((state) => {
      Object.defineProperty(history, "state", { value: state, writable: true, configurable: true });
    });

    closers.a = vi.fn();
    closers.b = vi.fn();
    closers.c = vi.fn();
  });

  afterEach(() => {
    if (popstateHandler) {
      window.removeEventListener("popstate", popstateHandler);
      popstateHandler = null;
    }
    vi.restoreAllMocks();
  });

  /** Simulate a browser back-button popstate event */
  function firePopstate() {
    // Call the handler directly since dispatchEvent may not work reliably
    // when history.back is mocked
    if (popstateHandler) {
      popstateHandler(new Event("popstate"));
    }
  }

  it("pushes a history entry on first overlay", () => {
    pushOverlay("a", closers.a!);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith({ overlay: true }, "");
  });

  it("does not push additional history entries for subsequent overlays", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);
    expect(pushStateSpy).toHaveBeenCalledTimes(1);
  });

  it("neutralizes overlay entry via replaceState when last overlay closes", () => {
    pushOverlay("a", closers.a!);
    popOverlay("a");
    expect(history.replaceState).toHaveBeenCalledWith(null, "");
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("does not call history.back when non-last overlay is popped", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);
    popOverlay("a");
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("calls replaceState only when the final overlay is popped", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);
    popOverlay("a"); // non-topmost, no cleanup
    expect(history.replaceState).not.toHaveBeenCalled();
    popOverlay("b"); // last one, should neutralize
    expect(history.replaceState).toHaveBeenCalledWith(null, "");
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("ignores popOverlay for unknown ids", () => {
    pushOverlay("a", closers.a!);
    popOverlay("unknown");
    // "a" is still there, so no history.back
    expect(backSpy).not.toHaveBeenCalled();
  });

  it("handles popstate by closing topmost overlay", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);

    firePopstate();

    expect(closers.b).toHaveBeenCalledTimes(1);
    expect(closers.a).not.toHaveBeenCalled();
  });

  it("re-pushes history entry after popstate if overlays remain", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);
    pushStateSpy.mockClear();

    firePopstate();

    expect(pushStateSpy).toHaveBeenCalledTimes(1);
    expect(pushStateSpy).toHaveBeenCalledWith({ overlay: true }, "");
  });

  it("does not re-push after popstate if no overlays remain", () => {
    pushOverlay("a", closers.a!);
    pushStateSpy.mockClear();

    firePopstate();

    expect(pushStateSpy).not.toHaveBeenCalled();
  });

  it("popstate does nothing when stack is empty", () => {
    firePopstate();
    expect(closers.a).not.toHaveBeenCalled();
  });

  it("does not trigger popstate suppression when closing via click/Escape", () => {
    pushOverlay("a", closers.a!);

    // Pop "a" via Escape — uses replaceState, not back()
    popOverlay("a");
    expect(history.replaceState).toHaveBeenCalledWith(null, "");
    expect(backSpy).not.toHaveBeenCalled();

    // A subsequent popstate should NOT be suppressed (no skipPopstateCount)
    // Stack is empty so handler is a no-op anyway
    firePopstate();
    expect(closers.a).not.toHaveBeenCalled();
  });

  it("does not call history.back when popping non-last overlay", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);

    // Pop "b" via Escape — "a" still open, so no history.back needed
    popOverlay("b");
    expect(backSpy).not.toHaveBeenCalled();

    // A subsequent popstate (real back button) should close "a"
    firePopstate();
    expect(closers.a).toHaveBeenCalledTimes(1);
  });

  it("handles three stacked overlays correctly", () => {
    pushOverlay("a", closers.a!);
    pushOverlay("b", closers.b!);
    pushOverlay("c", closers.c!);

    expect(pushStateSpy).toHaveBeenCalledTimes(1);

    // Close middle one via Escape
    popOverlay("b");
    expect(history.replaceState).not.toHaveBeenCalled(); // not last

    // Close top via back button
    firePopstate();
    expect(closers.c).toHaveBeenCalledTimes(1);

    // "a" still open — popstate handler should have re-pushed
    expect(pushStateSpy).toHaveBeenCalledTimes(2);

    // Close "a" via Escape — last one, uses replaceState
    popOverlay("a");
    expect(history.replaceState).toHaveBeenCalledWith(null, "");
    expect(backSpy).not.toHaveBeenCalled();
  });
});
