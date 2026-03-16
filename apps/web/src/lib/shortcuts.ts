interface Shortcut {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  description: string;
  category?: string;
  handler: () => void;
}

const shortcuts = new Map<string, Shortcut>();

function registerShortcut(id: string, shortcut: Shortcut): void {
  shortcuts.set(id, shortcut);
}

function unregisterShortcut(id: string): void {
  shortcuts.delete(id);
}

function getShortcuts(): Map<string, Shortcut> {
  return shortcuts;
}

const INPUT_TAGS = new Set(["INPUT", "TEXTAREA", "SELECT"]);

function handleKeyDown(e: KeyboardEvent) {
  const target = e.target as HTMLElement;
  if (INPUT_TAGS.has(target.tagName) || target.isContentEditable) return;

  const key = e.key.toLowerCase();
  for (const shortcut of shortcuts.values()) {
    const wantCtrl = shortcut.ctrl ?? false;
    const wantShift = shortcut.shift ?? false;
    const wantAlt = shortcut.alt ?? false;

    // For single non-alphanumeric characters like "?" that require Shift to type,
    // match on e.key directly and skip the strict shiftKey check —
    // shift is implied by the character itself. Only applies to symbols, not letters/digits.
    const isSymbolChar =
      shortcut.key.length === 1 &&
      !wantShift &&
      !wantCtrl &&
      !wantAlt &&
      !/[A-Za-z0-9]/.test(shortcut.key);
    const shiftOk = isSymbolChar ? true : e.shiftKey === wantShift;

    if (
      key === shortcut.key.toLowerCase() &&
      (e.ctrlKey || e.metaKey) === wantCtrl &&
      shiftOk &&
      e.altKey === wantAlt
    ) {
      e.preventDefault();
      shortcut.handler();
      return;
    }
  }
}

let listening = false;

function initShortcutListener(): void {
  if (listening) return;
  listening = true;
  document.addEventListener("keydown", handleKeyDown);
}

function teardownShortcutListener(): void {
  listening = false;
  document.removeEventListener("keydown", handleKeyDown);
}

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardownShortcutListener();
  });
}

export {
  type Shortcut,
  registerShortcut,
  unregisterShortcut,
  getShortcuts,
  initShortcutListener,
  teardownShortcutListener,
};
