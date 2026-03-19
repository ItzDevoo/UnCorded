import { createSignal } from "solid-js";

/**
 * The beforeinstallprompt event is not in standard TS lib.
 * Only fires in Chromium-based browsers (Chrome, Edge, Opera).
 */
interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
  prompt(): Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const [deferredPrompt, setDeferredPrompt] = createSignal<BeforeInstallPromptEvent | null>(null);

export const canInstall = () => deferredPrompt() !== null;

export async function installApp(): Promise<void> {
  const prompt = deferredPrompt();
  if (!prompt) return;

  try {
    await prompt.prompt();
    await prompt.userChoice;
  } finally {
    setDeferredPrompt(null);
  }
}

function isBeforeInstallPromptEvent(e: Event): e is BeforeInstallPromptEvent {
  return "prompt" in e && typeof (e as BeforeInstallPromptEvent).prompt === "function" && "userChoice" in e;
}

function onBeforeInstallPrompt(e: Event): void {
  e.preventDefault();
  if (isBeforeInstallPromptEvent(e)) {
    setDeferredPrompt(e);
  }
}

function onAppInstalled(): void {
  setDeferredPrompt(null);
}

let pwaStoreInitialized = false;

export function setupPwaStore(): void {
  if (pwaStoreInitialized) return;
  pwaStoreInitialized = true;

  window.addEventListener("beforeinstallprompt", onBeforeInstallPrompt);
  window.addEventListener("appinstalled", onAppInstalled);

  if (import.meta.hot) {
    import.meta.hot.dispose(() => {
      window.removeEventListener("beforeinstallprompt", onBeforeInstallPrompt);
      window.removeEventListener("appinstalled", onAppInstalled);
      setDeferredPrompt(null);
    });
  }
}
