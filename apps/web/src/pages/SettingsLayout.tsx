import { createSignal, For } from "solid-js";
import { useLocation, useNavigate, type RouteSectionProps } from "@solidjs/router";
import ContentHeader from "../components/ContentHeader.js";
import { Sheet, SheetContent } from "../components/ui/sheet.js";

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
  { divider: true as const },
  { label: "Developer", href: "/settings/developer" },
] as const;

const SettingsLayout = (props: RouteSectionProps) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [showNav, setShowNav] = createSignal(false);

  const isActive = (href: string) =>
    location.pathname === href || location.pathname.startsWith(`${href}/`);

  const activeLabel = () => {
    const item = navItems.find((n) => "href" in n && isActive(n.href));
    return item && "label" in item ? item.label : "Settings";
  };

  function handleNavClick(href: string) {
    setShowNav(false);
    navigate(href);
  }

  return (
    <div class="flex h-full flex-col">
      <ContentHeader
        title="Settings"
        breadcrumbs={[{ label: "Settings", href: "/settings" }]}
      />

      {/* Sub-header — active page label + nav toggle */}
      <div class="flex shrink-0 items-center gap-3 border-b border-border px-4 py-3">
        <span class="font-semibold text-foreground">{activeLabel()}</span>
        <div class="ml-auto">
          <button
            type="button"
            class={`rounded p-1.5 transition-colors ${showNav() ? "bg-accent text-foreground" : "text-muted-foreground hover:bg-accent hover:text-foreground"}`}
            title="Settings navigation"
            aria-label="Toggle settings navigation"
            onClick={() => setShowNav((prev) => !prev)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="20"
              height="20"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="2"
              stroke-linecap="round"
              stroke-linejoin="round"
              aria-hidden="true"
            >
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
        </div>
      </div>

      {/* Content */}
      <div class="flex-1 overflow-y-auto p-6">
        <div class="mx-auto max-w-2xl">{props.children}</div>
      </div>

      {/* Settings nav overlay */}
      <Sheet open={showNav()} onOpenChange={setShowNav} side="right">
        <SheetContent side="right" onClose={() => setShowNav(false)}>
          <div class="flex h-full flex-col">
            <div class="shrink-0 border-b border-border px-4 py-3">
              <h3 class="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                Settings
              </h3>
            </div>
            <nav class="flex flex-col gap-0.5 p-3">
              <For each={navItems}>
                {(item) => {
                  if ("divider" in item) {
                    return <div class="my-1.5 h-px bg-border" />;
                  }
                  return (
                    <button
                      type="button"
                      class={`rounded-md px-3 py-2 text-left text-sm font-medium transition-colors ${
                        isActive(item.href)
                          ? "bg-accent text-foreground"
                          : "text-muted-foreground hover:bg-accent hover:text-foreground"
                      }`}
                      onClick={() => handleNavClick(item.href)}
                    >
                      {item.label}
                    </button>
                  );
                }}
              </For>
            </nav>
          </div>
        </SheetContent>
      </Sheet>
    </div>
  );
};

export default SettingsLayout;
