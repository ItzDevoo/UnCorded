import { For } from 'solid-js';
import { readyData } from '../lib/gateway-store.js';
import { selectedServerId, setSelectedServerId } from '../stores/app-store.js';

const ServerSidebar = () => {
  return (
    <div class="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-bg-server-bar py-3">
      {/* Home button */}
      <div class="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand text-white transition-all hover:rounded-xl">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
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
      </div>

      <div class="mx-auto h-px w-8 bg-border" />

      {/* Server icons */}
      <For each={readyData.data?.servers}>
        {(server) => {
          const isActive = () => selectedServerId() === server.id;
          return (
            <div class="group relative flex items-center justify-center">
              {/* Active indicator pill */}
              <div
                class="absolute left-0 w-1 rounded-r-full bg-brand transition-all"
                classList={{
                  'h-10': isActive(),
                  'h-2 group-hover:h-5': !isActive(),
                }}
              />
              <button
                onClick={() => setSelectedServerId(server.id)}
                class="flex h-12 w-12 items-center justify-center transition-all"
                classList={{
                  'rounded-xl bg-brand text-white': isActive(),
                  'rounded-2xl bg-bg-tertiary text-text-primary hover:rounded-xl hover:bg-brand hover:text-white':
                    !isActive(),
                }}
                title={server.name}
              >
                {server.iconUrl ? (
                  <img
                    src={server.iconUrl}
                    alt={server.name}
                    class="h-12 w-12 rounded-[inherit] object-cover"
                  />
                ) : (
                  <span class="text-sm font-semibold">{server.name.charAt(0).toUpperCase()}</span>
                )}
              </button>
            </div>
          );
        }}
      </For>

      {/* Add server button */}
      <div class="flex h-12 w-12 items-center justify-center rounded-full bg-bg-tertiary text-success transition-all hover:rounded-xl hover:bg-success hover:text-white">
        <svg
          xmlns="http://www.w3.org/2000/svg"
          class="h-6 w-6"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 4v16m8-8H4" />
        </svg>
      </div>
    </div>
  );
};

export default ServerSidebar;
