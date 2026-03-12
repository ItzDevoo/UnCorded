import { theme, setTheme, messageDensity, setMessageDensity } from "../../stores/theme-store.js";
import type { Theme, MessageDensity } from "../../stores/theme-store.js";

const themeOptions: { id: Theme; label: string; icon: string }[] = [
  {
    id: "dark",
    label: "Dark",
    icon: "M20.354 15.354A9 9 0 018.646 3.646 9.003 9.003 0 0012 21a9.003 9.003 0 008.354-5.646z",
  },
  {
    id: "light",
    label: "Light",
    icon: "M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z",
  },
];

const densityOptions: { id: MessageDensity; label: string; description: string }[] = [
  { id: "cozy", label: "Cozy", description: "More spacing between messages" },
  { id: "compact", label: "Compact", description: "Tighter spacing, more messages visible" },
];

const AppearanceSettings = () => {
  return (
    <div class="space-y-8">
      {/* Theme */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Theme
        </h3>
        <div class="grid grid-cols-2 gap-3">
          {themeOptions.map((opt) => (
            <button
              type="button"
              class={`flex flex-col items-center gap-3 rounded-lg border-2 p-4 transition-colors ${
                theme() === opt.id
                  ? "border-primary bg-primary/5"
                  : "border-border hover:border-muted-foreground/30"
              }`}
              onClick={() => setTheme(opt.id)}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                class={`h-8 w-8 ${theme() === opt.id ? "text-primary" : "text-muted-foreground"}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="1.5"
              >
                <path stroke-linecap="round" stroke-linejoin="round" d={opt.icon} />
              </svg>
              <span
                class={`text-sm font-medium ${
                  theme() === opt.id ? "text-foreground" : "text-muted-foreground"
                }`}
              >
                {opt.label}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Message density */}
      <div>
        <h3 class="mb-4 text-sm font-semibold uppercase tracking-wider text-muted-foreground">
          Message Density
        </h3>
        <div class="grid grid-cols-2 gap-3">
          {densityOptions.map((opt) => (
            <button
              type="button"
              class={`flex flex-col items-start gap-1 rounded-lg border-2 p-4 text-left transition-colors ${
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
