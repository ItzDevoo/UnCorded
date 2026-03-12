import { createSignal, lazy, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";

const ProfileSettings = lazy(() => import("../components/settings/profile-settings.js"));
const AccountSettings = lazy(() => import("../components/settings/account-settings.js"));
const AppearanceSettings = lazy(() => import("../components/settings/appearance-settings.js"));

type Tab = "profile" | "account" | "appearance";

const tabs: { id: Tab; label: string }[] = [
  { id: "profile", label: "Profile" },
  { id: "account", label: "Account" },
  { id: "appearance", label: "Appearance" },
];

const Settings = () => {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = createSignal<Tab>("profile");

  return (
    <div class="flex h-full flex-col">
      {/* Header */}
      <div class="flex items-center gap-3 border-b border-border px-6 py-4">
        <button
          type="button"
          onClick={() => navigate("/home")}
          class="rounded p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          aria-label="Back"
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-5 w-5"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path stroke-linecap="round" stroke-linejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
        <h1 class="text-lg font-semibold text-foreground">Settings</h1>
      </div>

      {/* Tab bar */}
      <div class="flex gap-1 border-b border-border px-6">
        {tabs.map((tab) => (
          <button
            type="button"
            class={`px-4 py-2.5 text-sm font-medium transition-colors ${
              activeTab() === tab.id
                ? "border-b-2 border-primary text-foreground"
                : "text-muted-foreground hover:text-foreground"
            }`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-2xl">
          <Show when={activeTab() === "profile"}>
            <ProfileSettings />
          </Show>
          <Show when={activeTab() === "account"}>
            <AccountSettings />
          </Show>
          <Show when={activeTab() === "appearance"}>
            <AppearanceSettings />
          </Show>
        </div>
      </div>
    </div>
  );
};

export default Settings;
