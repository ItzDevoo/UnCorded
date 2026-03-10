import { createSignal, For, Show, onMount, onCleanup } from "solid-js";
import { Portal } from "solid-js/web";
import { readyData } from "../lib/gateway-store.js";
import {
  selectedServerId,
  setSelectedServerId,
  selectHome,
  currentServer,
} from "../stores/app-store.js";

interface ServerSwitcherProps {
  onCreateServer: () => void;
  onJoinServer: () => void;
}

const ServerSwitcher = (props: ServerSwitcherProps) => {
  const [open, setOpen] = createSignal(false);
  // oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern
  let triggerRef!: HTMLButtonElement;

  const [pos, setPos] = createSignal({ top: 0, left: 0 });

  const updatePosition = () => {
    const rect = triggerRef.getBoundingClientRect();
    setPos({ top: rect.bottom + 4, left: rect.left });
  };

  const handleOpen = () => {
    updatePosition();
    setOpen(true);
  };

  const close = () => setOpen(false);

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.key === "Escape") close();
  };

  onMount(() => document.addEventListener("keydown", handleKeyDown));
  onCleanup(() => document.removeEventListener("keydown", handleKeyDown));

  const label = () => {
    const server = currentServer();
    return server ? server.name : "Home";
  };

  const serverInitial = () => {
    const server = currentServer();
    return server ? server.name.charAt(0).toUpperCase() : null;
  };

  return (
    <>
      <button
        ref={triggerRef}
        onClick={handleOpen}
        class="flex w-full items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-sm font-medium transition-colors hover:bg-accent"
      >
        {/* Icon */}
        <Show
          when={currentServer()}
          fallback={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-5 w-5 shrink-0 text-muted-foreground"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
              />
            </svg>
          }
        >
          {(server) => (
            <Show
              when={server().iconUrl}
              fallback={
                <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-white">
                  {serverInitial()}
                </div>
              }
            >
              {(url) => (
                <img src={url()} alt={server().name} class="h-5 w-5 shrink-0 rounded-md object-cover" />
              )}
            </Show>
          )}
        </Show>

        <span class="min-w-0 flex-1 truncate text-left text-foreground">{label()}</span>

        {/* Chevron */}
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-4 w-4 shrink-0 text-muted-foreground"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown */}
      <Show when={open()}>
        <Portal mount={document.body}>
          {/* Backdrop */}
          <div class="fixed inset-0 z-[--z-dropdown]" onClick={close} />
          {/* Menu */}
          <div
            class="absolute z-[--z-dropdown] min-w-[256px] rounded-xl border border-border bg-popover p-1 shadow-md"
            style={{ top: `${pos().top}px`, left: `${pos().left}px` }}
          >
            {/* Home */}
            <button
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
              classList={{ "bg-accent font-medium": !selectedServerId() }}
              onClick={() => {
                selectHome();
                close();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4 text-muted-foreground"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"
                />
              </svg>
              Home
            </button>

            <div class="mx-1 my-1 h-px bg-border" />

            {/* Servers */}
            <For each={readyData.data?.servers}>
              {(server) => (
                <button
                  class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm transition-colors hover:bg-accent"
                  classList={{ "bg-accent font-medium": selectedServerId() === server.id }}
                  onClick={() => {
                    setSelectedServerId(server.id);
                    close();
                  }}
                >
                  <Show
                    when={server.iconUrl}
                    fallback={
                      <div class="flex h-5 w-5 shrink-0 items-center justify-center rounded-md bg-primary text-[10px] font-bold text-white">
                        {server.name.charAt(0).toUpperCase()}
                      </div>
                    }
                  >
                    {(url) => (
                      <img src={url()} alt={server.name} class="h-5 w-5 shrink-0 rounded-md object-cover" />
                    )}
                  </Show>
                  <span class="truncate">{server.name}</span>
                </button>
              )}
            </For>

            <div class="mx-1 my-1 h-px bg-border" />

            {/* Create Server */}
            <button
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-success transition-colors hover:bg-accent"
              onClick={() => {
                props.onCreateServer();
                close();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
              </svg>
              Create Server
            </button>

            {/* Join Server */}
            <button
              class="flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-sm text-primary transition-colors hover:bg-accent"
              onClick={() => {
                props.onJoinServer();
                close();
              }}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class="h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1"
                />
              </svg>
              Join Server
            </button>
          </div>
        </Portal>
      </Show>
    </>
  );
};

export default ServerSwitcher;
