import type { PluginInfo } from "../stores/plugin-store.js";

interface DesktopBridgePlugins {
  getAll(): Promise<PluginInfo[]>;
  onStateChange(listener: (plugins: PluginInfo[]) => void): () => void;
  start(pluginId: string, serverId?: string): Promise<void>;
  stop(pluginId: string): Promise<void>;
  restart(pluginId: string): Promise<void>;
  getPermissions(pluginId: string): Promise<string[]>;
  uninstall(pluginId: string): Promise<void>;
}

interface DesktopBridge {
  getSidecarStatus(): Promise<{ running: boolean; port: number | null }>;
  getSidecarPort(): Promise<number | null>;
  getDockerStatus(): Promise<{ available: boolean; bridgePort?: number }>;
  plugins: DesktopBridgePlugins;
  getUpdateState(): Promise<unknown>;
  checkForUpdates(): Promise<unknown>;
  downloadUpdate(): Promise<unknown>;
  installUpdate(): Promise<unknown>;
  onUpdateState(listener: (state: unknown) => void): () => void;
  onSidecarReady(listener: (port: number) => void): () => void;
  onSidecarError(listener: (error: string) => void): () => void;
}

declare global {
  interface Window {
    desktopBridge?: DesktopBridge;
  }
}

export {};
