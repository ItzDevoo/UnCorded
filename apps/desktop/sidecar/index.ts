import { startBridgeServer } from "./bridge/server";
import { DockerManager } from "./docker/manager";
import { GatewayClient } from "./gateway/client";
import { SeedingEngine } from "./seeding/engine";
import { PluginLifecycle } from "./plugins/lifecycle";
import { checkForUpdates, applyAutoUpdates, type UpdateInfo } from "./plugins/update-checker";
import { TunnelManager } from "./tunnel/manager";
import path from "node:path";
import fs from "node:fs";

// --- Data directory ---

const DATA_DIR = process.env["UNCORDED_DATA_DIR"] ?? path.join(process.cwd(), "sidecar-data");
fs.mkdirSync(DATA_DIR, { recursive: true });

// --- Initialize services ---

const docker = new DockerManager(DATA_DIR);
const gateway = new GatewayClient();
const seeding = new SeedingEngine(DATA_DIR);
const tunnelManager = new TunnelManager(DATA_DIR);
const plugins = new PluginLifecycle(docker, DATA_DIR, tunnelManager);

// --- Start Bridge Server ---

const bridge = await startBridgeServer({ docker, gateway, plugins, port: 0 });

// Tell lifecycle manager what port the bridge is on
plugins.setBridgePort(bridge.port);

// Print ready message for Electron to read
console.log(JSON.stringify({ type: "ready", port: bridge.port }));

// --- Connect to gateway (if token is configured) ---

const tokenPath = path.join(DATA_DIR, "gateway-token.txt");
if (fs.existsSync(tokenPath)) {
  const token = fs.readFileSync(tokenPath, "utf-8").trim();
  if (token) {
    plugins.setApiToken(token);
    await gateway.connect(token);
  }
}

// --- Resume seeding ---

await seeding.resume();

// --- Resume plugins that were previously running ---

await plugins.resumeAll();

// --- Check for plugin updates (async, non-blocking) ---

export let pendingMajorUpdates: UpdateInfo[] = [];

export function removePendingUpdate(pluginId: string): UpdateInfo | undefined {
  const idx = pendingMajorUpdates.findIndex((u) => u.pluginId === pluginId);
  if (idx === -1) return undefined;
  const [removed] = pendingMajorUpdates.splice(idx, 1);
  return removed;
}

export function reinsertPendingUpdate(update: UpdateInfo): void {
  if (!pendingMajorUpdates.some((u) => u.pluginId === update.pluginId)) {
    pendingMajorUpdates.push(update);
  }
}

let updateCheckRunning = false;

export async function runUpdateCheck(): Promise<void> {
  const apiBaseUrl = plugins.getApiBaseUrl();
  const apiToken = plugins.getApiToken();
  if (!apiBaseUrl || !apiToken) return;
  if (updateCheckRunning) return;
  updateCheckRunning = true;

  try {
    const updates = await checkForUpdates(plugins, apiBaseUrl, apiToken);
    const autoUpdates = updates.filter((u) => u.updateType !== "major");
    const majorUpdates = updates.filter((u) => u.updateType === "major");

    if (autoUpdates.length > 0) {
      const result = await applyAutoUpdates(plugins, autoUpdates);
      if (result.applied.length > 0) {
        console.error(`[update-checker] Auto-updated: ${result.applied.join(", ")}`);
      }
      if (result.skipped.length > 0) {
        console.error(`[update-checker] Skipped: ${result.skipped.join(", ")}`);
      }
    }

    pendingMajorUpdates = majorUpdates;
    if (majorUpdates.length > 0) {
      console.error(`[update-checker] Major updates available: ${majorUpdates.map((u) => `${u.pluginId}@${u.availableVersion}`).join(", ")}`);
    }
  } catch (err) {
    console.error("[update-checker] Update check failed:", err);
  } finally {
    updateCheckRunning = false;
  }
}

// Run immediately if token is already available (e.g. from gateway-token.txt)
runUpdateCheck();

// --- Graceful shutdown ---

async function shutdown(): Promise<void> {
  console.error("[sidecar] Shutting down...");

  await plugins.stopAll();
  await tunnelManager.destroyAll();
  gateway.destroy();
  await seeding.shutdown();
  await bridge.stop();

  console.error("[sidecar] Shutdown complete");
  process.exit(0);
}

process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
