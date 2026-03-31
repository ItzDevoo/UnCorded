import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage, session } from "electron";
import path from "node:path";
import { SidecarManager } from "./sidecar.js";
import { setupAutoUpdater, setupAutoUpdateIpc, setIsQuitting, checkForUpdates } from "./auto-update.js";

// Prevent multiple instances
const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
}

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
const sidecar = new SidecarManager();

const IS_DEV = !app.isPackaged;
const WEB_URL = process.env["UNCORDED_WEB_URL"]
  ?? (IS_DEV ? "http://localhost:5173" : "https://uncorded.app");
const PRELOAD_PATH = path.join(__dirname, "preload.cjs");

const RESOURCES_PATH = app.isPackaged
  ? path.join(process.resourcesPath, "resources")
  : path.join(__dirname, "..", "..", "resources");

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "UnCorded",
    icon: path.join(RESOURCES_PATH, "icon.png"),
    show: false,
    webPreferences: {
      preload: PRELOAD_PATH,
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadURL(WEB_URL);

  win.once("ready-to-show", () => {
    win.show();
  });

  // Close to tray instead of quitting
  win.on("close", (e) => {
    if (!isQuitting) {
      e.preventDefault();
      win.hide();
    }
  });

  win.on("closed", () => {
    mainWindow = null;
  });

  return win;
}

function createTray(): Tray {
  const trayIconPath = path.join(RESOURCES_PATH, "tray-icon.png");
  const icon = nativeImage.createFromPath(trayIconPath);
  const t = new Tray(icon);

  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show UnCorded",
      click: () => {
        mainWindow?.show();
        mainWindow?.focus();
      },
    },
    { type: "separator" },
    {
      label: "Check for Updates...",
      click: () => checkForUpdates(),
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        isQuitting = true;
        setIsQuitting(true);
        app.quit();
      },
    },
  ]);

  t.setToolTip("UnCorded");
  t.setContextMenu(contextMenu);

  t.on("double-click", () => {
    mainWindow?.show();
    mainWindow?.focus();
  });

  return t;
}

function createAppMenu(): void {
  const template: Electron.MenuItemConstructorOptions[] = [
    {
      label: "File",
      submenu: [
        { role: "quit" },
      ],
    },
    {
      label: "Edit",
      submenu: [
        { role: "undo" },
        { role: "redo" },
        { type: "separator" },
        { role: "cut" },
        { role: "copy" },
        { role: "paste" },
        { role: "selectAll" },
      ],
    },
    {
      label: "View",
      submenu: [
        { role: "reload" },
        { role: "forceReload" },
        { role: "toggleDevTools" },
        { type: "separator" },
        { role: "resetZoom" },
        { role: "zoomIn" },
        { role: "zoomOut" },
        { type: "separator" },
        { role: "togglefullscreen" },
      ],
    },
    {
      label: "Help",
      submenu: [
        {
          label: "Check for Updates...",
          click: () => checkForUpdates(),
        },
        {
          label: `About UnCorded v${app.getVersion()}`,
          enabled: false,
        },
      ],
    },
  ];

  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

// --- IPC: Sidecar ---

function setupSidecarIpc(): void {
  ipcMain.handle("sidecar:status", () => {
    return { running: sidecar.isRunning(), port: sidecar.getPort() };
  });

  ipcMain.handle("sidecar:port", () => {
    return sidecar.getPort();
  });

  ipcMain.handle("docker:status", () => {
    const port = sidecar.getPort();
    if (!port) return { available: false };
    return { available: true, bridgePort: port };
  });
}

// --- IPC: Plugins ---
// Plugin state is managed by the sidecar's Bridge Server.
// These handlers forward requests to the sidecar HTTP API
// and broadcast state changes to all renderer windows.

// Canonical definition: apps/web/src/stores/plugin-store.ts (PluginInfo)
// Duplicated here because main process and renderer have separate build targets.
interface PluginInfo {
  id: string;
  name: string;
  icon: string | null;
  uiSlot: "content" | "panel";
  header: boolean;
  rightPanel: boolean;
  status: "running" | "stopped" | "crashed" | "starting";
  port: number;
  permissions: string[];
}

let cachedPlugins: PluginInfo[] = [];

// Derive API base URL: explicit env > web URL origin > hardcoded default
const API_URL = process.env["UNCORDED_API_URL"]
  ?? process.env["UNCORDED_WEB_URL"]
  ?? (IS_DEV ? "http://localhost:3000" : "https://uncorded.app");

class PluginManifestError extends Error {
  pluginId: string;
  status: number;
  body: string;

  constructor(pluginId: string, status: number, body: string) {
    super(`Failed to fetch manifest for ${pluginId} (${status}): ${body}`);
    this.name = "PluginManifestError";
    this.pluginId = pluginId;
    this.status = status;
    this.body = body;
  }
}

async function fetchPluginManifest(pluginId: string): Promise<object> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const res = await fetch(`${API_URL}/api/plugins/${pluginId}/manifest`, {
      signal: controller.signal,
    });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new PluginManifestError(pluginId, res.status, body);
    }
    const data = (await res.json()) as { manifest: object };
    return data.manifest;
  } catch (err) {
    if (err instanceof PluginManifestError) throw err;
    if (err instanceof DOMException && err.name === "AbortError") {
      throw new PluginManifestError(pluginId, 0, "Request timed out after 10s");
    }
    throw err;
  } finally {
    clearTimeout(timeout);
  }
}

function broadcastPluginState(): void {
  for (const win of BrowserWindow.getAllWindows()) {
    if (!win.isDestroyed()) {
      win.webContents.send("plugins:state-change", cachedPlugins);
    }
  }
}

async function fetchPluginsFromSidecar(): Promise<PluginInfo[]> {
  const port = sidecar.getPort();
  if (!port) return [];
  try {
    const res = await fetch(`http://localhost:${port}/plugins`);
    if (!res.ok) return [];
    return (await res.json()) as PluginInfo[];
  } catch {
    return [];
  }
}

function setupPluginIpc(): void {
  ipcMain.handle("plugins:get-all", async () => {
    cachedPlugins = await fetchPluginsFromSidecar();
    return cachedPlugins;
  });

  ipcMain.handle("plugins:start", async (_event, pluginId: string, serverId?: string) => {
    const port = sidecar.getPort();
    if (!port) throw new Error("Sidecar not running");

    // Try starting directly
    let res = await fetch(`http://localhost:${port}/plugins/${pluginId}/start`, { method: "POST" });

    // If not installed on sidecar, auto-install then start
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      if (body.includes("not found") || body.includes("not installed")) {
        const manifest = await fetchPluginManifest(pluginId);

        const installRes = await fetch(`http://localhost:${port}/plugins/install`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ manifest, serverId: serverId ?? "default", scope: "server" }),
        });
        if (!installRes.ok) {
          const installBody = await installRes.text().catch(() => "");
          throw new Error(`Plugin install failed (${installRes.status}): ${installBody}`);
        }

        // Now start
        res = await fetch(`http://localhost:${port}/plugins/${pluginId}/start`, { method: "POST" });
        if (!res.ok) {
          const startBody = await res.text().catch(() => "");
          throw new Error(`Plugin start failed after install (${res.status}): ${startBody}`);
        }
      } else {
        throw new Error(`Plugin start failed (${res.status}): ${body}`);
      }
    }

    cachedPlugins = await fetchPluginsFromSidecar();
    broadcastPluginState();
  });

  ipcMain.handle("plugins:stop", async (_event, pluginId: string) => {
    const port = sidecar.getPort();
    if (!port) throw new Error("Sidecar not running");
    const res = await fetch(`http://localhost:${port}/plugins/${pluginId}/stop`, { method: "POST" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Plugin stop failed (${res.status}): ${body}`);
    }
    cachedPlugins = await fetchPluginsFromSidecar();
    broadcastPluginState();
  });

  ipcMain.handle("plugins:restart", async (_event, pluginId: string) => {
    const port = sidecar.getPort();
    if (!port) throw new Error("Sidecar not running");
    const res = await fetch(`http://localhost:${port}/plugins/${pluginId}/restart`, { method: "POST" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Plugin restart failed (${res.status}): ${body}`);
    }
    cachedPlugins = await fetchPluginsFromSidecar();
    broadcastPluginState();
  });

  ipcMain.handle("plugins:uninstall", async (_event, pluginId: string) => {
    const port = sidecar.getPort();
    if (!port) throw new Error("Sidecar not running");
    const res = await fetch(`http://localhost:${port}/plugins/${pluginId}/uninstall`, { method: "POST" });
    if (!res.ok) {
      const body = await res.text().catch(() => "");
      throw new Error(`Plugin uninstall failed (${res.status}): ${body}`);
    }
    cachedPlugins = await fetchPluginsFromSidecar();
    broadcastPluginState();
  });

  ipcMain.handle("plugins:get-permissions", async (_event, pluginId: string) => {
    const port = sidecar.getPort();
    if (!port) return [];
    try {
      const res = await fetch(`http://localhost:${port}/plugins/${pluginId}/permissions`);
      if (!res.ok) return [];
      return (await res.json()) as string[];
    } catch {
      return [];
    }
  });
}

// Poll sidecar for plugin state changes (until we have a push mechanism)
let pluginPollTimer: ReturnType<typeof setInterval> | null = null;

function startPluginPolling(): void {
  if (pluginPollTimer) return;
  pluginPollTimer = setInterval(async () => {
    if (isQuitting) {
      stopPluginPolling();
      return;
    }
    // JSON.stringify comparison is intentional — simple change detection
    // until the sidecar supports a push/event mechanism for state updates.
    const prev = JSON.stringify(cachedPlugins);
    cachedPlugins = await fetchPluginsFromSidecar();
    if (JSON.stringify(cachedPlugins) !== prev) {
      broadcastPluginState();
    }
  }, 3000);
}

function stopPluginPolling(): void {
  if (pluginPollTimer) {
    clearInterval(pluginPollTimer);
    pluginPollTimer = null;
  }
}

// --- Auth: Extract session cookie and forward to sidecar ---

async function syncAuthToSidecar(): Promise<void> {
  const port = sidecar.getPort();
  if (!port) {
    console.log("[auth] Sidecar not ready, skipping auth sync");
    return;
  }

  try {
    // Debug: dump all cookies to see what's available
    const allCookies = await session.defaultSession.cookies.get({});
    console.log("[auth] All cookies:", allCookies.map(c => `${c.name} (${c.domain})`));

    const cookies = await session.defaultSession.cookies.get({
      name: "__Secure-uncorded.session_token",
    });
    console.log("[auth] Session cookies found:", cookies.length);
    const token = cookies[0]?.value;
    if (!token) {
      console.log("[auth] No session token cookie found");
      return;
    }

    console.log("[auth] Forwarding token to sidecar on port", port);
    const res = await fetch(`http://127.0.0.1:${port}/auth`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    console.log("[auth] Sidecar auth response:", res.status);
  } catch (err) {
    console.error("[auth] Failed to sync auth to sidecar:", err);
  }
}

// --- App lifecycle ---

app.on("ready", async () => {
  createAppMenu();
  mainWindow = createWindow();
  tray = createTray();

  setupSidecarIpc();
  setupPluginIpc();
  setupAutoUpdater();
  setupAutoUpdateIpc(() => sidecar.stop());

  // Spawn sidecar
  await sidecar.start();
  startPluginPolling();

  // Forward auth token to sidecar as early as possible
  mainWindow.webContents.on("dom-ready", () => {
    syncAuthToSidecar();
  });

  // Retry shortly after sidecar is ready (cookie may already exist)
  setTimeout(() => syncAuthToSidecar(), 3000);

  // Re-sync when session cookie changes (login/logout)
  session.defaultSession.cookies.on("changed", (_event, cookie, _cause, removed) => {
    if (cookie.name === "__Secure-uncorded.session_token") {
      if (removed) {
        console.log("[auth] Session cookie removed (logout)");
        return;
      }
      console.log("[auth] Session cookie set/changed, forwarding to sidecar");
      const port = sidecar.getPort();
      if (!port) return;
      fetch(`http://127.0.0.1:${port}/auth`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: cookie.value }),
      })
        .then((res) => console.log("[auth] Cookie change forwarded, status:", res.status))
        .catch((err) => console.error("[auth] Cookie change forward failed:", err));
    }
  });
});

app.on("second-instance", () => {
  if (mainWindow) {
    if (mainWindow.isMinimized()) mainWindow.restore();
    mainWindow.show();
    mainWindow.focus();
  }
});

app.on("window-all-closed", () => {
  // On macOS, keep app running in tray
  if (process.platform !== "darwin") {
    // Don't quit — tray keeps us alive
  }
});

app.on("activate", () => {
  // macOS dock click
  if (!mainWindow) {
    mainWindow = createWindow();
  } else {
    mainWindow.show();
  }
});

app.on("before-quit", (e) => {
  if (isQuitting) return; // Guard against re-entry from app.quit() below
  e.preventDefault();
  isQuitting = true;
  setIsQuitting(true);
  stopPluginPolling();
  tray?.destroy();
  tray = null;
  sidecar.stop().finally(() => {
    app.quit();
  });
});
