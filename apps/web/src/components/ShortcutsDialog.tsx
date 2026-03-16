import { For, createMemo } from "solid-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.js";
import { shortcutsDialogOpen, setShortcutsDialogOpen } from "../stores/shortcut-store.js";
import { getShortcuts } from "../lib/shortcuts.js";

function formatKey(shortcut: {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
}): string[] {
  const parts: string[] = [];
  if (shortcut.ctrl) parts.push("Ctrl");
  if (shortcut.shift) parts.push("Shift");
  if (shortcut.alt) parts.push("Alt");

  const key = shortcut.key;
  if (key === "arrowup") parts.push("\u2191");
  else if (key === "arrowdown") parts.push("\u2193");
  else if (key === "/") parts.push("/");
  else if (key === "?") parts.push("?");
  else if (key === "Escape") parts.push("Esc");
  else parts.push(key.toUpperCase());

  return parts;
}

const ShortcutsDialog = () => {
  const grouped = createMemo(() => {
    const map = new Map<string, Array<{ id: string; description: string; keys: string[] }>>();
    const seen = new Set<string>();

    for (const [id, shortcut] of getShortcuts()) {
      // Deduplicate shortcuts with the same description
      if (seen.has(shortcut.description)) continue;
      seen.add(shortcut.description);

      const cat = shortcut.category ?? "Other";
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push({ id, description: shortcut.description, keys: formatKey(shortcut) });
    }
    return map;
  });

  return (
    <Dialog open={shortcutsDialogOpen()} onOpenChange={setShortcutsDialogOpen}>
      <DialogContent onClose={() => setShortcutsDialogOpen(false)} class="max-w-sm">
        <DialogHeader>
          <DialogTitle>Keyboard Shortcuts</DialogTitle>
        </DialogHeader>
        <div class="flex flex-col gap-4">
          <For each={[...grouped()]}>
            {([category, shortcuts]) => (
              <div>
                <h3 class="mb-2 text-xs font-semibold uppercase text-muted-foreground">
                  {category}
                </h3>
                <div class="flex flex-col gap-1.5">
                  <For each={shortcuts}>
                    {(shortcut) => (
                      <div class="flex items-center justify-between rounded px-1 py-1">
                        <span class="text-sm text-foreground">{shortcut.description}</span>
                        <div class="flex items-center gap-1">
                          <For each={shortcut.keys}>
                            {(key) => (
                              <kbd class="rounded bg-input px-1.5 py-0.5 text-xs font-mono text-foreground">
                                {key}
                              </kbd>
                            )}
                          </For>
                        </div>
                      </div>
                    )}
                  </For>
                </div>
              </div>
            )}
          </For>
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default ShortcutsDialog;
