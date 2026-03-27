import { messageDensity, setMessageDensity } from "../../stores/theme-store.js";
import type { MessageDensity } from "../../stores/theme-store.js";

const densityOptions: { id: MessageDensity; label: string; description: string }[] = [
  { id: "cozy", label: "Cozy", description: "More spacing between messages" },
  { id: "compact", label: "Compact", description: "Tighter spacing, more messages visible" },
];

const AppearanceSettings = () => {
  return (
    <div class="space-y-8">
      {/* Theme — dark only */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </h3>
        <div class="flex items-center gap-3 rounded-md border border-border bg-card px-4 py-3">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5 text-primary"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="1.5"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z"
            />
          </svg>
          <div>
            <p class="text-sm font-medium text-foreground">Terminal Dark</p>
            <p class="text-xs text-muted-foreground">The only theme. Dark mode always.</p>
          </div>
        </div>
      </div>

      {/* Message density */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Message Density
        </h3>
        <div
          class="grid grid-cols-2 gap-3"
          role="radiogroup"
          aria-label="Message density"
          onKeyDown={(e: KeyboardEvent) => {
            const keys = ["ArrowRight", "ArrowDown", "ArrowLeft", "ArrowUp"];
            if (!keys.includes(e.key)) return;
            e.preventDefault();
            const currentIdx = densityOptions.findIndex((o) => o.id === messageDensity());
            const forward = e.key === "ArrowRight" || e.key === "ArrowDown";
            const nextIdx = forward
              ? (currentIdx + 1) % densityOptions.length
              : (currentIdx - 1 + densityOptions.length) % densityOptions.length;
            const next = densityOptions[nextIdx];
            if (next) {
              setMessageDensity(next.id);
              // Move focus to the newly selected radio
              const container = e.currentTarget as HTMLElement;
              const buttons = container.querySelectorAll<HTMLElement>("[role=radio]");
              buttons[nextIdx]?.focus();
            }
          }}
        >
          {densityOptions.map((opt) => (
            <button
              type="button"
              role="radio"
              aria-checked={messageDensity() === opt.id}
              tabIndex={messageDensity() === opt.id ? 0 : -1}
              class={`flex flex-col items-start gap-1 rounded-md border-2 p-4 text-left transition-colors ${
                messageDensity() === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              onClick={() => setMessageDensity(opt.id)}
            >
              <span
                class={`text-sm font-medium ${
                  messageDensity() === opt.id ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {opt.label}
              </span>
              <span class="text-xs text-muted-foreground">{opt.description}</span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
};

export default AppearanceSettings;
