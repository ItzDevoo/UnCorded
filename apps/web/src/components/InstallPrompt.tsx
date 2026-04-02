import { createSignal, Show } from "solid-js";
import { canInstall, installApp } from "../stores/pwa-store.js";

function isIos(): boolean {
  const ua = navigator.userAgent;
  return /iPhone|iPad|iPod/.test(ua) && !("standalone" in navigator && (navigator as Navigator & { standalone?: boolean }).standalone);
}

const InstallPrompt = () => {
  const [dismissed, setDismissed] = createSignal(false);

  const showIosPrompt = () => isIos() && !dismissed();
  const showChromiumPrompt = () => canInstall() && !dismissed();

  return (
    <>
      {/* Chromium install banner */}
      <Show when={showChromiumPrompt()}>
        <div class="flex items-center justify-between gap-3 bg-primary/10 px-4 py-2.5 text-sm text-primary">
          <div class="flex items-center gap-2">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-4 w-4 shrink-0"
            >
              <path d="M10.75 2.75a.75.75 0 0 0-1.5 0v8.614L6.295 8.235a.75.75 0 1 0-1.09 1.03l4.25 4.5a.75.75 0 0 0 1.09 0l4.25-4.5a.75.75 0 0 0-1.09-1.03l-2.955 3.129V2.75Z" />
              <path d="M3.5 12.75a.75.75 0 0 0-1.5 0v2.5A2.75 2.75 0 0 0 4.75 18h10.5A2.75 2.75 0 0 0 18 15.25v-2.5a.75.75 0 0 0-1.5 0v2.5c0 .69-.56 1.25-1.25 1.25H4.75c-.69 0-1.25-.56-1.25-1.25v-2.5Z" />
            </svg>
            <span>Install UnCorded for a faster experience</span>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              class="rounded-md bg-primary px-3 py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90"
              onClick={() => void installApp()}
            >
              Install
            </button>
            <button
              type="button"
              class="text-primary/60 hover:text-primary"
              onClick={() => setDismissed(true)}
              aria-label="Dismiss"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 20 20"
                fill="currentColor"
                class="h-4 w-4"
              >
                <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
              </svg>
            </button>
          </div>
        </div>
      </Show>

      {/* iOS manual install instructions */}
      <Show when={showIosPrompt()}>
        <div class="flex items-center justify-between gap-3 bg-primary/10 px-4 py-2.5 text-sm text-primary">
          <span>
            To install UnCorded, tap{" "}
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="inline h-4 w-4 align-text-bottom"
            >
              <path
                fill-rule="evenodd"
                d="M13.75 7h-3V3.66l1.95 2.1a.75.75 0 1 0 1.1-1.02l-3.25-3.5a.75.75 0 0 0-1.1 0L6.2 4.74a.75.75 0 0 0 1.1 1.02l1.95-2.1V7h-3A2.25 2.25 0 0 0 4 9.25v7.5A2.25 2.25 0 0 0 6.25 19h7.5A2.25 2.25 0 0 0 16 16.75v-7.5A2.25 2.25 0 0 0 13.75 7Z"
                clip-rule="evenodd"
              />
            </svg>{" "}
            Share then "Add to Home Screen"
          </span>
          <button
            type="button"
            class="shrink-0 text-primary/60 hover:text-primary"
            onClick={() => setDismissed(true)}
            aria-label="Dismiss"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 20 20"
              fill="currentColor"
              class="h-4 w-4"
            >
              <path d="M6.28 5.22a.75.75 0 0 0-1.06 1.06L8.94 10l-3.72 3.72a.75.75 0 1 0 1.06 1.06L10 11.06l3.72 3.72a.75.75 0 1 0 1.06-1.06L11.06 10l3.72-3.72a.75.75 0 0 0-1.06-1.06L10 8.94 6.28 5.22Z" />
            </svg>
          </button>
        </div>
      </Show>
    </>
  );
};

export default InstallPrompt;
