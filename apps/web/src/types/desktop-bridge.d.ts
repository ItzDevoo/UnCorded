import type { PluginInfo } from "../stores/plugin-store.js";

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

interface UpdateResult {
  accepted: boolean;
  completed: boolean;
  state: UpdateState;
}

interface DesktopBridgePlugins {
  getAll(): Promise<PluginInfo[]>;
  onStateChange(listener: (plugins: PluginInfo[]) => void): () => void;
  start(pluginId: string, serverId?: string): Promise<void>;
  stop(pluginId: string): Promise<void>;
  restart(pluginId: string): Promise<void>;
  getPermissions(pluginId: string): Promise<string[]>;
  uninstall(pluginId: string): Promise<void>;
}

interface DesktopBridgeMenu {
  reload(): Promise<void>;
  forceReload(): Promise<void>;
  toggleDevTools(): Promise<void>;
  zoomIn(): Promise<void>;
  zoomOut(): Promise<void>;
  resetZoom(): Promise<void>;
  toggleFullscreen(): Promise<void>;
  checkUpdates(): Promise<void>;
  getVersion(): Promise<string>;
}

interface DesktopBridge {
  getSidecarStatus(): Promise<{ running: boolean; port: number | null }>;
  getSidecarPort(): Promise<number | null>;
  getDockerStatus(): Promise<{ available: boolean; bridgePort?: number }>;
  plugins: DesktopBridgePlugins;
  minimize(): Promise<void>;
  maximize(): Promise<void>;
  close(): Promise<void>;
  isMaximized(): Promise<boolean>;
  onMaximizeChange(listener: (maximized: boolean) => void): () => void;
  menu: DesktopBridgeMenu;
  getUpdateState(): Promise<UpdateState>;
  checkForUpdates(): Promise<UpdateState>;
  downloadUpdate(): Promise<UpdateResult>;
  installUpdate(): Promise<UpdateResult>;
  onUpdateState(listener: (state: UpdateState) => void): () => void;
  onSidecarReady(listener: (port: number) => void): () => void;
  onSidecarError(listener: (error: string) => void): () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export {};
