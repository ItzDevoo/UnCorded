/**
 * Shared overlay history manager.
 * Pushes history entries when overlays open so the Android back button
 * (and browser back) closes overlays instead of navigating away.
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

function onPopstate(): void {
  if (skipPopstateCount > 0) {
    skipPopstateCount--;
    return;
  }
  if (stack.length === 0) return;

  const entry = stack.pop()!;
  handlingPopstate = true;
  entry.close();
  handlingPopstate = false;
}

function ensureListening(): void {
  if (listening) return;
  window.addEventListener("popstate", onPopstate);
  listening = true;
}

/** Register an overlay. Pushes a history entry so back-button closes it. */
export function pushOverlay(id: string, close: CloseCallback): void {
  ensureListening();
  stack.push({ id, close });
  history.pushState({ overlayId: id }, "");
}

/** Unregister an overlay. Cleans up the matching history entry if needed. */
export function popOverlay(id: string): void {
  const idx = stack.findIndex((e) => e.id === id);
  if (idx === -1) return;
  stack.splice(idx, 1);

  if (handlingPopstate) return;

  // Overlay closed via Escape/click — clean up the dead history entry
  skipPopstateCount++;
  history.back();
}
