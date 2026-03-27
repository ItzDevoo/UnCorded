import { createSignal } from "solid-js";

export type MessageDensity = "cozy" | "compact";

function readLocal<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const val = localStorage.getItem(key);
    return val && (allowed as readonly string[]).includes(val) ? (val as T) : fallback;
  } catch {
    return fallback;
  }
}

const DENSITIES: readonly MessageDensity[] = ["cozy", "compact"];

const [messageDensity, setDensitySignal] = createSignal<MessageDensity>(
  readLocal("uncorded-density", "cozy", DENSITIES),
);

export function setMessageDensity(d: MessageDensity) {
  setDensitySignal(d);
  try {
    localStorage.setItem("uncorded-density", d);
  } catch {
    // Quota exceeded or private browsing — signal already updated
  }
}

// Dark-only — no theme switching. Ensure dark class is present on init.
document.documentElement.classList.add("dark");
document.documentElement.style.colorScheme = "dark";

export { messageDensity };
