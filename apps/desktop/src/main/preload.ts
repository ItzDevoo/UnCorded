import { contextBridge, ipcRenderer } from "electron";

interface UpdateState {
  enabled: boolean;
  status: string;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null;
  message: string | null;
  errorContext: string | null;
  canRetry: boolean;
}

interface SidecarStatus {
  running: boolean;
  port: number | null;
}

// Canonical definition: apps/web/src/stores/plugin-store.ts (PluginInfo)
// Duplicated here because preload runs in a separate build context.
interface PluginInfo {
  id: string;
  name: string;
  icon: string | null;
  uiSlot: "content" | "panel";
  header: boolean;
  rightPanel: boolean;
  status: "running" | "stopped" | "crashed" | "starting";
  port: number;
  scope: "server" | "personal";
  tunnelUrl: string | null;
  permissions: string[];
}

interface UpdateResult {
  accepted: boolean;
  completed: boolean;
  state: UpdateState;
}

const desktopBridge = {
  // --- Sidecar ---
  getSidecarStatus: (): Promise<SidecarStatus> =>
    ipcRenderer.invoke("sidecar:status"),

  getSidecarPort: (): Promise<number | null> =>
    ipcRenderer.invoke("sidecar:port"),

  getDockerStatus: (): Promise<{ available: boolean; bridgePort?: number }> =>
    ipcRenderer.invoke("docker:status"),

  // --- Plugins ---
  plugins: {
    getAll: (): Promise<PluginInfo[]> =>
      ipcRenderer.invoke("plugins:get-all"),

    onStateChange: (listener: (plugins: PluginInfo[]) => void): (() => void) => {
      const handler = (_event: Electron.IpcRendererEvent, list: PluginInfo[]) => listener(list);
      ipcRenderer.on("plugins:state-change", handler);
      return () => ipcRenderer.removeListener("plugins:state-change", handler);
    },

    start: (pluginId: string): Promise<void> =>
      ipcRenderer.invoke("plugins:start", pluginId),

    stop: (pluginId: string): Promise<void> =>
      ipcRenderer.invoke("plugins:stop", pluginId),

    restart: (pluginId: string): Promise<void> =>
      ipcRenderer.invoke("plugins:restart", pluginId),

    getPermissions: (pluginId: string): Promise<string[]> =>
      ipcRenderer.invoke("plugins:get-permissions", pluginId),

    uninstall: (pluginId: string): Promise<void> =>
      ipcRenderer.invoke("plugins:uninstall", pluginId),
  },

  // --- Auto-update ---
  getUpdateState: (): Promise<UpdateState> =>
    ipcRenderer.invoke("desktop:update-get-state"),

  checkForUpdates: (): Promise<UpdateState> =>
    ipcRenderer.invoke("desktop:update-check"),

  downloadUpdate: (): Promise<UpdateResult> =>
    ipcRenderer.invoke("desktop:update-download"),

  installUpdate: (): Promise<UpdateResult> =>
    ipcRenderer.invoke("desktop:update-install"),

  onUpdateState: (listener: (state: UpdateState) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, state: UpdateState) => listener(state);
    ipcRenderer.on("desktop:update-state", handler);
    return () => ipcRenderer.removeListener("desktop:update-state", handler);
  },

  // --- Sidecar events ---
  onSidecarReady: (listener: (port: number) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, port: number) => listener(port);
    ipcRenderer.on("sidecar:ready", handler);
    return () => ipcRenderer.removeListener("sidecar:ready", handler);
  },

  onSidecarError: (listener: (error: string) => void): (() => void) => {
    const handler = (_event: Electron.IpcRendererEvent, error: string) => listener(error);
    ipcRenderer.on("sidecar:error", handler);
    return () => ipcRenderer.removeListener("sidecar:error", handler);
  },
};

contextBridge.exposeInMainWorld("desktopBridge", desktopBridge);

// Type augmentation for the renderer
declare global {
  interface Window {
    desktopBridge: typeof desktopBridge;
  }
}
