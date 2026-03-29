import { createSignal, onMount, Show, For } from "solid-js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { Button } from "../components/ui/button.js";
import { Badge } from "../components/ui/badge.js";
import { Input } from "../components/ui/input.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../components/ui/dialog.js";
import { DataTable, type Column } from "../components/DataTable.js";

// ── Types ──────────────────────────────────────────────────────────────────

interface PluginRow {
  id: string;
  name: string;
  description: string;
  author: string;
  iconUrl: string | null;
  category: string;
  scope: string;
  tags: string[];
  image: string;
  version: string;
  repository: string | null;
  verified: boolean;
  featured: boolean;
  downloads: number;
  published: boolean;
  createdAt: string;
  updatedAt: string;
}

interface PluginsResponse {
  plugins: PluginRow[];
  total: number;
  page: number;
  pageSize: number;
}

const CATEGORY_OPTIONS = ["AI", "Collaboration", "Developer Tools", "Automation", "Appearance", "Moderation", "Other"] as const;
const SCOPE_OPTIONS = ["server", "personal", "both"] as const;

// ── Component ──────────────────────────────────────────────────────────────

const AdminPlugins = () => {
  const [data, setData] = createSignal<PluginsResponse>({
    plugins: [],
    total: 0,
    page: 1,
    pageSize: 50,
  });
  const [loading, setLoading] = createSignal(true);
  const [pendingId, setPendingId] = createSignal<string | null>(null);

  // Form modal
  const [formOpen, setFormOpen] = createSignal(false);
  const [editTarget, setEditTarget] = createSignal<PluginRow | null>(null);
  const [formSubmitting, setFormSubmitting] = createSignal(false);

  // Form fields
  const [formId, setFormId] = createSignal("");
  const [formName, setFormName] = createSignal("");
  const [formDescription, setFormDescription] = createSignal("");
  const [formAuthor, setFormAuthor] = createSignal("");
  const [formCategory, setFormCategory] = createSignal("Other");
  const [formScope, setFormScope] = createSignal<string>("server");
  const [formTags, setFormTags] = createSignal("");
  const [formImage, setFormImage] = createSignal("");
  const [formVersion, setFormVersion] = createSignal("1.0.0");
  const [formManifest, setFormManifest] = createSignal("");
  const [formRepository, setFormRepository] = createSignal("");
  const [formScreenshots, setFormScreenshots] = createSignal("");

  let fetchCounter = 0;
  let searchQuery = "";

  async function fetchPlugins(page: number) {
    const id = ++fetchCounter;
    setLoading(true);
    try {
      const params = new URLSearchParams({ page: String(page) });
      if (searchQuery) params.set("search", searchQuery);
      const res = await api<PluginsResponse>(`/api/admin/plugins?${params}`);
      if (id !== fetchCounter) return;
      setData(res);
    } catch {
      if (id !== fetchCounter) return;
      showToast("Failed to load plugins", "error");
    } finally {
      if (id === fetchCounter) setLoading(false);
    }
  }

  onMount(() => fetchPlugins(1));

  function handleSearch(query: string) {
    searchQuery = query;
    fetchPlugins(1);
  }

  function slugify(name: string): string {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "");
  }

  function openAddForm() {
    setEditTarget(null);
    setFormId("");
    setFormName("");
    setFormDescription("");
    setFormAuthor("UnCorded");
    setFormCategory("Other");
    setFormScope("server");
    setFormTags("");
    setFormImage("");
    setFormVersion("1.0.0");
    setFormManifest("");
    setFormRepository("");
    setFormScreenshots("");
    setFormOpen(true);
  }

  function openEditForm(row: PluginRow) {
    setEditTarget(row);
    setFormId(row.id);
    setFormName(row.name);
    setFormDescription(row.description);
    setFormAuthor(row.author);
    setFormCategory(row.category);
    setFormScope(row.scope);
    setFormTags(row.tags.join(", "));
    setFormImage(row.image);
    setFormVersion(row.version);
    setFormManifest(""); // Don't pre-fill manifest JSON — too large
    setFormRepository(row.repository ?? "");
    setFormScreenshots("");
    setFormOpen(true);
  }

  async function submitForm() {
    if (formSubmitting()) return;
    setFormSubmitting(true);

    const tags = formTags()
      .split(",")
      .map((t) => t.trim())
      .filter(Boolean);

    const screenshots = formScreenshots()
      .split("\n")
      .map((s) => s.trim())
      .filter(Boolean);

    try {
      if (editTarget()) {
        // Update
        const body: Record<string, unknown> = {
          name: formName(),
          description: formDescription(),
          author: formAuthor(),
          category: formCategory(),
          scope: formScope(),
          tags,
          image: formImage(),
          version: formVersion(),
          repository: formRepository() || null,
        };
        if (screenshots.length > 0) body.screenshots = screenshots;
        if (formManifest().trim()) {
          body.manifest = JSON.parse(formManifest());
        }

        await api(`/api/admin/plugins/${editTarget()!.id}`, {
          method: "PUT",
          body: JSON.stringify(body),
        });
        showToast("Plugin updated", "info");
      } else {
        // Create — manifest is required
        let manifest: Record<string, unknown>;
        if (formManifest().trim()) {
          manifest = JSON.parse(formManifest()) as Record<string, unknown>;
        } else {
          // Auto-build minimal manifest from form fields
          manifest = {
            id: formId() || slugify(formName()),
            name: formName(),
            version: formVersion(),
            description: formDescription(),
            author: formAuthor(),
            scope: formScope(),
            runtime: { image: formImage(), port: 3000, healthCheck: "/health" },
            permissions: [],
            ui: { type: "panel" },
          };
        }

        await api("/api/admin/plugins", {
          method: "POST",
          body: JSON.stringify({
            id: formId() || slugify(formName()),
            name: formName(),
            description: formDescription(),
            author: formAuthor(),
            category: formCategory(),
            scope: formScope(),
            tags,
            image: formImage(),
            version: formVersion(),
            manifest,
            repository: formRepository() || null,
            screenshots,
          }),
        });
        showToast("Plugin created", "info");
      }
      setFormOpen(false);
      await fetchPlugins(data().page);
    } catch (err) {
      if (err instanceof SyntaxError) {
        showToast("Invalid JSON in manifest field", "error");
      } else {
        const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
        showToast(msg, "error");
      }
    } finally {
      setFormSubmitting(false);
    }
  }

  async function toggleField(pluginId: string, field: "publish" | "verify" | "feature") {
    if (pendingId() === pluginId) return;
    setPendingId(pluginId);
    try {
      await api(`/api/admin/plugins/${pluginId}/${field}`, { method: "PATCH" });
      showToast(`Plugin ${field} toggled`, "info");
      await fetchPlugins(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    } finally {
      setPendingId(null);
    }
  }

  async function deletePlugin(pluginId: string, name: string) {
    if (!window.confirm(`Delete "${name}"? This will also remove all installations.`)) return;
    try {
      await api(`/api/admin/plugins/${pluginId}`, { method: "DELETE" });
      showToast("Plugin deleted", "info");
      await fetchPlugins(data().page);
    } catch (err) {
      const msg = err instanceof ApiRequestError ? err.body.message : "Action failed";
      showToast(msg, "error");
    }
  }

  const columns: Column<PluginRow>[] = [
    {
      header: "Plugin",
      accessor: (row) => (
        <div class="max-w-xs">
          <p class="truncate text-sm font-medium">{row.name}</p>
          <p class="text-xs text-muted-foreground">{row.id}</p>
        </div>
      ),
    },
    {
      header: "Author",
      accessor: (row) => <span class="text-sm">{row.author}</span>,
    },
    {
      header: "Category",
      accessor: (row) => <Badge variant="outline">{row.category}</Badge>,
    },
    {
      header: "Scope",
      accessor: (row) => <Badge variant="info">{row.scope}</Badge>,
    },
    {
      header: "Version",
      accessor: (row) => <span class="font-mono text-xs">{row.version}</span>,
    },
    {
      header: "Downloads",
      accessor: (row) => <span class="tabular-nums text-sm">{row.downloads}</span>,
    },
    {
      header: "Status",
      accessor: (row) => (
        <div class="flex gap-1" onClick={(e) => e.stopPropagation()}>
          <button
            class={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              row.published
                ? "bg-success/15 text-success"
                : "text-muted-foreground hover:bg-accent"
            } ${pendingId() === row.id ? "pointer-events-none opacity-50" : ""}`}
            onClick={() => toggleField(row.id, "publish")}
            title={row.published ? "Unpublish" : "Publish"}
          >
            {row.published ? "Published" : "Draft"}
          </button>
          <button
            class={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              row.verified
                ? "bg-primary/15 text-primary"
                : "text-muted-foreground hover:bg-accent"
            } ${pendingId() === row.id ? "pointer-events-none opacity-50" : ""}`}
            onClick={() => toggleField(row.id, "verify")}
            title={row.verified ? "Unverify" : "Verify"}
          >
            {row.verified ? "Verified" : "Unverified"}
          </button>
          <button
            class={`rounded px-1.5 py-0.5 text-[10px] font-medium transition-colors ${
              row.featured
                ? "bg-warning/15 text-warning"
                : "text-muted-foreground hover:bg-accent"
            } ${pendingId() === row.id ? "pointer-events-none opacity-50" : ""}`}
            onClick={() => toggleField(row.id, "feature")}
            title={row.featured ? "Unfeature" : "Feature"}
          >
            {row.featured ? "Featured" : "Normal"}
          </button>
        </div>
      ),
    },
    {
      header: "",
      accessor: (row) => (
        <div class="flex justify-end gap-2" onClick={(e) => e.stopPropagation()}>
          <Button variant="outline" size="sm" onClick={() => openEditForm(row)}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" class="text-destructive" onClick={() => deletePlugin(row.id, row.name)}>
            Delete
          </Button>
        </div>
      ),
      class: "text-right",
    },
  ];

  return (
    <div>
      <h1 class="mb-6 text-xl font-semibold">Plugins</h1>

      <DataTable
        columns={columns}
        data={data().plugins}
        total={data().total}
        page={data().page}
        pageSize={data().pageSize}
        onPageChange={(p) => fetchPlugins(p)}
        onSearch={handleSearch}
        searchPlaceholder="Search plugins..."
        loading={loading()}
        actions={
          <Button size="sm" onClick={openAddForm}>
            Add Plugin
          </Button>
        }
        expandRow={(row) => (
          <div class="space-y-3 text-xs">
            <div>
              <p class="text-muted-foreground">Description</p>
              <p class="mt-1 whitespace-pre-wrap text-sm">{row.description}</p>
            </div>
            <div class="flex flex-wrap gap-6 text-muted-foreground">
              <span>Image: <span class="font-mono text-foreground">{row.image}</span></span>
              <Show when={row.repository}>
                <span>Repo: <span class="font-mono text-foreground">{row.repository}</span></span>
              </Show>
              <span>Created: {new Date(row.createdAt).toLocaleString()}</span>
              <span>Updated: {new Date(row.updatedAt).toLocaleString()}</span>
            </div>
            <Show when={row.tags.length > 0}>
              <div class="flex flex-wrap gap-1">
                <For each={row.tags}>
                  {(tag) => <Badge variant="outline">{tag}</Badge>}
                </For>
              </div>
            </Show>
          </div>
        )}
      />

      {/* Add/Edit Plugin Modal */}
      <Dialog open={formOpen()} onOpenChange={setFormOpen}>
        <DialogContent class="max-w-lg" onClose={() => setFormOpen(false)}>
          <DialogHeader>
            <DialogTitle>{editTarget() ? "Edit Plugin" : "Add Plugin"}</DialogTitle>
            <DialogDescription>
              {editTarget() ? `Editing ${editTarget()!.name}` : "Register a new plugin in the catalog"}
            </DialogDescription>
          </DialogHeader>

          <div class="space-y-3">
            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">Name</label>
                <Input
                  value={formName()}
                  onInput={(e) => {
                    setFormName(e.currentTarget.value);
                    if (!editTarget()) setFormId(slugify(e.currentTarget.value));
                  }}
                  placeholder="My Plugin"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">ID</label>
                <Input
                  value={formId()}
                  onInput={(e) => setFormId(e.currentTarget.value)}
                  placeholder="my-plugin"
                  disabled={!!editTarget()}
                />
              </div>
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Description</label>
              <textarea
                value={formDescription()}
                onInput={(e) => setFormDescription(e.currentTarget.value)}
                placeholder="What does this plugin do?"
                rows={2}
                class="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div class="grid grid-cols-2 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">Author</label>
                <Input
                  value={formAuthor()}
                  onInput={(e) => setFormAuthor(e.currentTarget.value)}
                  placeholder="UnCorded"
                />
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">Docker Image</label>
                <Input
                  value={formImage()}
                  onInput={(e) => setFormImage(e.currentTarget.value)}
                  placeholder="my-plugin:latest"
                />
              </div>
            </div>

            <div class="grid grid-cols-3 gap-3">
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">Category</label>
                <select
                  value={formCategory()}
                  onChange={(e) => setFormCategory(e.currentTarget.value)}
                  class="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                >
                  <For each={CATEGORY_OPTIONS}>
                    {(c) => <option value={c}>{c}</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">Scope</label>
                <select
                  value={formScope()}
                  onChange={(e) => setFormScope(e.currentTarget.value)}
                  class="w-full rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none"
                >
                  <For each={SCOPE_OPTIONS}>
                    {(s) => <option value={s}>{s}</option>}
                  </For>
                </select>
              </div>
              <div>
                <label class="mb-1 block text-xs font-medium text-muted-foreground">Version</label>
                <Input
                  value={formVersion()}
                  onInput={(e) => setFormVersion(e.currentTarget.value)}
                  placeholder="1.0.0"
                />
              </div>
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Tags (comma-separated)</label>
              <Input
                value={formTags()}
                onInput={(e) => setFormTags(e.currentTarget.value)}
                placeholder="ai, automation, tools"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">
                Manifest JSON {editTarget() ? "(leave empty to keep current)" : "(leave empty to auto-generate)"}
              </label>
              <textarea
                value={formManifest()}
                onInput={(e) => setFormManifest(e.currentTarget.value)}
                placeholder='{"id": "my-plugin", ...}'
                rows={4}
                class="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 font-mono text-xs text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Repository URL</label>
              <Input
                value={formRepository()}
                onInput={(e) => setFormRepository(e.currentTarget.value)}
                placeholder="https://github.com/..."
              />
            </div>

            <div>
              <label class="mb-1 block text-xs font-medium text-muted-foreground">Screenshot URLs (one per line)</label>
              <textarea
                value={formScreenshots()}
                onInput={(e) => setFormScreenshots(e.currentTarget.value)}
                placeholder="https://..."
                rows={2}
                class="w-full resize-none rounded-lg border border-border bg-input px-3 py-2 text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="ghost" onClick={() => setFormOpen(false)}>
              Cancel
            </Button>
            <Button onClick={submitForm} disabled={formSubmitting()}>
              {formSubmitting() ? "Saving..." : editTarget() ? "Update" : "Create"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default AdminPlugins;
