import { startBridgeServer } from "./bridge/server";
import { DockerManager } from "./docker/manager";
import { GatewayClient } from "./gateway/client";
import { SeedingEngine } from "./seeding/engine";
import { PluginLifecycle } from "./plugins/lifecycle";
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
