import { Opcode, presenceUpdateEventSchema } from "@uncorded/protocol";
import type { UserId } from "@uncorded/protocol";
import { IDLE_TIMEOUT_MS } from "@uncorded/shared";
import { onGatewayEvent, sendFrame } from "../lib/gateway.js";
import { updatePresence } from "../lib/gateway-store.js";

// ── Client-side activity tracking ───────────────────────────────────────────

let lastActivity = Date.now();
let isClientIdle = false;
let activityCheckTimer: ReturnType<typeof setInterval> | null = null;

const ACTIVITY_THROTTLE_MS = 60_000; // Only process activity events every 60s
let lastActivityEvent = 0;

function onActivity() {
  const now = Date.now();
  lastActivity = now;

  // Throttle: only send presence update if enough time has passed
  if (now - lastActivityEvent < ACTIVITY_THROTTLE_MS) return;
  lastActivityEvent = now;

  if (isClientIdle) {
    isClientIdle = false;
    sendFrame({ op: Opcode.PRESENCE_UPDATE, d: { status: "online" } });
  }
}

function startActivityTracking() {
  if (typeof window === "undefined") return;
  const events = ["mousemove", "keydown", "click", "focus"] as const;
  for (const event of events) {
    window.addEventListener(event, onActivity, { passive: true });
  }

  // Check for idle every 30s
  activityCheckTimer = setInterval(() => {
    if (isClientIdle) return;
    if (Date.now() - lastActivity >= IDLE_TIMEOUT_MS) {
      isClientIdle = true;
      sendFrame({ op: Opcode.PRESENCE_UPDATE, d: { status: "idle" } });
    }
  }, 30_000);
}

function stopActivityTracking() {
  if (typeof window === "undefined") return;
  const events = ["mousemove", "keydown", "click", "focus"] as const;
  for (const event of events) {
    window.removeEventListener(event, onActivity);
  }
  if (activityCheckTimer) {
    clearInterval(activityCheckTimer);
    activityCheckTimer = null;
  }
}

// ── WS listener ─────────────────────────────────────────────────────────────

let unsub: (() => void) | null = null;

function teardown() {
  unsub?.();
  unsub = null;
  stopActivityTracking();
}

export function setupPresenceStore(): void {
  teardown();

  unsub = onGatewayEvent(Opcode.PRESENCE_UPDATE, (data) => {
    const parsed = presenceUpdateEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    updatePresence(d.userId as UserId, d.status);
  });

  // Reset activity state
  lastActivity = Date.now();
  isClientIdle = false;
  lastActivityEvent = 0;
  startActivityTracking();
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
