import { createSignal, onMount, onCleanup, Show, For, type ParentComponent } from "solid-js";
import { A, useLocation } from "@solidjs/router";
import { signOut, useSession } from "../lib/auth.js";
import { cn } from "../lib/cn.js";

const NAV_ITEMS = [
  {
    href: "/",
    label: "Dashboard",
    exact: true,
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" />
      </svg>
    ),
  },
  {
    href: "/users",
    label: "Users",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
      </svg>
    ),
  },
  {
    href: "/reports",
    label: "Reports",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
      </svg>
    ),
  },
  {
    href: "/feedback",
    label: "Feedback",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </svg>
    ),
  },
  {
    href: "/polls",
    label: "Polls",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" />
      </svg>
    ),
  },
  {
    href: "/admins",
    label: "Admins",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
  {
    href: "/audit-log",
    label: "Audit Log",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" /><polyline points="14 2 14 8 20 8" /><line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
  },
] as const;

const PAGE_TITLES: Record<string, string> = {
  "/": "Dashboard",
  "/users": "Users",
  "/reports": "Reports",
  "/feedback": "Feedback",
  "/polls": "Polls",
  "/admins": "Admins",
  "/audit-log": "Audit Log",
};

const AdminLayout: ParentComponent = (props) => {
  const [sidebarOpen, setSidebarOpen] = createSignal(false);
  const [sidebarExpanded, setSidebarExpanded] = createSignal(true);
  const [isMobile, setIsMobile] = createSignal(false);
  const location = useLocation();
  const session = useSession();

  onMount(() => {
    const mql = window.matchMedia("(max-width: 639px)");
    setIsMobile(mql.matches);
    const handler = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    mql.addEventListener("change", handler);
    onCleanup(() => mql.removeEventListener("change", handler));
  });

  const currentPage = () => PAGE_TITLES[location.pathname] ?? "Admin";
  const userEmail = () => {
    const s = session();
    return s.data?.user?.email ?? "";
  };

  return (
    <div class="flex h-screen flex-col overflow-hidden bg-background">
      {/* ── Top Bar ─────────────────────────────────────── */}
      <header class="flex h-14 shrink-0 items-center justify-between border-b border-border bg-card px-4">
        <div class="flex items-center gap-3">
          <button
            onClick={() => {
              // Mobile: toggle overlay. Desktop: toggle expanded/collapsed.
              if (isMobile()) {
                setSidebarOpen(!sidebarOpen());
              } else {
                setSidebarExpanded(!sidebarExpanded());
              }
            }}
            class="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label={isMobile() ? "Open navigation" : "Toggle navigation"}
            aria-expanded={isMobile() ? sidebarOpen() : sidebarExpanded()}
          >
            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          </button>
          <span class="text-sm font-bold text-primary">UnCorded Admin</span>
        </div>
        <div class="flex items-center gap-3">
          <span class="hidden text-xs text-muted-foreground sm:block">{userEmail()}</span>
          <button
            onClick={() => signOut()}
            class="rounded-lg px-3 py-1.5 text-xs text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
          >
            Sign Out
          </button>
        </div>
      </header>

      <div class="flex flex-1 overflow-hidden">
        {/* ── Mobile sidebar overlay ────────────────────── */}
        <Show when={sidebarOpen()}>
          <div class="fixed inset-0 z-40 sm:hidden" onClick={() => setSidebarOpen(false)}>
            <div class="absolute inset-0 bg-black/50" />
            <aside
              class="relative flex h-full w-56 flex-col border-r border-border bg-card animate-slide-in-left"
              onClick={(e) => e.stopPropagation()}
            >
              <SidebarContent expanded={true} onNavigate={() => setSidebarOpen(false)} />
            </aside>
          </div>
        </Show>

        {/* ── Desktop sidebar ───────────────────────────── */}
        <aside
          class={cn(
            "hidden shrink-0 flex-col border-r border-border bg-card transition-all duration-200 sm:flex",
            sidebarExpanded() ? "w-52" : "w-14",
          )}
        >
          <SidebarContent expanded={sidebarExpanded()} />
        </aside>

        {/* ── Main content ──────────────────────────────── */}
        <div class="flex flex-1 flex-col overflow-hidden">
          {/* Breadcrumb bar */}
          <div class="flex h-10 shrink-0 items-center border-b border-border bg-background px-5">
            <nav class="flex items-center gap-1.5 text-xs text-muted-foreground">
              <A href="/" class="hover:text-foreground transition-colors">
                Dashboard
              </A>
              <Show when={location.pathname !== "/"}>
                <span>/</span>
                <span class="text-foreground font-medium">{currentPage()}</span>
              </Show>
            </nav>
          </div>

          {/* Page content */}
          <main class="flex-1 overflow-auto p-5">
            {props.children}
          </main>
        </div>
      </div>
    </div>
  );
};

// ── Sidebar content (shared between mobile/desktop) ──────────────────────

function SidebarContent(props: { expanded: boolean; onNavigate?: () => void }) {
  return (
    <nav class="flex flex-1 flex-col gap-1 p-2">
      <For each={NAV_ITEMS}>
        {(item) => (
          <A
            href={item.href}
            end={"exact" in item && item.exact === true}
            class={cn(
              "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground",
              !props.expanded && "justify-center px-0",
            )}
            activeClass="bg-accent text-foreground font-medium"
            onClick={() => props.onNavigate?.()}
            aria-label={item.label}
          >
            <span class="shrink-0" aria-hidden="true">{item.icon}</span>
            <Show when={props.expanded}>
              <span>{item.label}</span>
            </Show>
          </A>
        )}
      </For>
    </nav>
  );
}

export default AdminLayout;
