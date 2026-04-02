import { createSignal, onMount, onCleanup, Show } from "solid-js";

const OfflineIndicator = () => {
  const [online, setOnline] = createSignal(navigator.onLine);

  onMount(() => {
    const goOnline = () => setOnline(true);
    const goOffline = () => setOnline(false);

    window.addEventListener("online", goOnline);
    window.addEventListener("offline", goOffline);

    onCleanup(() => {
      window.removeEventListener("online", goOnline);
      window.removeEventListener("offline", goOffline);
    });
  });

  return (
    <Show when={!online()}>
      <div class="flex items-center justify-center gap-2 bg-destructive/90 px-3 py-1.5 text-xs font-medium text-destructive-foreground">
        <div class="h-2 w-2 rounded-full bg-destructive-foreground/70" />
        <span>You're offline — reconnecting...</span>
      </div>
    </Show>
  );
};

export default OfflineIndicator;
