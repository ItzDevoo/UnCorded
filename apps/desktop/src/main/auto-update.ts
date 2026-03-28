import { autoUpdater } from "electron-updater";
import { app, BrowserWindow, ipcMain } from "electron";

// --- State types ---

type UpdateStatus =
  | "disabled"
  | "idle"
  | "checking"
  | "up-to-date"
  | "available"
  | "downloading"
  | "downloaded"
  | "error";

interface UpdateState {
  enabled: boolean;
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}

// --- Constants ---

const AUTO_UPDATE_STARTUP_DELAY_MS = 15_000;
const AUTO_UPDATE_POLL_INTERVAL_MS = 4 * 60 * 60 * 1000;

// --- State ---

let updateState: UpdateState = {
  enabled: false,
  status: "idle",
  currentVersion: app.getVersion(),
  availableVersion: null,
  downloadedVersion: null,
  downloadPercent: null,
  checkedAt: null,
  message: null,
  errorContext: null,
  canRetry: false,
};

let isQuitting = false;

// --- Disabled check ---

function getDisabledReason(): string | null {
  if (process.env["UNCORDED_DISABLE_AUTO_UPDATE"] === "1") {
    return "Disabled by environment variable";
  }
  if (!app.isPackaged) {
    return "Auto-update not available in development";
  }
  if (process.platform === "linux" && !process.env["APPIMAGE"]) {
    return "Auto-update requires AppImage format";
  }
  return null;
}

// --- Pure reducers ---

function reduceOnCheckStart(state: UpdateState): UpdateState {
  return { ...state, status: "checking", canRetry: false, message: null, errorContext: null };
}

function reduceOnCheckFailure(state: UpdateState, error: string): UpdateState {
  return { ...state, status: "error", errorContext: "check", canRetry: true, message: error };
}

function reduceOnUpdateAvailable(state: UpdateState, version: string): UpdateState {
  return { ...state, status: "available", availableVersion: version, checkedAt: new Date().toISOString(), message: null, errorContext: null };
}

function reduceOnNoUpdate(state: UpdateState): UpdateState {
  return { ...state, status: "up-to-date", availableVersion: null, downloadedVersion: null, checkedAt: new Date().toISOString(), message: null, errorContext: null };
}

function reduceOnDownloadStart(state: UpdateState): UpdateState {
  return { ...state, status: "downloading", downloadPercent: 0, message: null, errorContext: null };
}

function reduceOnDownloadProgress(state: UpdateState, percent: number): UpdateState {
  return { ...state, status: "downloading", downloadPercent: percent };
}

function reduceOnDownloadFailure(state: UpdateState, error: string): UpdateState {
  return {
    ...state,
    status: state.availableVersion ? "available" : "error",
    errorContext: "download",
    canRetry: state.availableVersion !== null,
    message: error,
  };
}

function reduceOnDownloadComplete(state: UpdateState, version: string): UpdateState {
  return {
    ...state,
    status: "downloaded",
    downloadedVersion: version,
    downloadPercent: 100,
    canRetry: true,
    message: null,
    errorContext: null,
  };
}

function reduceOnInstallFailure(state: UpdateState, error: string): UpdateState {
  return {
    ...state,
    status: "downloaded",
    errorContext: "install",
    canRetry: true,
    message: error,
  };
}

// --- Progress throttling ---

function shouldBroadcastProgress(oldPercent: number | null, newPercent: number): boolean {
  if (newPercent >= 100) return true;
  const oldBucket = oldPercent === null ? -1 : Math.floor(oldPercent / 10);
  const newBucket = Math.floor(newPercent / 10);
  return newBucket > oldBucket;
}

// --- Broadcast to all windows ---

function broadcastState(): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("desktop:update-state", updateState);
    }
  }
}

// --- Check for updates ---

export function checkForUpdates(): void {
  if (!updateState.enabled || updateState.status === "checking" || updateState.status === "downloading") {
    return;
  }
  updateState = reduceOnCheckStart(updateState);
  broadcastState();
  autoUpdater.checkForUpdates().catch((err: Error) => {
    updateState = reduceOnCheckFailure(updateState, err.message);
    broadcastState();
  });
}

// --- Public API ---

export function getUpdateState(): UpdateState {
  return updateState;
}

export function setIsQuitting(value: boolean): void {
  isQuitting = value;
}

export function setupAutoUpdater(): void {
  const disabledReason = getDisabledReason();
  if (disabledReason) {
    updateState = { ...updateState, enabled: false, status: "disabled", message: disabledReason };
    return;
  }

  updateState = { ...updateState, enabled: true, status: "idle" };

  // Configure
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = false;
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "ItzDevoo",
    repo: "UnCorded",
    releaseType: "release",
  });

  // Event handlers
  autoUpdater.on("update-available", (info) => {
    updateState = reduceOnUpdateAvailable(updateState, info.version);
    broadcastState();
  });

  autoUpdater.on("update-not-available", () => {
    updateState = reduceOnNoUpdate(updateState);
    broadcastState();
  });

  autoUpdater.on("download-progress", (progress) => {
    if (shouldBroadcastProgress(updateState.downloadPercent, progress.percent)) {
      updateState = reduceOnDownloadProgress(updateState, progress.percent);
      broadcastState();
    }
  });

  autoUpdater.on("update-downloaded", (info) => {
    updateState = reduceOnDownloadComplete(updateState, info.version);
    broadcastState();
  });

  autoUpdater.on("error", (error) => {
    if (updateState.status === "checking") {
      updateState = reduceOnCheckFailure(updateState, error.message);
    } else if (updateState.status === "downloading") {
      updateState = reduceOnDownloadFailure(updateState, error.message);
    }
    broadcastState();
  });

  // Schedule checks
  setTimeout(() => checkForUpdates(), AUTO_UPDATE_STARTUP_DELAY_MS);
  setInterval(() => checkForUpdates(), AUTO_UPDATE_POLL_INTERVAL_MS);
}

export function setupAutoUpdateIpc(stopSidecar: () => Promise<void>): void {
  ipcMain.handle("desktop:update-get-state", () => {
    return updateState;
  });

  ipcMain.handle("desktop:update-check", () => {
    checkForUpdates();
    return updateState;
  });

  ipcMain.handle("desktop:update-download", async () => {
    if (updateState.status !== "available") {
      return { accepted: false, completed: false, state: updateState };
    }
    updateState = reduceOnDownloadStart(updateState);
    broadcastState();
    try {
      await autoUpdater.downloadUpdate();
      return { accepted: true, completed: true, state: updateState };
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Download failed";
      updateState = reduceOnDownloadFailure(updateState, msg);
      broadcastState();
      return { accepted: true, completed: false, state: updateState };
    }
  });

  ipcMain.handle("desktop:update-install", async () => {
    if (updateState.status !== "downloaded" || isQuitting) {
      return { accepted: false, completed: false, state: updateState };
    }
    isQuitting = true;

    try {
      await stopSidecar();
      autoUpdater.quitAndInstall();
      return { accepted: true, completed: true, state: updateState };
    } catch (err) {
      isQuitting = false;
      const msg = err instanceof Error ? err.message : "Install failed";
      updateState = reduceOnInstallFailure(updateState, msg);
      broadcastState();
      return { accepted: true, completed: false, state: updateState };
    }
  });
}
