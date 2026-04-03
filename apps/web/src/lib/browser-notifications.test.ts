import { describe, it, expect, vi, beforeEach } from "vitest";

describe("browser-notifications", () => {
  let initBrowserNotifications: typeof import("./browser-notifications.js").initBrowserNotifications;
  let requestPermission: typeof import("./browser-notifications.js").requestPermission;
  let showBrowserNotification: typeof import("./browser-notifications.js").showBrowserNotification;

  beforeEach(async () => {
    vi.resetModules();
    const mod = await import("./browser-notifications.js");
    initBrowserNotifications = mod.initBrowserNotifications;
    requestPermission = mod.requestPermission;
    showBrowserNotification = mod.showBrowserNotification;
  });

  describe("initBrowserNotifications", () => {
    it("reads Notification.permission on init", async () => {
      const mockRequest = vi.fn();
      Object.defineProperty(window, "Notification", {
        value: { permission: "granted", requestPermission: mockRequest },
        writable: true,
        configurable: true,
      });
      initBrowserNotifications();
      // After init with "granted", requestPermission should resolve true
      // without calling the browser's requestPermission
      const result = await requestPermission();
      expect(result).toBe(true);
      expect(mockRequest).not.toHaveBeenCalled();
    });

    it("handles missing Notification API gracefully", () => {
      const orig = (window as unknown as Record<string, unknown>).Notification;
      delete (window as unknown as Record<string, unknown>).Notification;
      expect(() => initBrowserNotifications()).not.toThrow();
      (window as unknown as Record<string, unknown>).Notification = orig;
    });
  });

  describe("requestPermission", () => {
    it("returns false when Notification API is missing", async () => {
      const orig = (window as unknown as Record<string, unknown>).Notification;
      delete (window as unknown as Record<string, unknown>).Notification;
      const result = await requestPermission();
      expect(result).toBe(false);
      (window as unknown as Record<string, unknown>).Notification = orig;
    });

    it("returns true immediately when already granted", async () => {
      Object.defineProperty(window, "Notification", {
        value: { permission: "granted", requestPermission: vi.fn() },
        writable: true,
        configurable: true,
      });
      initBrowserNotifications();
      const result = await requestPermission();
      expect(result).toBe(true);
    });

    it("returns false immediately when denied", async () => {
      Object.defineProperty(window, "Notification", {
        value: { permission: "denied", requestPermission: vi.fn() },
        writable: true,
        configurable: true,
      });
      initBrowserNotifications();
      const result = await requestPermission();
      expect(result).toBe(false);
    });

    it("requests permission when state is default", async () => {
      const mockRequest = vi.fn().mockResolvedValue("granted");
      Object.defineProperty(window, "Notification", {
        value: { permission: "default", requestPermission: mockRequest },
        writable: true,
        configurable: true,
      });
      initBrowserNotifications();
      const result = await requestPermission();
      expect(mockRequest).toHaveBeenCalledTimes(1);
      expect(result).toBe(true);
    });

    it("returns false when user denies permission prompt", async () => {
      const mockRequest = vi.fn().mockResolvedValue("denied");
      Object.defineProperty(window, "Notification", {
        value: { permission: "default", requestPermission: mockRequest },
        writable: true,
        configurable: true,
      });
      initBrowserNotifications();
      const result = await requestPermission();
      expect(result).toBe(false);
    });
  });

  describe("showBrowserNotification", () => {
    it("does not create notification when permission is not granted", () => {
      const MockNotification = vi.fn();
      Object.defineProperty(window, "Notification", {
        value: Object.assign(MockNotification, {
          permission: "default",
          requestPermission: vi.fn(),
        }),
        writable: true,
        configurable: true,
      });
      initBrowserNotifications();
      showBrowserNotification("Test", "Body");
      expect(MockNotification).not.toHaveBeenCalled();
    });

    it("does not create notification when document has focus", () => {
      const calls: unknown[][] = [];
      const MockNotification = vi.fn().mockImplementation(function (
        this: unknown,
        ...args: unknown[]
      ) {
        calls.push(args);
        return { addEventListener: vi.fn() };
      });
      Object.defineProperty(window, "Notification", {
        value: Object.assign(MockNotification, {
          permission: "granted",
          requestPermission: vi.fn(),
        }),
        writable: true,
        configurable: true,
      });
      vi.spyOn(document, "hasFocus").mockReturnValue(true);
      initBrowserNotifications();
      showBrowserNotification("Test", "Body");
      expect(calls).toHaveLength(0);
    });

    it("creates notification when granted and not focused", () => {
      const calls: unknown[][] = [];
      const MockNotification = vi.fn().mockImplementation(function (
        this: unknown,
        ...args: unknown[]
      ) {
        calls.push(args);
        return { addEventListener: vi.fn() };
      });
      Object.defineProperty(window, "Notification", {
        value: Object.assign(MockNotification, {
          permission: "granted",
          requestPermission: vi.fn(),
        }),
        writable: true,
        configurable: true,
      });
      vi.spyOn(document, "hasFocus").mockReturnValue(false);
      initBrowserNotifications();
      showBrowserNotification("Test Title", "Test Body");
      expect(calls).toHaveLength(1);
      expect(calls[0]).toEqual([
        "Test Title",
        {
          body: "Test Body",
          icon: "/icon-192.png",
          tag: "uncorded-message",
        },
      ]);
    });
  });
});
