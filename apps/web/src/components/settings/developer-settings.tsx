import { createSignal, createResource, For, Show } from "solid-js";
import { api } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
import { Button } from "../ui/button.js";

// ── Types ────────────────────────────────────────────────────────────────────

interface PluginSubmission {
  id: string;
  status: "pending" | "approved" | "rejected";
  submittedAt: string;
  rejectionReason: string | null;
  reviewedAt: string | null;
}

interface DeveloperPlugin {
  id: string;
  name: string;
  description: string;
  version: string;
  category: string;
  scope: string;
  image: string;
  published: boolean;
  createdAt: string;
  submission: PluginSubmission | null;
}

// ── Constants ───────────────────────────────────────────────────────────────

const CATEGORIES = ["ai", "productivity", "developer", "media", "social", "utility", "other"] as const;
const SCOPES = ["server", "personal", "both"] as const;
const PERMISSIONS = [
  "server.read",
  "members.read",
  "channels.read",
  "messages.read",
  "messages.send",
  "users.read",
  "presence.read",
  "notifications.send",
  "config.read",
  "storage.read",
  "storage.write",
] as const;

// ── Component ───────────────────────────────────────────────────────────────

const DeveloperSettings = () => {
  const [devMode, setDevMode] = createSignal(
    localStorage.getItem("developerMode") === "true",
  );

  function toggleDevMode() {
    const next = !devMode();
    setDevMode(next);
    localStorage.setItem("developerMode", String(next));
  }

  // Plugin list resource — only fetches when dev mode is on
  const [plugins, { refetch }] = createResource(
    () => devMode(),
    async (enabled) => {
      if (!enabled) return [];
      const res = await api<{ plugins: DeveloperPlugin[] }>("/api/developer/plugins");
      return res.plugins;
    },
  );

  // ── Form state ────────────────────────────────────────────────────────────

  const [formId, setFormId] = createSignal("");
  const [formName, setFormName] = createSignal("");
  const [formDesc, setFormDesc] = createSignal("");
  const [formVersion, setFormVersion] = createSignal("1.0.0");
  const [formCategory, setFormCategory] = createSignal<string>("utility");
  const [formScope, setFormScope] = createSignal<string>("server");
  const [formImage, setFormImage] = createSignal("");
  const [formPort, setFormPort] = createSignal(3000);
  const [formHealthCheck, setFormHealthCheck] = createSignal("/health");
  const [formRepo, setFormRepo] = createSignal("");
  const [formTags, setFormTags] = createSignal("");
  const [formPermissions, setFormPermissions] = createSignal<Set<string>>(new Set());
  const [submitting, setSubmitting] = createSignal(false);
  const [formError, setFormError] = createSignal<string | null>(null);

  function togglePermission(perm: string) {
    setFormPermissions((prev) => {
      const next = new Set<string>(prev);
      if (next.has(perm)) next.delete(perm);
      else next.add(perm);
      return next;
    });
  }

  function resetForm() {
    setFormId("");
    setFormName("");
    setFormDesc("");
    setFormVersion("1.0.0");
    setFormCategory("utility");
    setFormScope("server");
    setFormImage("");
    setFormPort(3000);
    setFormHealthCheck("/health");
    setFormRepo("");
    setFormTags("");
    setFormPermissions(new Set<string>());
    setFormError(null);
  }

  async function handleSubmit(e: Event) {
    e.preventDefault();
    if (submitting()) return;
    setFormError(null);

    const permissions = [...formPermissions()];
    if (permissions.length === 0) {
      setFormError("Select at least one permission");
      return;
    }

    setSubmitting(true);
    try {
      const body = {
        id: formId().trim(),
        name: formName().trim(),
        description: formDesc().trim(),
        author: formName().trim(), // author defaults to plugin name
        category: formCategory(),
        scope: formScope(),
        image: formImage().trim(),
        version: formVersion().trim(),
        manifest: {
          runtime: {
            image: formImage().trim(),
            port: formPort(),
            healthCheck: formHealthCheck().trim(),
          },
          permissions,
        },
        tags: formTags()
          .split(",")
          .map((t) => t.trim())
          .filter(Boolean),
        ...(formRepo().trim() ? { repository: formRepo().trim() } : {}),
      };

      await api("/api/developer/plugins", {
        method: "POST",
        body: JSON.stringify(body),
      });

      showToast("Plugin submitted for review", "info");
      resetForm();
      refetch();
    } catch (err) {
      handleApiError(err, "Failed to submit plugin");
    } finally {
      setSubmitting(false);
    }
  }

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div class="space-y-6">
      <div>
        <h2 class="text-lg font-semibold text-foreground">Developer</h2>
        <p class="text-sm text-muted-foreground">
          Build and submit plugins to the UnCorded marketplace.
        </p>
      </div>

      {/* Developer Mode Toggle */}
      <div class="flex items-center justify-between rounded-lg border border-border p-4">
        <div>
          <p class="text-sm font-medium text-foreground">Developer Mode</p>
          <p class="text-xs text-muted-foreground">
            Enable plugin submission tools and developer features.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={devMode()}
          class={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
            devMode() ? "bg-primary" : "bg-muted"
          }`}
          onClick={toggleDevMode}
        >
          <span
            class={`pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow-lg transition-transform ${
              devMode() ? "translate-x-5" : "translate-x-0"
            }`}
          />
        </button>
      </div>

      <Show
        when={devMode()}
        fallback={
          <div class="rounded-lg border border-border p-6 text-center">
            <p class="text-sm text-muted-foreground">
              Enable developer mode to submit plugins, view your submissions, and access developer tools.
            </p>
          </div>
        }
      >
        {/* ── Section 2: My Submitted Plugins ───────────────────────────── */}
        <div class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            My Submitted Plugins
          </h3>

          <Show
            when={!plugins.loading}
            fallback={<p class="text-sm text-muted-foreground">Loading...</p>}
          >
            <Show
              when={(plugins()?.length ?? 0) > 0}
              fallback={
                <div class="rounded-lg border border-border p-6 text-center">
                  <p class="text-sm text-muted-foreground">
                    You haven't submitted any plugins yet.
                  </p>
                </div>
              }
            >
              <div class="space-y-2">
                <For each={plugins()}>
                  {(plugin) => (
                    <div class="rounded-lg border border-border p-4">
                      <div class="flex items-center justify-between gap-3">
                        <div class="min-w-0 flex-1">
                          <div class="flex items-center gap-2">
                            <span class="font-semibold text-foreground">{plugin.name}</span>
                            <span class="text-xs text-muted-foreground">v{plugin.version}</span>
                          </div>
                          <p class="text-xs text-muted-foreground">{plugin.id}</p>
                        </div>
                        <Show when={plugin.submission}>
                          {(sub) => (
                            <span
                              class={`shrink-0 rounded px-2 py-0.5 text-xs font-medium ${
                                sub().status === "pending"
                                  ? "bg-yellow-500/20 text-yellow-400"
                                  : sub().status === "approved"
                                    ? "bg-green-500/20 text-green-400"
                                    : "bg-red-500/20 text-red-400"
                              }`}
                            >
                              {sub().status}
                            </span>
                          )}
                        </Show>
                      </div>

                      {/* Rejection reason */}
                      <Show when={plugin.submission?.status === "rejected" && plugin.submission?.rejectionReason}>
                        <div class="mt-2 rounded bg-destructive/10 p-2">
                          <p class="text-xs text-muted-foreground">
                            <span class="font-medium text-destructive">Rejected:</span>{" "}
                            {plugin.submission!.rejectionReason}
                          </p>
                        </div>
                      </Show>
                    </div>
                  )}
                </For>
              </div>
            </Show>
          </Show>
        </div>

        {/* ── Section 3: Submit New Plugin ───────────────────────────────── */}
        <div class="space-y-3">
          <h3 class="text-sm font-semibold uppercase tracking-wider text-muted-foreground">
            Submit New Plugin
          </h3>

          <form onSubmit={handleSubmit} class="space-y-4 rounded-lg border border-border p-4">
            {/* Plugin ID */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Plugin ID</label>
              <input
                type="text"
                value={formId()}
                onInput={(e) => setFormId(e.currentTarget.value)}
                placeholder="my-awesome-plugin"
                maxLength={50}
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              <p class="mt-1 text-xs text-muted-foreground">
                Lowercase alphanumeric with hyphens (e.g. my-plugin)
              </p>
            </div>

            {/* Name */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Name</label>
              <input
                type="text"
                value={formName()}
                onInput={(e) => setFormName(e.currentTarget.value)}
                placeholder="My Awesome Plugin"
                maxLength={100}
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Description */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Description</label>
              <textarea
                value={formDesc()}
                onInput={(e) => setFormDesc(e.currentTarget.value)}
                placeholder="What does your plugin do? (10-500 characters)"
                maxLength={500}
                rows={3}
                class="w-full resize-none rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Version */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Version</label>
              <input
                type="text"
                value={formVersion()}
                onInput={(e) => setFormVersion(e.currentTarget.value)}
                placeholder="1.0.0"
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Category + Scope row */}
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-foreground">Category</label>
                <select
                  value={formCategory()}
                  onChange={(e) => setFormCategory(e.currentTarget.value)}
                  class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none"
                >
                  <For each={[...CATEGORIES]}>
                    {(cat) => <option value={cat}>{cat}</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-foreground">Scope</label>
                <select
                  value={formScope()}
                  onChange={(e) => setFormScope(e.currentTarget.value)}
                  class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none"
                >
                  <For each={[...SCOPES]}>
                    {(s) => <option value={s}>{s}</option>}
                  </For>
                </select>
              </div>
            </div>

            {/* Docker Image */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Docker Image</label>
              <input
                type="text"
                value={formImage()}
                onInput={(e) => setFormImage(e.currentTarget.value)}
                placeholder="ghcr.io/user/my-plugin:latest"
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Port + Health Check row */}
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-sm font-medium text-foreground">Container Port</label>
                <input
                  type="number"
                  value={formPort()}
                  onInput={(e) => setFormPort(Number(e.currentTarget.value))}
                  min={1}
                  max={65535}
                  class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none"
                />
              </div>
              <div>
                <label class="mb-1 block text-sm font-medium text-foreground">Health Check Path</label>
                <input
                  type="text"
                  value={formHealthCheck()}
                  onInput={(e) => setFormHealthCheck(e.currentTarget.value)}
                  placeholder="/health"
                  class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
                />
              </div>
            </div>

            {/* Repository URL (optional) */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">
                Repository URL <span class="text-muted-foreground">(optional)</span>
              </label>
              <input
                type="text"
                value={formRepo()}
                onInput={(e) => setFormRepo(e.currentTarget.value)}
                placeholder="https://github.com/user/my-plugin"
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Tags */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">
                Tags <span class="text-muted-foreground">(optional, comma-separated)</span>
              </label>
              <input
                type="text"
                value={formTags()}
                onInput={(e) => setFormTags(e.currentTarget.value)}
                placeholder="ai, chatbot, automation"
                class="w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            {/* Permissions */}
            <div>
              <label class="mb-1 block text-sm font-medium text-foreground">Permissions</label>
              <div class="grid grid-cols-2 gap-2">
                <For each={[...PERMISSIONS]}>
                  {(perm) => (
                    <label class="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm text-foreground hover:bg-accent">
                      <input
                        type="checkbox"
                        checked={formPermissions().has(perm)}
                        onChange={() => togglePermission(perm)}
                        class="rounded border-border"
                      />
                      <span class="font-mono text-xs">{perm}</span>
                    </label>
                  )}
                </For>
              </div>
            </div>

            {/* Error message */}
            <Show when={formError()}>
              {(err) => (
                <p class="text-sm text-destructive">{err()}</p>
              )}
            </Show>

            {/* Submit button */}
            <Button type="submit" disabled={submitting()}>
              {submitting() ? "Submitting..." : "Submit for Review"}
            </Button>
          </form>
        </div>
      </Show>
    </div>
  );
};

export default DeveloperSettings;
