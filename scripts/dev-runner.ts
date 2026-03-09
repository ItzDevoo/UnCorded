/**
 * UnCorded Dev Runner — interactive TUI for parallel server + web development.
 *
 * Features:
 * - Port availability check before spawning (fail fast)
 * - Startup banner with port assignments and process status
 * - Color-coded interleaved log output with error highlighting
 * - Keyboard shortcuts: q quit, c clear, 1/2 filter, a/0 show all
 * - Clean shutdown on Ctrl+C
 *
 * Usage: bun run scripts/dev-runner.ts
 */

import { createServer } from "node:net";

// ── ANSI codes ──────────────────────────────────────────────────────────────

const RESET = "\x1b[0m";
const BOLD = "\x1b[1m";
const DIM = "\x1b[2m";
const RED = "\x1b[31m";
const GREEN = "\x1b[32m";
const YELLOW = "\x1b[33m";
const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const BG_RED = "\x1b[41m";
const WHITE = "\x1b[37m";

// ── Port checking ───────────────────────────────────────────────────────────

const BASE_SERVER_PORT = 3000;
const BASE_WEB_PORT = 5173;

function checkPort(port: number, host: string): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.unref();
    server.once("error", (err: NodeJS.ErrnoException) => {
      // EADDRNOTAVAIL = IPv6 not present on this host, treat as available
      resolve(err.code === "EADDRNOTAVAIL");
    });
    server.once("listening", () => {
      server.close(() => resolve(true));
    });
    server.listen({ port, host });
  });
}

async function isPortAvailable(port: number): Promise<boolean> {
  const [ipv4, ipv6] = await Promise.all([
    checkPort(port, "127.0.0.1"),
    checkPort(port, "::1"),
  ]);
  return ipv4 && ipv6;
}

function resolvePortOffset(): number {
  const raw = process.env.UNCORDED_PORT_OFFSET;
  if (!raw) return 0;
  const offset = parseInt(raw, 10);
  if (Number.isNaN(offset) || offset < 0) {
    console.error(`${RED}Invalid UNCORDED_PORT_OFFSET: "${raw}" — must be a non-negative integer${RESET}`);
    process.exit(1);
  }
  return offset;
}

async function ensurePortsAvailable(serverPort: number, webPort: number): Promise<void> {
  const [serverOk, webOk] = await Promise.all([
    isPortAvailable(serverPort),
    isPortAvailable(webPort),
  ]);

  const errors: string[] = [];
  if (!serverOk) errors.push(`  Port ${serverPort} (server) is already in use`);
  if (!webOk) errors.push(`  Port ${webPort} (web) is already in use`);

  if (errors.length > 0) {
    console.error(`\n${RED}${BOLD}Port conflict — cannot start dev environment${RESET}\n`);
    for (const e of errors) console.error(`${RED}${e}${RESET}`);
    console.error(`\n${DIM}Kill the process using the port, or set UNCORDED_PORT_OFFSET=N to use different ports.${RESET}\n`);
    process.exit(1);
  }
}

// ── Process types ───────────────────────────────────────────────────────────

type ProcessStatus = "starting" | "running" | "crashed" | "stopped";

interface ServiceConfig {
  name: string;
  filter: string;
  port: number;
  color: string;
  label: string;
}

interface ManagedProcess {
  config: ServiceConfig;
  status: ProcessStatus;
  proc: ReturnType<typeof Bun.spawn> | null;
  exitCode: number | null;
}

// ── TUI rendering ───────────────────────────────────────────────────────────

const STATUS_ICONS: Record<ProcessStatus, string> = {
  starting: `${YELLOW}◌${RESET}`,
  running: `${GREEN}●${RESET}`,
  crashed: `${RED}✕${RESET}`,
  stopped: `${DIM}○${RESET}`,
};

const ERROR_PATTERNS = /\berror\b|ERR!|FAIL|panic|unhandled/i;

function renderBanner(processes: ManagedProcess[]): void {
  const width = 48;
  const line = "─".repeat(width);

  console.log(`${DIM}╭${line}╮${RESET}`);
  console.log(`${DIM}│${RESET}  ${BOLD}UnCorded Dev Environment${RESET}${" ".repeat(width - 26)}${DIM}│${RESET}`);
  console.log(`${DIM}├${line}┤${RESET}`);

  for (const mp of processes) {
    const icon = STATUS_ICONS[mp.status];
    const url = `http://localhost:${mp.config.port}`;
    const content = `  ${mp.config.color}${mp.config.label.padEnd(8)}${RESET} ${icon} ${url}`;
    // Calculate visible length (without ANSI codes)
    const visLen = `  ${mp.config.label.padEnd(8)} X ${url}`.length;
    const pad = width - visLen;
    console.log(`${DIM}│${RESET}${content}${" ".repeat(Math.max(0, pad))}${DIM}│${RESET}`);
  }

  console.log(`${DIM}├${line}┤${RESET}`);

  if (rawModeEnabled) {
    const shortcuts = "  q quit · c clear · 1/2 filter · a all";
    const sPad = width - shortcuts.length;
    console.log(`${DIM}│${shortcuts}${" ".repeat(Math.max(0, sPad))}│${RESET}`);
  } else {
    const shortcuts = "  Ctrl+C to quit";
    const sPad = width - shortcuts.length;
    console.log(`${DIM}│${shortcuts}${" ".repeat(Math.max(0, sPad))}│${RESET}`);
  }

  console.log(`${DIM}╰${line}╯${RESET}`);
  console.log();
}

function prefixLine(line: string, config: ServiceConfig): string {
  const prefix = `${config.color}[${config.label}]${RESET}`;
  if (ERROR_PATTERNS.test(line)) {
    return `${prefix} ${BG_RED}${WHITE}${line}${RESET}`;
  }
  return `${prefix} ${line}`;
}

function printStatusChange(mp: ManagedProcess, newStatus: ProcessStatus): void {
  const icon = STATUS_ICONS[newStatus];
  const messages: Record<string, string> = {
    running: `${GREEN}Process started${RESET}`,
    crashed: `${RED}Process crashed (exit code ${mp.exitCode ?? "?"})${RESET}`,
    stopped: `${DIM}Process stopped${RESET}`,
  };
  const msg = messages[newStatus] ?? newStatus;
  console.log(`${mp.config.color}[${mp.config.label}]${RESET} ${icon} ${msg}`);
}

// ── Log filter ──────────────────────────────────────────────────────────────

let logFilter: string | null = null; // null = show all

function shouldShowLog(serviceName: string): boolean {
  return logFilter === null || logFilter === serviceName;
}

// ── Raw mode keyboard handling ──────────────────────────────────────────────

let rawModeEnabled = false;

function enableRawMode(processes: ManagedProcess[]): boolean {
  if (!process.stdin.isTTY) return false;

  try {
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.on("data", (data: Buffer) => {
      const key = data.toString();

      // Ctrl+C (0x03)
      if (key === "\x03") {
        shutdown(processes);
        return;
      }

      switch (key) {
        case "q":
        case "Q":
          shutdown(processes);
          break;
        case "c":
        case "C":
          process.stdout.write("\x1b[2J\x1b[H"); // clear screen + cursor home
          renderBanner(processes);
          break;
        case "1":
          logFilter = logFilter === "server" ? null : "server";
          console.log(`${DIM}Filter: ${logFilter ?? "all"}${RESET}`);
          break;
        case "2":
          logFilter = logFilter === "web" ? null : "web";
          console.log(`${DIM}Filter: ${logFilter ?? "all"}${RESET}`);
          break;
        case "a":
        case "A":
        case "0":
          logFilter = null;
          console.log(`${DIM}Filter: all${RESET}`);
          break;
      }
    });
    return true;
  } catch {
    return false;
  }
}

function disableRawMode(): void {
  if (rawModeEnabled && process.stdin.isTTY) {
    try {
      process.stdin.setRawMode(false);
      process.stdin.pause();
    } catch {
      // Terminal might already be gone
    }
  }
}

// ── Process spawning ────────────────────────────────────────────────────────

function spawnService(mp: ManagedProcess): void {
  const proc = Bun.spawn(["bun", "run", "--filter", mp.config.filter, "dev"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
    env: {
      ...process.env,
      PORT: String(mp.config.port),
    },
  });

  mp.proc = proc;
  mp.status = "starting";

  // Stream stdout
  const streamOut = (async () => {
    for await (const chunk of proc.stdout) {
      if (mp.status === "starting") {
        mp.status = "running";
        printStatusChange(mp, "running");
      }
      if (!shouldShowLog(mp.config.name)) continue;
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.length === 0) continue;
        process.stdout.write(prefixLine(line, mp.config) + "\n");
      }
    }
  })().catch(console.error);

  // Stream stderr
  const streamErr = (async () => {
    for await (const chunk of proc.stderr) {
      if (!shouldShowLog(mp.config.name)) continue;
      const text = new TextDecoder().decode(chunk);
      const lines = text.split("\n");
      for (const line of lines) {
        if (line.length === 0) continue;
        process.stdout.write(prefixLine(line, mp.config) + "\n");
      }
    }
  })().catch(console.error);

  // Track exit — 143 (SIGTERM) and 130 (SIGINT) are expected during shutdown
  proc.exited.then((code) => {
    mp.exitCode = code;
    const isSignalExit = code === 143 || code === 130;
    if (code !== 0 && code !== null && !isSignalExit && !shuttingDown) {
      mp.status = "crashed";
      printStatusChange(mp, "crashed");
    } else {
      mp.status = "stopped";
    }
  });

  streamPromises.push(streamOut as Promise<void>, streamErr as Promise<void>);
}

// ── Shutdown ────────────────────────────────────────────────────────────────

let shuttingDown = false;

function shutdown(processes: ManagedProcess[]): void {
  if (shuttingDown) return;
  shuttingDown = true;

  console.log(`\n${DIM}Shutting down...${RESET}`);
  disableRawMode();

  for (const mp of processes) {
    if (mp.proc) {
      mp.proc.kill();
      mp.status = "stopped";
    }
  }

  process.exit(0);
}

// ── Main ────────────────────────────────────────────────────────────────────

const offset = resolvePortOffset();
const serverPort = BASE_SERVER_PORT + offset;
const webPort = BASE_WEB_PORT + offset;

// Check ports before anything else
await ensurePortsAvailable(serverPort, webPort);

const serviceConfigs: ServiceConfig[] = [
  { name: "server", filter: "@uncorded/server", port: serverPort, color: CYAN, label: "server" },
  { name: "web", filter: "@uncorded/web", port: webPort, color: MAGENTA, label: "web" },
];

const managedProcesses: ManagedProcess[] = serviceConfigs.map((config) => ({
  config,
  status: "starting" as ProcessStatus,
  proc: null,
  exitCode: null,
}));

// Try to enable raw mode for keyboard shortcuts
rawModeEnabled = enableRawMode(managedProcesses);

// Render startup banner
renderBanner(managedProcesses);

// Signal handlers
process.on("SIGINT", () => shutdown(managedProcesses));
process.on("SIGTERM", () => shutdown(managedProcesses));

// Spawn all services
const streamPromises: Promise<void>[] = [];
for (const mp of managedProcesses) {
  spawnService(mp);
}

// Wait for all processes and streams
await Promise.all([
  ...managedProcesses.map((mp) => mp.proc?.exited),
  ...streamPromises,
]);
