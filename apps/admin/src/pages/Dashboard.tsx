import { createSignal, onMount, Show, For } from "solid-js";
import { A } from "@solidjs/router";
import { type Stats, statsSchema } from "@uncorded/shared";
import { api } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Card, CardContent } from "../components/ui/card.js";

const UsersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" /><circle cx="9" cy="7" r="4" /><path d="M22 21v-2a4 4 0 0 0-3-3.87" /><path d="M16 3.13a4 4 0 0 1 0 7.75" />
  </svg>
);

const ServersIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" /><rect x="2" y="14" width="20" height="8" rx="2" ry="2" /><line x1="6" y1="6" x2="6.01" y2="6" /><line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

const MessagesIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
  </svg>
);

const ReportsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" /><line x1="12" y1="9" x2="12" y2="13" /><line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const FeedbackIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
    <circle cx="12" cy="12" r="10" /><line x1="12" y1="16" x2="12" y2="12" /><line x1="12" y1="8" x2="12.01" y2="8" />
  </svg>
);

const STAT_CARDS = [
  {
    key: "totalUsers" as const,
    label: "Total Users",
    href: "/users",
    icon: () => <UsersIcon />,
    color: "text-primary",
    bg: "bg-primary/10",
  },
  {
    key: "totalServers" as const,
    label: "Servers",
    icon: () => <ServersIcon />,
    color: "text-info",
    bg: "bg-info/10",
  },
  {
    key: "totalMessages" as const,
    label: "Messages",
    icon: () => <MessagesIcon />,
    color: "text-muted-foreground",
    bg: "bg-muted",
  },
  {
    key: "unresolvedReports" as const,
    label: "Unresolved Reports",
    href: "/reports",
    icon: () => <ReportsIcon />,
    color: "text-warning",
    bg: "bg-warning/10",
  },
  {
    key: "openFeedback" as const,
    label: "Open Feedback",
    href: "/feedback",
    icon: () => <FeedbackIcon />,
    color: "text-info",
    bg: "bg-info/10",
  },
];

const Dashboard = () => {
  const [stats, setStats] = createSignal<Stats | null>(null);
  const [error, setError] = createSignal(false);

  onMount(async () => {
    try {
      const raw = await api<unknown>("/api/admin/stats");
      const result = statsSchema.safeParse(raw);
      if (!result.success) {
        console.error("Invalid stats response", result.error);
        setError(true);
        showToast("Invalid stats data", "error");
        return;
      }
      setStats(result.data);
    } catch {
      setError(true);
      showToast("Failed to load dashboard stats", "error");
    }
  });

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Overview</h1>
      <Show
        when={!error()}
        fallback={
          <p class="text-sm text-muted-foreground">Failed to load stats. Please try refreshing the page.</p>
        }
      >
        <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <For each={STAT_CARDS}>
            {(card) => {
              const value = () => stats()?.[card.key] ?? 0;
              const content = (
                <Card class="transition-all hover:border-border/80 hover:shadow-md">
                  <CardContent class="p-5">
                    <div class="flex items-center justify-between">
                      <div>
                        <p class="text-xs font-medium uppercase tracking-wider text-muted-foreground">
                          {card.label}
                        </p>
                        <p class="mt-2 text-3xl font-bold tabular-nums">
                          {stats() ? value().toLocaleString() : "—"}
                        </p>
                      </div>
                      <div class={`rounded-xl p-3 ${card.bg}`}>
                        <span class={card.color}>{card.icon()}</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              );
              return card.href ? <A href={card.href}>{content}</A> : content;
            }}
          </For>
        </div>
      </Show>
    </div>
  );
};

export default Dashboard;
