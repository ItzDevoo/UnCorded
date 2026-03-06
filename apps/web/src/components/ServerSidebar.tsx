const ServerSidebar = () => {
  return (
    <div class="flex h-full w-[72px] shrink-0 flex-col items-center gap-2 overflow-y-auto bg-bg-server-bar py-3">
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
