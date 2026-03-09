/**
 * Dev runner — starts server and web in parallel with colored prefixed output.
 * Usage: bun run scripts/dev.ts
 */

const CYAN = "\x1b[36m";
const MAGENTA = "\x1b[35m";
const RESET = "\x1b[0m";
const DIM = "\x1b[2m";

interface Service {
  name: string;
  filter: string;
  color: string;
}

const services: Service[] = [
  { name: "server", filter: "@uncorded/server", color: CYAN },
  { name: "web", filter: "@uncorded/web", color: MAGENTA },
];

function prefixLines(data: Uint8Array, label: string, color: string): void {
  const text = new TextDecoder().decode(data);
  const lines = text.split("\n");
  for (const line of lines) {
    if (line.length === 0) continue;
    process.stdout.write(`${color}[${label}]${RESET} ${line}\n`);
  }
}

const procs: ReturnType<typeof Bun.spawn>[] = [];

function cleanup() {
  for (const proc of procs) {
    proc.kill();
  }
}

process.on("SIGINT", () => {
  cleanup();
  process.exit(0);
});

process.on("SIGTERM", () => {
  cleanup();
  process.exit(0);
});

console.log(`${DIM}Starting UnCorded dev environment...${RESET}\n`);

const streamPromises: Promise<void>[] = [];

for (const service of services) {
  const proc = Bun.spawn(["bun", "run", "--filter", service.filter, "dev"], {
    cwd: import.meta.dir + "/..",
    stdout: "pipe",
    stderr: "pipe",
    env: { ...process.env },
  });

  procs.push(proc);

  // Stream stdout — sequential reads are intentional (streaming)
  // oxlint-disable-next-line no-await-in-loop
  const stdoutPromise = (async () => {
    for await (const chunk of proc.stdout) {
      prefixLines(chunk, service.name, service.color);
    }
  })().catch(console.error);

  // Stream stderr — sequential reads are intentional (streaming)
  // oxlint-disable-next-line no-await-in-loop
  const stderrPromise = (async () => {
    for await (const chunk of proc.stderr) {
      prefixLines(chunk, service.name, service.color);
    }
  })().catch(console.error);

  streamPromises.push(stdoutPromise as Promise<void>, stderrPromise as Promise<void>);
}

// Wait for all processes and stream readers
await Promise.all([...procs.map((p) => p.exited), ...streamPromises]);
