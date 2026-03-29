/**
 * Desktop dev script
 *
 * 1. Build main process with tsdown (watch mode)
 * 2. Wait for compiled output
 * 3. Spawn Electron pointing at the compiled main
 *
 * The renderer loads from Vite dev server (localhost:5173)
 * The sidecar runs directly from source via Bun
 */

import { spawn, type ChildProcess } from "node:child_process";
import { existsSync, watch } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dir, "..");
const DIST = path.join(ROOT, "dist-electron", "main");
const MAIN_JS = path.join(DIST, "index.cjs");

let electronProcess: ChildProcess | null = null;
let restartTimeout: ReturnType<typeof setTimeout> | null = null;

function buildMain(): ChildProcess {
  console.log("[dev] Building main process...");
  return spawn(
    "bunx",
    [
      "tsdown",
      "src/main/index.ts",
      "--out-dir", "dist-electron/main",
      "--format", "cjs",
      "--external", "electron",
      "--watch",
    ],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    },
  );
}

function buildPreload(): ChildProcess {
  console.log("[dev] Building preload script...");
  return spawn(
    "bunx",
    [
      "tsdown",
      "src/main/preload.ts",
      "--out-dir", "dist-electron/main",
      "--format", "cjs",
      "--external", "electron",
      "--watch",
    ],
    {
      cwd: ROOT,
      stdio: "inherit",
      shell: true,
    },
  );
}

function startElectron(): void {
  if (electronProcess) {
    const old = electronProcess;
    electronProcess = null;
    old.once("exit", () => spawnElectron());
    old.kill();
    return;
  }
  spawnElectron();
}

function spawnElectron(): void {

  console.log("[dev] Starting Electron...");
  // Default to live URL unless UNCORDED_LOCAL=1 is set (for local web dev)
  const useLocal = process.env["UNCORDED_LOCAL"] === "1";
  const webUrl = useLocal ? "http://localhost:5173" : "https://uncorded.app";
  console.log(`[dev] Loading web app from: ${webUrl}`);

  electronProcess = spawn(
    "bunx",
    ["electron", "."],
    {
      cwd: ROOT,
      stdio: "inherit",
      env: {
        ...process.env,
        NODE_ENV: "development",
        UNCORDED_WEB_URL: webUrl,
        UNCORDED_API_URL: process.env["UNCORDED_API_URL"] ?? webUrl,
      },
      shell: true,
    },
  );

  electronProcess.on("exit", (code) => {
    console.log(`[dev] Electron exited (code=${code})`);
    if (code !== null && code !== 0) {
      console.log("[dev] Electron crashed — will restart on next file change");
    } else {
      process.exit(0);
    }
  });
}

function debounceRestart(): void {
  if (restartTimeout) clearTimeout(restartTimeout);
  restartTimeout = setTimeout(() => {
    console.log("[dev] Main process changed, restarting Electron...");
    startElectron();
  }, 500);
}

// Start both builds in watch mode
const mainBuilder = buildMain();
const preloadBuilder = buildPreload();

// Wait for initial build, then start Electron
const waitForBuild = setInterval(() => {
  if (existsSync(MAIN_JS)) {
    clearInterval(waitForBuild);
    startElectron();

    // Watch for rebuilds and restart Electron
    watch(DIST, { recursive: true }, (_event, filename) => {
      if (filename?.endsWith(".cjs") || filename?.endsWith(".js")) {
        debounceRestart();
      }
    });
  }
}, 500);

// Clean up on exit
function cleanup() {
  mainBuilder.kill();
  preloadBuilder.kill();
  electronProcess?.kill();
  process.exit(0);
}

process.on("SIGINT", cleanup);
process.on("SIGTERM", cleanup);
