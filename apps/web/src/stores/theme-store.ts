import { createSignal } from "solid-js";

export type Theme = "dark" | "light";
export type MessageDensity = "cozy" | "compact";

function readLocal<T extends string>(key: string, fallback: T, allowed: readonly T[]): T {
  try {
    const val = localStorage.getItem(key);
    return val && (allowed as readonly string[]).includes(val) ? (val as T) : fallback;
  } catch {
    return fallback;
  }
}

const THEMES: readonly Theme[] = ["dark", "light"];
const DENSITIES: readonly MessageDensity[] = ["cozy", "compact"];

const [theme, setThemeSignal] = createSignal<Theme>(readLocal("uncorded-theme", "dark", THEMES));
const [messageDensity, setDensitySignal] = createSignal<MessageDensity>(
  readLocal("uncorded-density", "cozy", DENSITIES),
);

function applyTheme(t: Theme) {
  const html = document.documentElement;
  html.classList.add("no-transitions");
  html.classList.remove("dark", "light");
  html.classList.add(t);
  html.style.colorScheme = t;
  // Force reflow then remove no-transitions
  void html.offsetHeight;
  html.classList.remove("no-transitions");
}

export function setTheme(t: Theme) {
  setThemeSignal(t);
  applyTheme(t);
  try {
    localStorage.setItem("uncorded-theme", t);
  } catch {
    // Quota exceeded or private browsing — signal + UI already updated
  }
}

export function setMessageDensity(d: MessageDensity) {
  setDensitySignal(d);
  try {
    localStorage.setItem("uncorded-density", d);
  } catch {
    // Quota exceeded or private browsing — signal already updated
  }
}

// Initialize theme on module load
applyTheme(theme());

export { theme, messageDensity };
