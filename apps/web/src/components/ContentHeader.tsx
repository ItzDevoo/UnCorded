import { For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { SidebarTrigger } from "./ui/sidebar.js";

interface Breadcrumb {
  label: string;
  href?: string;
}

interface ContentHeaderProps {
  title: string;
  breadcrumbs?: Breadcrumb[];
}

const ContentHeader = (props: ContentHeaderProps) => {
  return (
    <header class="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4">
      {/* Sidebar toggle — visible on desktop too */}
      <SidebarTrigger />
      <div class="h-4 w-px bg-border" />

      {/* Breadcrumbs */}
      <nav class="flex min-w-0 items-center gap-1 text-sm" aria-label="Breadcrumb">
        <Show when={props.breadcrumbs}>
          {(crumbs) => (
            <For each={crumbs()}>
              {(crumb) => (
                <>
                  <Show
                    when={crumb.href}
                    fallback={
                      <span class="hidden text-muted-foreground sm:inline">{crumb.label}</span>
                    }
                  >
                    {(href) => (
                      <A
                        href={href()}
                        class="hidden text-muted-foreground transition-colors hover:text-foreground sm:inline"
                      >
                        {crumb.label}
                      </A>
                    )}
                  </Show>
                  <span class="hidden text-muted-foreground sm:inline" aria-hidden="true">
                    /
                  </span>
                </>
              )}
            </For>
          )}
        </Show>
        <span class="truncate font-medium text-foreground">{props.title}</span>
      </nav>

      {/* Right side — Feature Requests link */}
      <div class="ml-auto flex items-center">
        <A
          href="/features"
          class="flex items-center gap-1.5 rounded-md px-2 py-1.5 text-sm text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
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
              d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
            />
          </svg>
          <span class="hidden sm:inline">Feature Requests</span>
        </A>
      </div>
    </header>
  );
};

export default ContentHeader;
