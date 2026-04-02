import { createEffect, onCleanup } from "solid-js";

interface SwipeGestureOptions {
  /** Reactive accessor — element to listen on. May appear/disappear (e.g. Sheet content). */
  target: () => HTMLElement | undefined;
  /** Swipe direction that triggers the callback. */
  direction: "left" | "right";
  /** Min horizontal distance in px to commit the swipe (default 50). */
  threshold?: number;
  /** Max start-x from edge in px, or null for anywhere (default null). */
  edgeZone?: number | null;
  /** Which viewport edge the edgeZone is measured from (default "left"). */
  edgeFrom?: "left" | "right";
  /** Reactive gate — listeners only attach when true. */
  enabled: () => boolean;
  /** Called when a qualifying swipe completes. */
  onSwipe: () => void;
}

/**
 * Reactive swipe gesture primitive.
 * Attaches/detaches touch listeners when `enabled()` and `target()` change.
 */
export function createSwipeGesture(options: SwipeGestureOptions): void {
  const threshold = options.threshold ?? 50;
  const edgeZone = options.edgeZone ?? null;
  const edgeFrom = options.edgeFrom ?? "left";

  createEffect(() => {
    const el = options.target();
    const active = options.enabled();
    if (!el || !active) return;

    let startX = 0;
    let startY = 0;
    let aborted = false;

    const onTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (!touch) return;
      startX = touch.clientX;
      startY = touch.clientY;
      aborted = false;

      if (edgeZone !== null) {
        const x = touch.clientX;
        if (edgeFrom === "left" && x > edgeZone) {
          aborted = true;
        } else if (edgeFrom === "right" && x < window.innerWidth - edgeZone) {
          aborted = true;
        }
      }
    };

    const onTouchMove = (e: TouchEvent) => {
      if (aborted) return;
      const touch = e.touches[0];
      if (!touch) return;
      const deltaX = Math.abs(touch.clientX - startX);
      const deltaY = Math.abs(touch.clientY - startY);
      if (deltaY > deltaX) {
        aborted = true;
      }
    };

    const onTouchEnd = (e: TouchEvent) => {
      if (aborted) return;
      const touch = e.changedTouches[0];
      if (!touch) return;
      const deltaX = touch.clientX - startX;

      if (options.direction === "right" && deltaX >= threshold) {
        options.onSwipe();
      } else if (options.direction === "left" && deltaX <= -threshold) {
        options.onSwipe();
      }
    };

    const opts: AddEventListenerOptions = { passive: true };
    el.addEventListener("touchstart", onTouchStart, opts);
    el.addEventListener("touchmove", onTouchMove, opts);
    el.addEventListener("touchend", onTouchEnd, opts);

    onCleanup(() => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
    });
  });
}
