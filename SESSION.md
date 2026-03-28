# Session: Phase 1 — Electron App + Bun Sidecar Foundation

## Context

UnCorded is pivoting from a chat app to a local-first plugin platform with chat. Plugins run in Docker containers on the server owner's machine, accessed from any browser. This session builds the foundation — the Electron desktop app that hosts everything.

**Read first:** `docs/plugin-architecture.md` — the full spec. This session implements Phase 1.

---

## Architecture: Electron + Bun Sidecar

Electron's main process runs Node.js (unavoidable). Instead of fighting this, we split responsibilities:

```
┌─────────────────────────────────────────────────────┐
│  Electron (Node.js)                                  │
│  ├── Window management                               │
│  ├── IPC bridge to renderer                          │
│  ├── Tray icon / system integration                  │
│  ├── Auto-update (electron-updater)                  │
│  └── Spawns & manages the Bun sidecar process        │
│                                                      │
│  Renderer (Chromium)                                  │
│  └── UnCorded web app + plugin iframes               │
└──────────────┬───────────────────────────────────────┘
               │ spawns + IPC/HTTP
               ▼
┌─────────────────────────────────────────────────────┐
│  Bun Sidecar Process                                 │
│  ├── Bridge Server (Elysia — HTTP + WS, 127.0.0.1)  │
│  ├── Docker Manager (dockerode)                      │
│  ├── Gateway Client (WebSocket + MessagePack)        │
│  ├── Seeding Engine (WebTorrent)                     │
│  └── Plugin lifecycle management                     │
└─────────────────────────────────────────────────────┘
```

**Why this split:**
- Electron handles what only Electron can — windows, native menus, auto-update, system tray
- Everything else runs on Bun — consistent with the rest of the UnCorded stack (Elysia, same patterns)
- The sidecar is a regular Bun process — easy to develop, test, and debug independently
- If Electron dies, the sidecar can be restarted. If the sidecar dies, Electron respawns it.

**Communication between Electron and Sidecar:**
- Electron spawns the sidecar with `child_process.spawn('bun', ['run', 'sidecar/index.ts'])`
- They communicate via stdout/stdin JSON-RPC, or the sidecar exposes a local HTTP endpoint that Electron's renderer can also call
- The renderer can talk directly to the sidecar's HTTP API for plugin state, Docker status, etc.

---

## Goal

A working Electron desktop app that:
1. Loads the UnCorded web app in its renderer
2. Spawns a Bun sidecar that runs the Bridge Server + Docker Manager
3. Sidecar connects to the UnCorded gateway via WebSocket (MessagePack)
4. Sidecar can manage Docker containers (pull, start, stop, remove)
5. Bridge Server responds to authenticated plugin requests
6. Includes persistent WebTorrent seeding in the sidecar

---

## Directory Structure

```
apps/desktop/
├── package.json                  ← Electron app package
├── tsconfig.json
├── electron-builder.yml          ← Build/packaging config
├── src/
│   ├── main/                     ← Electron main process (Node.js, thin)
│   │   ├── index.ts              ← Window creation, tray, auto-update
│   │   ├── preload.ts            ← Preload script — exposes IPC to renderer
│   │   └── sidecar.ts            ← Spawn/manage the Bun sidecar process
│   └── renderer/
│       └── index.html            ← Loads uncorded.app or local web build
│
├── sidecar/                      ← Bun sidecar process (all the heavy lifting)
│   ├── index.ts                  ← Entry point — starts all services
│   ├── bridge/                   ← Bridge Server
│   │   ├── server.ts             ← Elysia HTTP + WS server (127.0.0.1)
│   │   ├── auth.ts               ← Per-plugin token validation
│   │   ├── routes.ts             ← Bridge API endpoints
│   │   ├── storage.ts            ← KV storage with optional encryption
│   │   └── permissions.ts        ← Permission enforcement
│   ├── docker/                   ← Docker Manager
│   │   ├── manager.ts            ← Container lifecycle (dockerode)
│   │   ├── health.ts             ← Health monitoring loop
│   │   ├── networks.ts           ← Per-plugin network isolation
│   │   └── resources.ts          ← Resource limit enforcement
│   ├── gateway/                  ← UnCorded gateway connection
│   │   └── client.ts             ← WebSocket + MessagePack client
│   ├── seeding/                  ← WebTorrent persistent seeding
│   │   └── engine.ts             ← Seed manager
│   └── plugins/                  ← Plugin lifecycle
│       ├── lifecycle.ts          ← Install, start, stop, update, uninstall
│       ├── manifest.ts           ← Manifest parsing + validation
│       └── tokens.ts             ← Bridge token generation + rotation
```

---

## Scope — What to Build

### 1. Electron Shell (`src/main/`)

Thin Electron wrapper. Does as little as possible.

**`index.ts`:**
- Create BrowserWindow, load the web app
- System tray icon with quit/show/hide
- Spawn the Bun sidecar on app ready
- Respawn sidecar if it crashes
- Handle app lifecycle (close to tray, quit from tray)

**`preload.ts`:**
- Expose IPC channels to the renderer:
  - `sidecar:status` — is the sidecar running?
  - `sidecar:port` — what port is the Bridge Server on?
  - `docker:status` — is Docker available?
  - `plugins:list` — installed plugins and their states
  - `plugins:install` / `plugins:remove` / `plugins:start` / `plugins:stop`

**`sidecar.ts`:**
- `spawnSidecar()` — spawn `bun run sidecar/index.ts` as a child process
- Pass config via environment variables or CLI args (bridge port, data directory)
- Monitor the process — restart on crash (max 3 retries, then surface error to user)
- Graceful shutdown on app quit (send SIGTERM, wait, then SIGKILL)
- Pipe sidecar stdout/stderr to Electron's log

### 2. Bun Sidecar Entry (`sidecar/index.ts`)

The sidecar is the brain. It starts all services:

```typescript
// sidecar/index.ts
import { startBridgeServer } from './bridge/server';
import { DockerManager } from './docker/manager';
import { GatewayClient } from './gateway/client';
import { SeedingEngine } from './seeding/engine';
import { PluginLifecycle } from './plugins/lifecycle';

const docker = new DockerManager();
const gateway = new GatewayClient();
const seeding = new SeedingEngine();
const plugins = new PluginLifecycle(docker, gateway);

// Start Bridge Server on a dynamic port, bind to 127.0.0.1
const bridge = await startBridgeServer({ docker, gateway, plugins, port: 0 });

// Print the assigned port so Electron can read it from stdout
console.log(JSON.stringify({ type: 'ready', port: bridge.port }));

// Connect to UnCorded gateway
await gateway.connect();

// Resume seeding
await seeding.resume();

// Start all installed plugins that were previously running
await plugins.resumeAll();
```

### 3. Gateway Client (`sidecar/gateway/`)

WebSocket client connecting to UnCorded's gateway. Reuse patterns from the Claude channel plugin (`C:\Projects\UnCorded-Plugins\claude-channel\lib\uncorded-client.ts`).

**Implement:**
- Connect to `wss://api.uncorded.app/gateway`
- MessagePack encode/decode all frames
- Handle opcodes: HELLO, IDENTIFY, READY, HEARTBEAT, HEARTBEAT_ACK, MESSAGE_CREATE
- Authenticate with user's bot token (server owner's bot)
- Auto-reconnect with exponential backoff (5s → 60s max)
- Forward events to Bridge Server for plugin distribution

**Reference files:**
- `C:\Projects\UnCorded-Plugins\claude-channel\lib\uncorded-client.ts` — working WS client
- `C:\Projects\UnCorded-Plugins\claude-channel\lib\msgpack.ts` — MessagePack types + opcodes
- `apps/server/src/ws/gateway.ts` — server-side opcode handling

### 4. Docker Manager (`sidecar/docker/`)

Manage plugin containers via dockerode.

**`manager.ts`:**
- `pullImage(image)` — Pull with progress events
- `createContainer(pluginId, config)` — Create with:
  - Dynamic host port mapping
  - Volume mount: `./plugin-data/{pluginId}:/app/data`
  - Environment variables: bridge URL, bridge token, server ID, plugin ID, user config
  - Resource limits from manifest
  - Labels: `uncorded.plugin.id`, `uncorded.plugin.server`
  - No privileged mode
- `startContainer(containerId)`
- `stopContainer(containerId)` — SIGTERM, wait 10s, SIGKILL
- `removeContainer(containerId)`
- `getStatus(containerId)` → ContainerStatus
- `getLogs(containerId, tail)` → string
- `listPluginContainers()` — filter by `uncorded.plugin.id` label

**`networks.ts`:**
- `createPluginNetwork(pluginId)` — create `uncorded-plugin-{pluginId}` bridge network
- `removePluginNetwork(pluginId)`
- Connect only the plugin container to its network
- Bridge Server accesses plugins via mapped host ports (not container IPs)

**`health.ts`:**
- Health check loop (every 10s per running plugin)
- HTTP GET to `http://localhost:{hostPort}{healthCheckPath}`
- Track consecutive failures → mark as CRASHED after 3 failures
- Auto-restart crashed containers (max 3 times, then STOPPED)

**`resources.ts`:**
- Validate manifest resource requests against per-server limits
- Track global resource usage across all plugins
- Reject plugin start if it would exceed limits

### 5. Bridge Server (`sidecar/bridge/`)

Elysia HTTP + WebSocket server. Bind to `127.0.0.1` only.

**`server.ts`:**
- Elysia app with all bridge routes
- Listen on dynamic port (port 0 → OS assigns)
- CORS: reject all (localhost only, no browser CORS needed)

**`auth.ts`:**
- Middleware: extract `Authorization: Bearer {token}` header
- Hash the token, look up plugin by token hash
- Attach plugin context (id, permissions, serverId) to request
- 401 if token invalid or missing

**`routes.ts` — implement all Bridge API endpoints:**
```
GET    /bridge/server                    → Server info (from gateway READY data)
GET    /bridge/members                   → Member list (from gateway cache)
GET    /bridge/channels                  → Channel list (from gateway cache)
GET    /bridge/channels/:id/messages     → Fetch via UnCorded API
POST   /bridge/channels/:id/messages     → Send via gateway
GET    /bridge/users/:id                 → Fetch via UnCorded API
GET    /bridge/presence                  → From gateway presence data
POST   /bridge/notify                    → Push postMessage to plugin iframe via IPC
GET    /bridge/config                    → Plugin config from local storage
PUT    /bridge/storage/:key              → KV store (with ?encrypt=true)
GET    /bridge/storage/:key              → KV retrieve
DELETE /bridge/storage/:key              → KV delete
WS     /bridge/events                    → Real-time event stream per plugin
```

**`permissions.ts`:**
- Check plugin's declared permissions against the requested endpoint
- Permission map: which endpoints require which permissions
- 403 with clear error message if denied

**`storage.ts`:**
- File-based KV store: `./plugin-data/{pluginId}/.bridge-kv/`
- JSON files per key
- Optional AES-256-GCM encryption (key derived from bridge token)
- Enforce 1 MB per value, 100 MB total per plugin

### 6. Plugin Lifecycle (`sidecar/plugins/`)

**`lifecycle.ts`:**
- `install(manifest, imageRef)` — Pull image, create network, create container, generate bridge token
- `start(pluginId)` — Rotate bridge token, start container, begin health checks
- `stop(pluginId)` — Stop container, stop health checks
- `restart(pluginId)` — Stop then start
- `uninstall(pluginId, keepData)` — Stop, remove container, remove network, archive or delete data
- `update(pluginId, newManifest)` — Snapshot data, pull new image, stop old, start new, run migrations
- `resumeAll()` — On sidecar startup, restart plugins that were previously running
- State persistence: `./plugin-data/.state.json` tracks plugin states across restarts

**`manifest.ts`:**
- Parse and validate `uncorded-plugin.json`
- Validate permissions are known values
- Validate resource limits within bounds
- Validate semver, required fields

**`tokens.ts`:**
- `generateToken()` → 256-bit random token
- `hashToken(token)` → SHA-256 hash for storage
- `rotateToken(pluginId)` → Generate new, update container env, update state

### 7. Persistent Seeding (`sidecar/seeding/`)

WebTorrent client for persistent P2P file availability.

- On startup, load seed index from `./seed-data/index.json`
- Resume seeding all indexed files
- IPC endpoint to add/remove seeds
- Report seed status (peers, upload speed) to renderer
- Graceful shutdown: save state, destroy torrents

---

## What NOT to Build (Yet)

- Plugin frontend iframe integration (Phase 2)
- postMessage bridge from renderer to plugin iframes (Phase 2)
- Sidebar plugin tabs in web UI (Phase 2)
- Plugin registry/browser (Phase 4)
- `create-uncorded-plugin` CLI (Phase 3)
- Auto-updates (later — but use electron-updater structure from the start)
- Code signing (later)
- Plugin settings UI in web app (can test via API for now)

---

## Tech Stack

| Component | Technology | Why |
|-----------|-----------|-----|
| App shell | Electron | Windows/Mac/Linux, auto-update, system tray |
| Sidecar runtime | Bun | Consistent with UnCorded stack, fast, runs Elysia |
| Bridge Server | Elysia | Same framework as main server, runs on Bun |
| Docker API | dockerode | Battle-tested Node/Bun Docker client |
| Gateway protocol | msgpackr + ws | Same MessagePack binary protocol as the server |
| Seeding | webtorrent | Already used in the web app |
| Packaging | electron-builder | Standard, supports auto-update |

---

## Dependencies to Install

**Electron app (`apps/desktop/package.json`):**
```
electron
electron-builder
electron-updater
```

**Sidecar (`apps/desktop/sidecar/` — or separate package):**
```
elysia
dockerode
msgpackr
ws
webtorrent
```

---

## Files to Touch

- `apps/desktop/` — entire new package (create)
- `package.json` (root) — add desktop to workspaces
- `turbo.json` — add desktop build/dev tasks

---

## Constraints

- Electron main process: thin as possible — window management, sidecar spawning only
- All business logic in the Bun sidecar — NOT in the Electron main process
- Bridge Server MUST bind to 127.0.0.1 only
- Docker containers MUST have resource limits
- No privileged containers, ever
- Bridge tokens rotated on every container start
- Each plugin gets its own Docker network
- Sidecar must handle crashes gracefully (auto-restart, state persistence)
- Use Elysia for Bridge Server (same patterns as `apps/server`)
- Use existing MessagePack protocol/opcodes from the codebase

---

## Verification

1. `bun run dev:desktop` opens Electron window showing UnCorded web app
2. Sidecar spawns automatically, prints ready message with port
3. Sidecar connects to UnCorded gateway and receives READY
4. Docker Manager can pull an image (test with `nginx:alpine`)
5. Docker Manager can create, start, health-check, and stop a container
6. Bridge Server responds to `GET /bridge/server` with valid auth
7. Bridge Server returns 401 for missing/invalid tokens
8. Bridge Server returns 403 for permission violations
9. KV storage persists across sidecar restarts
10. Encrypted KV values are not readable as plaintext on disk
11. WebTorrent seeds a test file and reports peers
12. Killing the sidecar → Electron respawns it
13. App quit → sidecar shuts down gracefully (stops containers, saves state)
