import { For } from "solid-js";
import { A, useLocation, type RouteSectionProps } from "@solidjs/router";
import ContentHeader from "../components/ContentHeader.js";

const navItems = [
  { label: "Profile", href: "/settings/profile" },
  { label: "Account", href: "/settings/account" },
  { label: "Appearance", href: "/settings/appearance" },
  { label: "Transfers", href: "/settings/transfers" },
  { label: "Bots", href: "/settings/bots" },
  { label: "Plugins", href: "/settings/plugins" },
  { divider: true as const },
  { label: "Upgrade", href: "/settings/upgrade" },
  { label: "Billing", href: "/settings/billing" },
  { label: "Notifications", href: "/settings/notifications" },
] as const;

const SettingsLayout = (props: RouteSectionProps) => {
  const location = useLocation();

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  const activeLabel = () => {
    const item = navItems.find((n) => "href" in n && isActive(n.href));
    return item && "label" in item ? item.label : "Settings";
  };

  return (
    <div class="flex h-full flex-col">
      <ContentHeader
        title={activeLabel()}
        breadcrumbs={[{ label: "Settings", href: "/settings" }]}
      />
      <div class="flex min-h-0 flex-1">
      {/* Settings sidebar nav — hidden on mobile, shows as list page instead */}
      <nav class="hidden w-52 shrink-0 border-r border-border sm:block">
        <div class="flex flex-col gap-0.5 p-3">
          <For each={navItems}>
            {(item) => {
              if ("divider" in item) {
                return <div class="my-1.5 h-px bg-border" />;
              }
              return (
                <A
                  href={item.href}
                  class={`rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                    isActive(item.href)
                      ? "bg-accent text-foreground"
                      : "text-muted-foreground hover:bg-accent hover:text-foreground"
                  }`}
                >
                  {item.label}
                </A>
              );
            }}
          </For>
        </div>
      </nav>

      {/* Mobile: show nav list when on /settings exactly */}
      <div class="flex flex-1 flex-col overflow-y-auto sm:hidden">
        {location.pathname === "/settings" || location.pathname === "/settings/" ? (
          <div class="flex flex-col gap-0.5 p-3">
            <For each={navItems}>
              {(item) => {
                if ("divider" in item) {
                  return <div class="my-1.5 h-px bg-border" />;
                }
                return (
                  <A
                    href={item.href}
                    class="flex items-center justify-between rounded-md px-3 py-3 text-sm font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    {item.label}
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      class="h-4 w-4 text-muted-foreground"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                    </svg>
                  </A>
                );
              }}
            </For>
          </div>
        ) : (
          <div class="flex-1 overflow-y-auto p-6">
            <div class="mx-auto max-w-2xl">{props.children}</div>
          </div>
        )}
      </div>

      {/* Desktop content area */}
      <div class="hidden flex-1 overflow-y-auto p-6 sm:block">
        <div class="mx-auto max-w-2xl">{props.children}</div>
      </div>
      </div>
    </div>
  );
};

export default SettingsLayout;
