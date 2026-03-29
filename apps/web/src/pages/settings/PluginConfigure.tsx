import { createSignal, createResource, Show, type ParentProps } from "solid-js";
import { A, useParams, useNavigate } from "@solidjs/router";
import type { PluginId } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { showToast } from "../../components/ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../../components/ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../../components/ui/dialog.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface PluginDetail {
  id: PluginId;
  name: string;
  description: string;
  author: string;
  icon: string | null;
  category: string;
  tags: readonly string[];
  installCount: number;
  installed: boolean;
  installedAt: string | null;
}

interface ClaudeCodeSetup {
  hasBotAccount: boolean;
  botOnline: boolean;
  botUsername: string | null;
  botTokenPrefix: string | null;
  lastConnected: string | null;
  ownerId: string;
}

interface PluginResponse {
  plugin: PluginDetail;
  setup: ClaudeCodeSetup | null;
}

// ── Helpers ──────────────────────────────────────────────────────────────────

function formatRelativeTime(iso: string | null): string {
  if (!iso) return "Never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

async function copyToClipboard(text: string) {
  try {
    await navigator.clipboard.writeText(text);
    showToast("Copied to clipboard", "info");
  } catch {
    showToast("Failed to copy", "error");
  }
}

// ── Component ────────────────────────────────────────────────────────────────

const PluginConfigure = () => {
  const params = useParams<{ pluginId: string }>();
  const navigate = useNavigate();

  const [showUninstall, setShowUninstall] = createSignal(false);
  const [uninstalling, setUninstalling] = createSignal(false);

  const [data, { refetch }] = createResource(
    () => params.pluginId,
    async (pluginId) => {
      const res = await api<PluginResponse>(`/api/plugins/${pluginId}`);
      return res;
    },
  );

  async function handleUninstall() {
    if (uninstalling()) return;
    setUninstalling(true);
    try {
      await api(`/api/plugins/${params.pluginId}/install`, { method: "DELETE" });
      showToast("Plugin uninstalled", "info");
      navigate("/settings/plugins");
    } catch (err) {
      handleApiError(err, "Failed to uninstall");
    } finally {
      setUninstalling(false);
      setShowUninstall(false);
    }
  }

  return (
    <div class="space-y-6">
      {/* Back link */}
      <A
        href="/settings/plugins"
        class="inline-flex items-center gap-1 text-sm text-muted-foreground transition-colors hover:text-foreground"
      >
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path stroke-linecap="round" stroke-linejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
        </svg>
        Back to Plugins
      </A>

      <Show
        when={!data.loading}
        fallback={
          <div class="space-y-4">
            <div class="h-8 w-48 animate-skeleton rounded bg-muted" />
            <div class="h-4 w-72 animate-skeleton rounded bg-muted" />
            <div class="h-64 animate-skeleton rounded-xl border border-border bg-muted" />
          </div>
        }
      >
        <Show
          when={!data.error && data()}
          fallback={
            <div class="rounded-lg border border-destructive/50 bg-destructive/10 p-6 text-center">
              <p class="text-sm text-destructive">Plugin not found or failed to load.</p>
              <Button variant="outline" size="sm" class="mt-2" onClick={() => refetch()}>
                Retry
              </Button>
            </div>
          }
        >
          {(d) => {
            const plugin = () => d().plugin;
            const setup = () => d().setup;

            return (
              <>
                {/* Header */}
                <div class="flex items-start gap-3">
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                    <svg
                      class="h-5 w-5"
                      xmlns="http://www.w3.org/2000/svg"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      stroke-width="2"
                    >
                      <path
                        stroke-linecap="round"
                        stroke-linejoin="round"
                        d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 14.5M14.25 3.104c.251.023.501.05.75.082M19.8 14.5l-2.147 2.147a2.25 2.25 0 01-.659.591c-.197.12-.417.207-.649.257l-2.095.349a.75.75 0 01-.867-.867l.349-2.095a2.25 2.25 0 01.848-1.308L19.8 14.5z"
                      />
                    </svg>
                  </div>
                  <div>
                    <h2 class="text-lg font-semibold text-foreground">{plugin().name}</h2>
                    <p class="text-sm text-muted-foreground">{plugin().description}</p>
                  </div>
                </div>

                {/* Setup Steps */}
                <Show when={setup()}>
                  {(s) => (
                    <div class="rounded-xl border border-border bg-card p-5">
                      <h3 class="mb-4 text-sm font-semibold text-foreground">Setup Steps</h3>
                      <div class="space-y-5">
                        {/* Step 1: Create a Bot */}
                        <StepItem
                          number={1}
                          title="Create a Bot"
                          completed={s().hasBotAccount}
                        >
                          <Show
                            when={s().hasBotAccount}
                            fallback={
                              <div class="mt-1">
                                <p class="text-sm text-muted-foreground">
                                  You need a bot account to use this plugin.
                                </p>
                                <A href="/settings/bots">
                                  <Button size="sm" class="mt-2">
                                    Create a Bot
                                  </Button>
                                </A>
                              </div>
                            }
                          >
                            <div class="mt-1 text-sm text-muted-foreground">
                              <p>Bot: <span class="font-mono text-foreground">@{s().botUsername}</span></p>
                              <A
                                href="/settings/bots"
                                class="text-xs text-primary hover:underline"
                              >
                                Manage in Bot Settings
                              </A>
                            </div>
                          </Show>
                        </StepItem>

                        {/* Step 2: Install the Plugin */}
                        <StepItem number={2} title="Install the Plugin" completed={false}>
                          <p class="mt-1 text-sm text-muted-foreground">
                            Run inside Claude Code:
                          </p>
                          <CodeBlock text="/plugin install uncorded@uncorded-plugins" />
                        </StepItem>

                        {/* Step 3: Configure Bot Token */}
                        <StepItem number={3} title="Configure Bot Token" completed={false}>
                          <p class="mt-1 text-sm text-muted-foreground">
                            Run inside Claude Code with your bot token:
                          </p>
                          <CodeBlock text="/uncorded:configure uncrd_YOUR_BOT_TOKEN" />
                          <Show when={s().botTokenPrefix}>
                            <p class="mt-1.5 text-xs text-muted-foreground">
                              Your token starts with <span class="font-mono text-foreground">{s().botTokenPrefix}...</span>
                              {" "}&mdash;{" "}
                              <A href="/settings/bots" class="text-primary hover:underline">
                                regenerate it in Bot Settings
                              </A>{" "}
                              if you've lost it.
                            </p>
                          </Show>
                        </StepItem>

                        {/* Step 4: Set Owner ID */}
                        <StepItem number={4} title="Set Owner ID" completed={false}>
                          <p class="mt-1 text-sm text-muted-foreground">
                            Tell the plugin which UnCorded account owns it. Run inside Claude Code:
                          </p>
                          <CodeBlock text={`/uncorded:configure owner ${s().ownerId}`} />
                          <p class="mt-1.5 text-xs text-muted-foreground">
                            Your user ID:{" "}
                            <button
                              type="button"
                              onClick={() => copyToClipboard(s().ownerId)}
                              class="font-mono text-foreground hover:text-primary"
                            >
                              {s().ownerId}
                            </button>
                          </p>
                        </StepItem>

                        {/* Step 5: Start Claude with Channel */}
                        <StepItem number={5} title="Start Claude with Channel" completed={false}>
                          <p class="mt-1 text-sm text-muted-foreground">
                            Restart Claude Code with the channel flag:
                          </p>
                          <CodeBlock text="claude --dangerously-load-development-channels plugin:uncorded@uncorded-plugins" />
                          <p class="mt-2 text-xs text-muted-foreground">
                            To also skip permission prompts (auto-approve all tool calls):
                          </p>
                          <CodeBlock text="claude --dangerously-skip-permissions --dangerously-load-development-channels plugin:uncorded@uncorded-plugins" />
                        </StepItem>

                        {/* Step 6: Connection Status */}
                        <StepItem
                          number={6}
                          title="Connection Status"
                          completed={s().botOnline}
                        >
                          <div class="mt-1 flex items-center gap-2 text-sm">
                            <Show
                              when={s().botOnline}
                              fallback={
                                <>
                                  <span class="h-2 w-2 rounded-full bg-destructive" />
                                  <span class="text-muted-foreground">Offline</span>
                                </>
                              }
                            >
                              <span class="h-2 w-2 rounded-full bg-success" />
                              <span class="text-success-foreground">Connected</span>
                            </Show>
                          </div>
                          <p class="mt-0.5 text-xs text-muted-foreground">
                            Last seen: {formatRelativeTime(s().lastConnected)}
                          </p>
                        </StepItem>
                      </div>
                    </div>
                  )}
                </Show>

                {/* Uninstall — only show when installed */}
                <Show when={plugin().installed}>
                  <div class="border-t border-border pt-4">
                    <Button
                      variant="destructive"
                      size="sm"
                      onClick={() => setShowUninstall(true)}
                    >
                      Uninstall Plugin
                    </Button>
                  </div>

                  {/* Uninstall Confirmation Dialog */}
                  <Dialog open={showUninstall()} onOpenChange={setShowUninstall}>
                    <DialogContent onClose={() => setShowUninstall(false)}>
                      <DialogHeader>
                        <DialogTitle>Uninstall Plugin</DialogTitle>
                        <DialogDescription>
                          Are you sure you want to uninstall <strong>{plugin().name}</strong>? You can reinstall it later.
                        </DialogDescription>
                      </DialogHeader>
                      <DialogFooter>
                        <Button variant="ghost" onClick={() => setShowUninstall(false)}>
                          Cancel
                        </Button>
                        <Button
                          variant="destructive"
                          onClick={handleUninstall}
                          disabled={uninstalling()}
                        >
                          {uninstalling() ? "Uninstalling..." : "Uninstall"}
                        </Button>
                      </DialogFooter>
                    </DialogContent>
                  </Dialog>
                </Show>
              </>
            );
          }}
        </Show>
      </Show>
    </div>
  );
};

// ── Step Item ────────────────────────────────────────────────────────────────

function StepItem(props: ParentProps<{
  number: number;
  title: string;
  completed: boolean;
}>) {
  return (
    <div class="flex gap-3">
      {/* Step indicator */}
      <div class="flex shrink-0 flex-col items-center">
        <div
          class={`flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold ${
            props.completed
              ? "bg-success text-primary-foreground"
              : "border border-border bg-muted text-muted-foreground"
          }`}
        >
          <Show
            when={props.completed}
            fallback={<span>{props.number}</span>}
          >
            <svg
              class="h-3.5 w-3.5"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="3"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M4.5 12.75l6 6 9-13.5" />
            </svg>
          </Show>
        </div>
      </div>

      {/* Step content */}
      <div class="min-w-0 flex-1 pb-1">
        <p class={`text-sm font-medium ${props.completed ? "text-foreground" : "text-muted-foreground"}`}>
          Step {props.number}: {props.title}
        </p>
        {props.children}
      </div>
    </div>
  );
}

// ── Code Block with Copy ─────────────────────────────────────────────────────

function CodeBlock(props: { text: string }) {
  return (
    <div class="group relative mt-2 rounded-lg bg-background border border-border p-3 font-mono text-sm text-foreground">
      <pre class="overflow-x-auto whitespace-pre-wrap break-all pr-8">{props.text}</pre>
      <button
        type="button"
        onClick={() => copyToClipboard(props.text)}
        class="absolute right-2 top-2 rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
        aria-label="Copy to clipboard"
        title="Copy to clipboard"
      >
        <svg
          class="h-4 w-4"
          xmlns="http://www.w3.org/2000/svg"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          stroke-width="2"
        >
          <path
            stroke-linecap="round"
            stroke-linejoin="round"
            d="M15.666 3.888A2.25 2.25 0 0013.5 2.25h-3c-1.03 0-1.9.693-2.166 1.638m7.332 0c.055.194.084.4.084.612v0a.75.75 0 01-.75.75H9.75a.75.75 0 01-.75-.75v0c0-.212.03-.418.084-.612m7.332 0c.646.049 1.288.11 1.927.184 1.1.128 1.907 1.077 1.907 2.185V19.5a2.25 2.25 0 01-2.25 2.25H6.75A2.25 2.25 0 014.5 19.5V6.257c0-1.108.806-2.057 1.907-2.185a48.208 48.208 0 011.927-.184"
          />
        </svg>
      </button>
    </div>
  );
}

export default PluginConfigure;
