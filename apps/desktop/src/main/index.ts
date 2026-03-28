import { app, BrowserWindow, Menu, Tray, ipcMain, nativeImage } from "electron";
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
const WEB_URL = IS_DEV ? "http://localhost:5173" : "https://uncorded.app";
const PRELOAD_PATH = path.join(__dirname, "preload.js");

function createWindow(): BrowserWindow {
  const win = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 800,
    minHeight: 600,
    title: "UnCorded",
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
  // Placeholder icon — real icons go in resources/ before packaging
  const icon = nativeImage.createFromDataURL(
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAQCAYAAAAf8/9hAAAADklEQVQ4jWNgGAWDEwAAAhAAARqjGFoAAAAASUVORK5CYII=",
  );
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

// --- App lifecycle ---

app.on("ready", async () => {
  createAppMenu();
  mainWindow = createWindow();
  tray = createTray();

  setupSidecarIpc();
  setupAutoUpdater();
  setupAutoUpdateIpc(() => sidecar.stop());

  // Spawn sidecar
  await sidecar.start();
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
  tray?.destroy();
  tray = null;
  sidecar.stop().finally(() => {
    app.quit();
  });
});
