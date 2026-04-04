/**
 * Shared overlay history manager.
 *
 * Maintains exactly ONE history entry while any overlay is open, zero when none are.
 * Back button closes the topmost overlay. Escape/click close also cleans up correctly.
 */

type CloseCallback = () => void;

interface OverlayEntry {
  id: string;
  close: CloseCallback;
}

const stack: OverlayEntry[] = [];
let listening = false;

/** True while the popstate listener is closing an overlay via user back press. */
let handlingPopstate = false;

/** Count of popstate events to suppress (triggered by our own history.back() cleanup). */
let skipPopstateCount = 0;

const HISTORY_STATE = { overlay: true } as const;

function onPopstate(event: Event): void {
  if (skipPopstateCount > 0) {
    skipPopstateCount--;
    return;
  }
  if (stack.length === 0) return;

  // Prevent SolidJS router from also handling this popstate
  event.stopImmediatePropagation();

  const entry = stack.pop()!;
  handlingPopstate = true;
  entry.close();
  handlingPopstate = false;

  // If overlays remain, re-push the single history guard entry
  if (stack.length > 0) {
    history.pushState(HISTORY_STATE, "");
  }
}

function ensureListening(): void {
  if (listening) return;
  window.addEventListener("popstate", onPopstate);
  listening = true;
}

/** Register an overlay. Pushes a history entry only for the first overlay. */
export function pushOverlay(id: string, close: CloseCallback): void {
  ensureListening();
  const wasEmpty = stack.length === 0;
  stack.push({ id, close });
  if (wasEmpty) {
    history.pushState(HISTORY_STATE, "");
  }
}

/** Unregister an overlay. Cleans up the history entry when the last overlay closes. */
export function popOverlay(id: string): void {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);

  if (handlingPopstate) return;

  // When the last overlay closes via Escape/click, clean up the single history entry.
  // Only call history.back() if our overlay state is still on top — a navigate() may
  // have already pushed a new route entry, in which case back() would undo that navigation.
  const state = history.state as { overlay?: boolean } | null;
  if (stack.length === 0 && state?.overlay) {
    skipPopstateCount++;
    history.back();
  }
}
