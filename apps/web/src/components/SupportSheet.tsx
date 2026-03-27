import { createSignal, For, Show } from "solid-js";
import { A } from "@solidjs/router";
import { Sheet, SheetContent } from "./ui/sheet.js";

const quickLinks = [
  {
    title: "Feature Requests",
    description: "Suggest new features for UnCorded",
    href: "/features",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    title: "Report a Bug",
    description: "Let us know if something isn't working",
    href: "#bug",
    icon: (
      <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
        <path stroke-linecap="round" stroke-linejoin="round" d="M12 9v2m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
      </svg>
    ),
  },
];

const faqItems = [
  {
    id: "create-server",
    question: "How do I create a server?",
    answer: "Click 'Create Server' under Servers in the sidebar. Give it a name and you're ready to go.",
  },
  {
    id: "add-friends",
    question: "How do I add friends?",
    answer: "Go to Friends in the sidebar and use the Add Friend input at the top. Search by username and send a request.",
  },
  {
    id: "p2p-file-sharing",
    question: "How does P2P file sharing work?",
    answer: "Files are shared directly between users using WebTorrent. Click Send File in the sidebar, select a friend and file. No server storage needed.",
  },
  {
    id: "subscription-tiers",
    question: "What are the subscription tiers?",
    answer: "Supporter gives you unlimited servers, 100MB uploads, and file sharing in server channels. Server Owner adds server customization. Check Settings > Upgrade for full details.",
  },
  {
    id: "delete-account",
    question: "Can I delete my account?",
    answer: "Yes. Go to Settings > Account and scroll to the Danger Zone at the bottom. Account deletion is permanent and cannot be undone.",
  },
];

interface SupportSheetProps {
  open: boolean;
  onClose: () => void;
  onReportBug?: () => void;
}

const SupportSheet = (props: SupportSheetProps) => {
  const [search, setSearch] = createSignal("");
  const [expandedFaq, setExpandedFaq] = createSignal<string | null>(null);

  const filteredFaqs = () =>
    faqItems.filter(
      (f) =>
        !search() ||
        f.question.toLowerCase().includes(search().toLowerCase()) ||
        f.answer.toLowerCase().includes(search().toLowerCase()),
    );

  const handleClose = () => {
    setSearch("");
    setExpandedFaq(null);
    props.onClose();
  };

  const handleLinkClick = (href: string) => {
    if (href === "#bug" && props.onReportBug) {
      handleClose();
      props.onReportBug();
      return;
    }
  };

  return (
    <Sheet open={props.open} onOpenChange={(open) => { if (!open) handleClose(); }} side="right">
      <SheetContent side="right" onClose={handleClose} class="w-full sm:max-w-md">
        <div class="flex h-full flex-col">
          {/* Header */}
          <div class="px-6 pt-6 pb-4">
            <h2 class="text-lg font-semibold text-foreground">Help & Support</h2>
          </div>

          {/* Search */}
          <div class="px-6 pb-4">
            <div class="relative">
              <svg xmlns="http://www.w3.org/2000/svg" class="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                <path stroke-linecap="round" stroke-linejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
              </svg>
              <input
                type="text"
                id="search-input"
                placeholder="Search for help..."
                value={search()}
                onInput={(e) => setSearch(e.currentTarget.value)}
                aria-label="Search for help"
                class="w-full rounded-md border border-border bg-input px-3 py-2 pl-9 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring/50"
              />
            </div>
          </div>

          <div class="mx-6 h-px bg-border" />

          {/* Scrollable content */}
          <div class="flex-1 overflow-y-auto">
            {/* Quick Links */}
            <Show when={!search()}>
              <div class="px-6 py-4">
                <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                  Quick Links
                </h3>
                <div class="space-y-1">
                  <For each={quickLinks}>
                    {(link) => (
                      <Show
                        when={link.href !== "#bug"}
                        fallback={
                          <button
                            type="button"
                            class="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                            onClick={() => handleLinkClick(link.href)}
                          >
                            <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                              {link.icon}
                            </div>
                            <div class="min-w-0 flex-1">
                              <p class="text-sm font-medium text-foreground">{link.title}</p>
                              <p class="text-xs text-muted-foreground">{link.description}</p>
                            </div>
                            <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </button>
                        }
                      >
                        <A
                          href={link.href}
                          class="flex items-center gap-3 rounded-lg px-3 py-2.5 transition-colors hover:bg-accent/50"
                          onClick={() => handleClose()}
                        >
                          <div class="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
                            {link.icon}
                          </div>
                          <div class="min-w-0 flex-1">
                            <p class="text-sm font-medium text-foreground">{link.title}</p>
                            <p class="text-xs text-muted-foreground">{link.description}</p>
                          </div>
                          <svg xmlns="http://www.w3.org/2000/svg" class="h-4 w-4 shrink-0 text-muted-foreground" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                            <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                          </svg>
                        </A>
                      </Show>
                    )}
                  </For>
                </div>
              </div>
            </Show>

            <div class="mx-6 h-px bg-border" />

            {/* FAQ */}
            <div class="px-6 py-4">
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Frequently Asked Questions
              </h3>
              <Show
                when={filteredFaqs().length > 0}
                fallback={
                  <p class="py-4 text-center text-sm text-muted-foreground">
                    No results found for "{search()}"
                  </p>
                }
              >
                <div class="space-y-1">
                  <For each={filteredFaqs()}>
                    {(faq) => {
                      const isExpanded = () => expandedFaq() === faq.id;
                      return (
                        <button
                          type="button"
                          class="w-full rounded-lg px-3 py-2.5 text-left transition-colors hover:bg-accent/50"
                          onClick={() => setExpandedFaq(isExpanded() ? null : faq.id)}
                        >
                          <div class="flex items-center justify-between gap-2">
                            <p class="text-sm font-medium text-foreground">{faq.question}</p>
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              class="h-4 w-4 shrink-0 text-muted-foreground transition-transform"
                              classList={{ "rotate-90": isExpanded() }}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              stroke-width="2"
                            >
                              <path stroke-linecap="round" stroke-linejoin="round" d="M9 5l7 7-7 7" />
                            </svg>
                          </div>
                          <Show when={isExpanded()}>
                            <p class="mt-1.5 text-xs leading-relaxed text-muted-foreground">
                              {faq.answer}
                            </p>
                          </Show>
                        </button>
                      );
                    }}
                  </For>
                </div>
              </Show>
            </div>

            <div class="mx-6 h-px bg-border" />

            {/* Contact */}
            <div class="px-6 py-4">
              <h3 class="mb-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Still need help?
              </h3>
              <div class="rounded-lg border border-border p-4">
                <p class="text-sm font-medium text-foreground">Contact Support</p>
                <p class="mt-1 text-xs text-muted-foreground">
                  Our team typically responds within 24 hours.
                </p>
                <div class="mt-3 flex gap-2">
                  <a
                    href="mailto:support@uncorded.app"
                    class="inline-flex items-center gap-1.5 rounded-md bg-primary px-3 py-1.5 text-xs font-medium text-primary-foreground transition-colors hover:bg-primary/90"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                    </svg>
                    Email Us
                  </a>
                  <a
                    href="https://discord.gg/uncorded"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="inline-flex items-center gap-1.5 rounded-md border border-border px-3 py-1.5 text-xs font-medium text-foreground transition-colors hover:bg-accent"
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" class="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2">
                      <path stroke-linecap="round" stroke-linejoin="round" d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
                    </svg>
                    Discord
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      </SheetContent>
    </Sheet>
  );
};

export default SupportSheet;