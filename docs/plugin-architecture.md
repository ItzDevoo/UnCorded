# UnCorded Plugin Architecture Specification

## Vision

UnCorded is a local-first plugin platform with built-in real-time chat. Plugins run in Docker containers on the server owner's machine. UnCorded provides the shell (navigation, auth, presence, messaging) and plugins get full control of the content area. Chat is the default plugin — everything else is community-built.

Users access plugins through the browser. Server owners provide the compute. UnCorded relays the connections. AI agents can build plugins easily, making the ecosystem self-growing.

---

## Table of Contents

1. [Core Concepts](#1-core-concepts)
2. [Plugin Structure](#2-plugin-structure)
3. [Plugin Manifest](#3-plugin-manifest)
4. [Plugin Lifecycle](#4-plugin-lifecycle)
5. [Docker Runtime](#5-docker-runtime)
6. [UI Architecture](#6-ui-architecture)
7. [Communication Protocol](#7-communication-protocol)
8. [UnCorded Bridge API](#8-uncorded-bridge-api)
9. [Plugin Storage](#9-plugin-storage)
10. [Permissions System](#10-permissions-system)
11. [Security Model](#11-security-model)
12. [Distribution & Discovery](#12-distribution--discovery)
13. [Developer Experience](#13-developer-experience)
14. [Migration from Current System](#14-migration-from-current-system)
15. [Electron Integration](#15-electron-integration)
16. [Scaling & Performance](#16-scaling--performance)
17. [Implementation Phases](#17-implementation-phases)

---

## 1. Core Concepts

### What is a Plugin?

A plugin is a self-contained application that runs inside a Docker container on the server owner's machine. It has two parts:

- **Backend** — A server process running in the container. It handles business logic, API calls, data storage, and serves the frontend. It communicates with UnCorded through a well-defined Bridge API.
- **Frontend** — A web UI served by the backend and rendered in an iframe within UnCorded's shell. It has full control of the content area or a sidebar panel.

### Who Runs What?

| Component       | Runs Where                      | Controlled By    |
| --------------- | ------------------------------- | ---------------- |
| UnCorded Shell  | User's browser                  | UnCorded         |
| Plugin Frontend | User's browser (iframe)         | Plugin developer |
| Plugin Backend  | Server owner's machine (Docker) | Plugin developer |
| UnCorded Server | UnCorded infrastructure         | UnCorded         |
| Docker Engine   | Server owner's machine          | Server owner     |

### Trust Model

- **Server owner** trusts the plugins they install (they chose to run them)
- **Server members** trust the server owner (they joined the server)
- **UnCorded** trusts nobody — sandboxes everything, relays connections, enforces permissions
- **Plugin frontend** is sandboxed — no access to UnCorded DOM, cookies, or auth tokens

---

## 2. Plugin Structure

A plugin lives in a Git repository with this structure:

```
my-plugin/
├── uncorded-plugin.json     ← Plugin manifest (required)
├── Dockerfile               ← Container definition (required)
├── README.md                ← Description, screenshots, docs
├── src/
│   ├── server/              ← Backend code (any language/framework)
│   │   └── index.ts         ← Entry point
│   └── client/              ← Frontend code (any framework)
│       ├── index.html       ← Entry point
│       └── ...
├── data/                    ← Default data/config templates
└── .github/
    └── workflows/
        └── publish.yml      ← Builds and pushes Docker image on release
```

### Language/Framework Agnostic

Plugin backends can be written in any language — Bun, Node, Python, Go, Rust, etc. The only requirement is that the Docker container:

1. Exposes an HTTP server on the port specified in the manifest
2. Serves the plugin frontend at `GET /`
3. Implements the UnCorded Bridge API endpoints

Plugin frontends can use any web framework — React, SolidJS, Vue, Svelte, plain HTML/JS, etc. They render in an iframe and communicate with UnCorded via `postMessage`.

---

## 3. Plugin Manifest

The `uncorded-plugin.json` file defines everything UnCorded needs to know about a plugin.

```json
{
  "id": "t3chat",
  "name": "T3 Chat",
  "version": "1.0.0",
  "description": "AI chat powered by multiple providers. Bring your own API keys.",
  "author": {
    "name": "T3 Community",
    "url": "https://github.com/t3-community"
  },
  "repository": "https://github.com/t3-community/uncorded-t3chat",
  "icon": "icon.png",
  "category": "AI",
  "tags": ["ai", "chat", "llm", "openai", "anthropic"],

  "runtime": {
    "image": "ghcr.io/t3-community/uncorded-t3chat:latest",
    "port": 3100,
    "healthCheck": "/health",
    "memory": "512m",
    "cpu": "0.5"
  },

  "ui": {
    "slot": "content",
    "sidebar": {
      "icon": "message-circle",
      "label": "T3 Chat"
    },
    "header": true,
    "rightPanel": false
  },

  "permissions": ["chat:read", "chat:write", "users:read", "presence:read", "storage:persistent"],

  "config": [
    {
      "key": "OPENAI_API_KEY",
      "label": "OpenAI API Key",
      "type": "secret",
      "required": false,
      "description": "Your OpenAI API key for GPT models"
    },
    {
      "key": "ANTHROPIC_API_KEY",
      "label": "Anthropic API Key",
      "type": "secret",
      "required": false,
      "description": "Your Anthropic API key for Claude models"
    }
  ],

  "minVersion": "2.0.0"
}
```

### Manifest Fields

| Field                 | Type     | Required | Description                                                        |
| --------------------- | -------- | -------- | ------------------------------------------------------------------ |
| `id`                  | string   | yes      | Unique plugin identifier (lowercase, alphanumeric, hyphens)        |
| `name`                | string   | yes      | Display name                                                       |
| `version`             | semver   | yes      | Plugin version                                                     |
| `description`         | string   | yes      | Short description (max 200 chars)                                  |
| `author`              | object   | yes      | Author name and optional URL                                       |
| `repository`          | URL      | yes      | Git repository URL                                                 |
| `icon`                | string   | no       | Path to icon file in repo (PNG/SVG, 128x128)                       |
| `category`            | string   | yes      | One of: AI, Productivity, Developer, Media, Social, Utility, Other |
| `tags`                | string[] | no       | Searchable tags (max 10)                                           |
| `runtime`             | object   | yes      | Docker runtime configuration                                       |
| `runtime.image`       | string   | yes      | Docker image reference                                             |
| `runtime.port`        | number   | yes      | Port the plugin server listens on                                  |
| `runtime.healthCheck` | string   | yes      | HTTP path for health checks                                        |
| `runtime.memory`      | string   | no       | Memory limit (default: "256m")                                     |
| `runtime.cpu`         | string   | no       | CPU limit (default: "0.25")                                        |
| `ui`                  | object   | yes      | UI integration configuration                                       |
| `ui.slot`             | string   | yes      | "content" (full area) or "panel" (sidebar panel)                   |
| `ui.sidebar`          | object   | yes      | Sidebar tab configuration                                          |
| `ui.header`           | boolean  | no       | Whether plugin renders its own header bar                          |
| `ui.rightPanel`       | boolean  | no       | Whether plugin uses the right panel slot                           |
| `permissions`         | string[] | yes      | Required permissions (see Permissions section)                     |
| `config`              | object[] | no       | User-configurable settings                                         |
| `minVersion`          | semver   | no       | Minimum UnCorded version required                                  |

---

## 4. Plugin Lifecycle

### Installation Flow

```
Server Owner clicks "Install Plugin"
         │
         ▼
UnCorded fetches uncorded-plugin.json from repo
         │
         ▼
Server owner reviews permissions
         │
         ▼
Server owner approves → Electron app pulls Docker image
         │
         ▼
Container created (not started) with:
  - Port mapping (dynamic host port → container port)
  - Volume mount for persistent storage
  - Environment variables (config values + bridge credentials)
  - Resource limits (memory, CPU)
         │
         ▼
Plugin registered in server's plugin list
         │
         ▼
Plugin appears in sidebar for all server members
```

### Runtime States

```
INSTALLED → STARTING → RUNNING → STOPPING → STOPPED
                │                     │
                ▼                     ▼
             CRASHED              DISABLED
```

| State       | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| `INSTALLED` | Image pulled, container created, not running                             |
| `STARTING`  | Container starting, waiting for health check                             |
| `RUNNING`   | Healthy and serving requests                                             |
| `STOPPING`  | Graceful shutdown in progress                                            |
| `STOPPED`   | Container stopped by server owner                                        |
| `CRASHED`   | Container exited unexpectedly (auto-restart up to 3 times, then STOPPED) |
| `DISABLED`  | Manually disabled by server owner (can be re-enabled → STARTING)         |

### Update Flow

```
New version detected (webhook or manual check)
         │
         ▼
Server owner reviews changelog + permission changes
         │
         ▼
Server owner approves → Electron pulls new image
         │
         ▼
Stop old container → Start new container with same volumes
         │
         ▼
Updated (data persisted across versions)
```

### Data Migration Contract

Plugin updates may change data schemas. The update flow handles this:

1. **Before update:** Electron snapshots the plugin's data volume (tar archive)
2. **Plugin signals migration needs** via a `migrations` field in the manifest:
   ```json
   "migrations": {
     "1.0.0-to-2.0.0": "/migrate.sh"
   }
   ```
3. **After new container starts:** If a migration script exists for the version jump, Electron runs it inside the container before marking the plugin as RUNNING
4. **If migration fails:** Electron restores the snapshot and rolls back to the previous image
5. **No migration script:** Plugin is responsible for handling old data gracefully (forward compatibility)

---

## 5. Docker Runtime

### Container Configuration

Each plugin runs in an isolated Docker container managed by the Electron app.

```yaml
# Generated by Electron app — NOT user-authored
services:
  plugin-t3chat:
    image: ghcr.io/t3-community/uncorded-t3chat:latest
    restart: unless-stopped
    ports:
      - "${DYNAMIC_HOST_PORT}:3100"
    volumes:
      - ./plugin-data/t3chat:/app/data
    environment:
      - UNCORDED_BRIDGE_URL=http://host.docker.internal:${BRIDGE_PORT}
      - UNCORDED_BRIDGE_TOKEN=${GENERATED_TOKEN}
      - UNCORDED_SERVER_ID=${SERVER_ID}
      - UNCORDED_PLUGIN_ID=t3chat
      - OPENAI_API_KEY=${USER_CONFIG_VALUE}
    mem_limit: 512m
    cpus: 0.5
    networks:
      - plugin-t3chat-net # Isolated per-plugin network — no cross-plugin access
    healthcheck:
      test: ["CMD", "wget", "-q", "--spider", "http://localhost:3100/health"]
      interval: 10s
      timeout: 5s
      retries: 3
      start_period: 15s
```

### Network Isolation

```
┌──────────────────────────────────────────────────┐
│  Server Owner's Machine                          │
│                                                  │
│  ┌─────────────────┐    ┌─────────────────────┐  │
│  │  Electron App    │    │  Docker Network      │  │
│  │  (Plugin Host)   │    │  (per-plugin isolate) │  │
│  │                  │    │                      │  │
│  │  Bridge Server ◄─┼────┼─► Plugin Container A │  │
│  │  (port 9500)     │    │   (port 3100)        │  │
│  │                  │    │                      │  │
│  │                 ◄┼────┼─► Plugin Container B │  │
│  │                  │    │   (port 3200)        │  │
│  │                  │    │                      │  │
│  └────────┬─────────┘    └──────────────────────┘  │
│           │                                        │
│           │ WebSocket                              │
│           ▼                                        │
│  ┌─────────────────┐                               │
│  │ UnCorded Gateway │ (cloud)                      │
│  │ api.uncorded.app │                              │
│  └─────────────────┘                               │
└──────────────────────────────────────────────────┘
```

- Plugins can talk to the Bridge Server (Electron app) via `UNCORDED_BRIDGE_URL`
- Plugins can talk to the internet (for external APIs like OpenAI)
- Plugins CANNOT talk to each other directly (each plugin gets its own Docker network)
- Plugins CANNOT access the host filesystem (only their mounted data volume)

### Resource Management

The Electron app enforces resource limits per plugin and globally:

| Resource | Per Plugin Default | Per Plugin Max | Global Max   |
| -------- | ------------------ | -------------- | ------------ |
| Memory   | 256 MB             | 2 GB           | 8 GB         |
| CPU      | 0.25 cores         | 2 cores        | 4 cores      |
| Disk     | 1 GB               | 10 GB          | 50 GB        |
| Network  | Unlimited          | Rate-limited   | Rate-limited |

Server owners can adjust limits per plugin within the max bounds.

---

## 6. UI Architecture

### Shell + Content Model

UnCorded's UI becomes a shell that hosts plugins:

```
┌──────────────────────────────────────────────────────────────┐
│ ┌──────────┐ ┌────────────────────────────────────┐ ┌──────┐ │
│ │          │ │                                    │ │      │ │
│ │          │ │                                    │ │      │ │
│ │ Sidebar  │ │       Content Area                 │ │Right │ │
│ │          │ │       (Plugin Slot)                 │ │Panel │ │
│ │ UnCorded │ │                                    │ │(opt) │ │
│ │ controls │ │  Owned by active plugin             │ │      │ │
│ │   +      │ │  Default: Chat                      │ │      │ │
│ │ Plugin   │ │  iframe when plugin active           │ │      │ │
│ │  tabs    │ │                                    │ │      │ │
│ │          │ │                                    │ │      │ │
│ │          │ ├────────────────────────────────────┤ │      │ │
│ │          │ │ Input Area (chat only)             │ │      │ │
│ └──────────┘ └────────────────────────────────────┘ └──────┘ │
└──────────────────────────────────────────────────────────────┘
```

### What UnCorded Always Controls

- Server switcher
- User account section (avatar, status, settings)
- Plugin tab list in sidebar
- Navigation between plugins and chat
- Authentication state
- Connection status indicator
- Settings / Support links

### What a Plugin Can Control

| UI Slot           | Description                                     | Manifest Field        |
| ----------------- | ----------------------------------------------- | --------------------- |
| **Content Area**  | Full main content — replaces chat view entirely | `ui.slot: "content"`  |
| **Sidebar Panel** | Smaller panel below server channels             | `ui.slot: "panel"`    |
| **Header Bar**    | Custom header replacing channel name/info       | `ui.header: true`     |
| **Right Panel**   | Panel on right side (like member list slot)     | `ui.rightPanel: true` |

### Plugin Tab in Sidebar

When a plugin is installed, its tab appears in the sidebar under a "Plugins" section:

```
── Channels ──────────
  # general
  # random

── Plugins ───────────
  💬 T3 Chat
  📋 Project Board
  🎨 Excalidraw
```

Clicking a plugin tab:

1. Hides the chat content area
2. Shows the plugin's iframe in the content slot
3. Updates the header if plugin has `ui.header: true`
4. Shows the right panel if plugin has `ui.rightPanel: true`

Clicking a channel tab switches back to chat.

### iframe Sandbox

Plugin frontends render in a sandboxed iframe:

```html
<iframe
  src="http://localhost:${PLUGIN_PORT}/"
  sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
  allow="clipboard-write"
  referrerpolicy="no-referrer"
  style="width: 100%; height: 100%; border: none;"
/>
```

The `allow-same-origin` is needed so the plugin frontend can talk to its own backend. But the iframe is on a different origin from UnCorded, so it cannot access UnCorded's cookies, localStorage, or DOM.

**Important constraint:** Plugin backends MUST NOT store sensitive UnCorded data (bridge tokens, user auth) in a way accessible via `GET /` or any frontend-reachable endpoint. The `allow-same-origin` flag means a compromised plugin frontend can read its own origin's localStorage/cookies. Bridge tokens are passed via environment variables only, never exposed to the frontend.

---

## 7. Communication Protocol

### Overview

Three communication channels exist:

```
Plugin Frontend  ──postMessage──►  UnCorded Shell  ──WebSocket──►  UnCorded Server
       │                                                                 │
       │ HTTP/WS                                                         │
       ▼                                                                 │
Plugin Backend   ──HTTP──►  Bridge Server (Electron)  ──WebSocket──►─────┘
```

### Frontend ↔ Shell (postMessage Bridge)

Plugin frontends communicate with the UnCorded shell via `window.postMessage`. UnCorded provides a client SDK that wraps this.

**Origin Validation:** The shell maintains a dynamic allowlist of `http://localhost:{PORT}` origins — one per running plugin, mapped from the Docker port assignment. On every `message` event:

```typescript
window.addEventListener("message", (event) => {
  // Reject messages from unknown origins
  const pluginId = allowedOrigins.get(event.origin);
  if (!pluginId) return;

  // Validate message shape
  if (event.data?.type?.startsWith("uncorded:")) {
    handlePluginMessage(pluginId, event.data);
  }
});
```

The allowlist is updated whenever a plugin container starts or stops. Only the exact `http://localhost:{assigned_port}` origin is accepted — no wildcards.

**Messages from Plugin → UnCorded:**

```typescript
// Request user info
{ type: "uncorded:request", id: "req-1", method: "getUser" }

// Request server members
{ type: "uncorded:request", id: "req-2", method: "getMembers" }

// Send a chat message (requires chat:write permission)
{ type: "uncorded:request", id: "req-3", method: "sendMessage", params: {
  channelId: "abc123",
  content: "Hello from plugin!"
}}

// Navigate to a channel
{ type: "uncorded:request", id: "req-4", method: "navigate", params: {
  to: "channel",
  channelId: "abc123"
}}

// Show a toast notification
{ type: "uncorded:request", id: "req-5", method: "showToast", params: {
  message: "File saved!",
  type: "info"
}}
```

**Messages from UnCorded → Plugin:**

```typescript
// Response to a request
{ type: "uncorded:response", id: "req-1", result: { id: "user-1", username: "itzdevoo", ... }}

// Error response
{ type: "uncorded:response", id: "req-2", error: { code: "FORBIDDEN", message: "Missing permission: users:read" }}

// Event push (subscribed events)
{ type: "uncorded:event", event: "message:create", data: { channelId: "abc", content: "hey", ... }}
{ type: "uncorded:event", event: "presence:update", data: { userId: "abc", status: "online" }}
{ type: "uncorded:event", event: "member:join", data: { userId: "abc", serverId: "def" }}
```

### Backend ↔ Bridge Server (HTTP API)

Plugin backends call the Bridge Server running in the Electron app. The bridge authenticates requests using the `UNCORDED_BRIDGE_TOKEN` environment variable.

```
Authorization: Bearer ${UNCORDED_BRIDGE_TOKEN}
```

**Bridge API Endpoints:**

```
GET    /bridge/server                    → Server info
GET    /bridge/members                   → Server member list
GET    /bridge/channels                  → Channel list
GET    /bridge/channels/:id/messages     → Message history
POST   /bridge/channels/:id/messages     → Send message
GET    /bridge/users/:id                 → User info
GET    /bridge/presence                  → Online users
POST   /bridge/notify                    → Push notification to plugin frontend
GET    /bridge/config                    → Plugin's config values
PUT    /bridge/storage/:key              → Store plugin data
GET    /bridge/storage/:key              → Retrieve plugin data
DELETE /bridge/storage/:key              → Delete plugin data
```

Each endpoint checks the plugin's permissions before returning data.

### Backend ↔ Bridge Server (WebSocket — Events)

For real-time events, plugin backends can connect to the bridge via WebSocket:

```
WS /bridge/events
Authorization: Bearer ${UNCORDED_BRIDGE_TOKEN}
```

Events are JSON messages:

```json
{ "event": "message:create", "data": { "channelId": "abc", "content": "hey", "author": { ... } } }
{ "event": "presence:update", "data": { "userId": "abc", "status": "online" } }
{ "event": "member:join", "data": { "userId": "abc", "serverId": "def" } }
```

---

## 8. UnCorded Bridge API

### Bridge Server

The Bridge Server runs inside the Electron app on the server owner's machine. It:

1. Maintains a WebSocket connection to UnCorded's gateway (as the server owner's bot)
2. Exposes an HTTP + WebSocket API for plugins to call
3. Binds to `127.0.0.1` only — never `0.0.0.0` (prevents external network access)
4. Validates plugin tokens and permissions on every request
5. Translates between plugin requests and UnCorded gateway opcodes
6. Manages plugin lifecycle (start, stop, health checks)
7. Rotates bridge tokens on every container start (including auto-restart after crash)

### API Reference

#### Server Info

```
GET /bridge/server
Response: {
  id: string,
  name: string,
  ownerId: string,
  memberCount: number,
  channels: [{ id, name, type }]
}
```

#### Members

```
GET /bridge/members
Query: ?limit=100&offset=0
Permission: users:read
Response: {
  members: [{ userId, username, displayName, avatarUrl, status, joinedAt }],
  total: number
}
```

#### Channel Messages

```
GET /bridge/channels/:channelId/messages
Query: ?limit=50&before=messageId
Permission: chat:read
Response: {
  messages: [{ id, content, author: { id, username, avatarUrl }, createdAt, editedAt }]
}
```

#### Send Message

```
POST /bridge/channels/:channelId/messages
Permission: chat:write
Body: { content: string }
Response: { id: string, createdAt: string }
```

#### User Info

```
GET /bridge/users/:userId
Permission: users:read
Response: { id, username, displayName, avatarUrl, status }
```

#### Presence

```
GET /bridge/presence
Permission: presence:read
Response: {
  online: [{ userId, username, status }]
}
```

#### Push to Frontend

```
POST /bridge/notify
Permission: none (intentionally permission-free)
Body: { type: string, data: any }
Response: { delivered: true }
```

Sends a custom event to the plugin's frontend iframe via postMessage. Useful for pushing backend state changes to the UI. This endpoint is intentionally permission-free — a plugin can only notify its own frontend (scoped by bridge token), so no cross-plugin risk exists.

#### Plugin Storage

```
PUT /bridge/storage/:key
Permission: storage:persistent
Body: { value: any }
Response: { ok: true }

GET /bridge/storage/:key
Permission: storage:persistent
Response: { value: any }

DELETE /bridge/storage/:key
Permission: storage:persistent
Response: { ok: true }
```

Key-value storage persisted to the plugin's Docker volume. Keys are scoped to the plugin — no cross-plugin access. Values are JSON-serializable, max 1 MB per value, max 100 MB total per plugin.

**Note:** The 100 MB Bridge KV cap is separate from the volume disk limit (default 1 GB, max 10 GB). Bridge KV lives on the volume but is a managed subset — plugins can use the rest of the volume for direct file storage (SQLite, etc.) up to the disk limit. Both constraints apply independently.

**Encryption:** Bridge KV values are stored as plaintext JSON on disk. For sensitive data (OAuth tokens, API keys, credentials), the Bridge offers an encrypted tier:

```
PUT /bridge/storage/:key?encrypt=true
```

Encrypted values are AES-256-GCM encrypted at rest using a key derived from the plugin's bridge token. Plugins can also handle their own encryption if they prefer. Unencrypted storage is the default for performance — encryption is opt-in per key.

---

## 9. Plugin Storage

### Storage Tiers

| Type          | Persistence                 | Location                            | Use Case                         |
| ------------- | --------------------------- | ----------------------------------- | -------------------------------- |
| **Volume**    | Survives restarts & updates | `./plugin-data/{pluginId}/` on host | Databases, large files, caches   |
| **Bridge KV** | Survives restarts & updates | Bridge Server → volume              | Small config, state, preferences |
| **In-Memory** | Container lifetime only     | Inside container                    | Caches, sessions, temp data      |

### Volume Mount

Each plugin gets a dedicated directory mounted at `/app/data` inside the container:

```
Host: ./plugin-data/t3chat/     →     Container: /app/data/
```

Plugins can use this for anything — SQLite databases, file storage, config files, etc. The directory is owned by the plugin and persists across container restarts and image updates.

### Bridge KV Store

For simple key-value storage, plugins use the Bridge API (`/bridge/storage/:key`). This is stored on the host filesystem and managed by the Bridge Server. Good for:

- User preferences per plugin
- Plugin state (last sync timestamp, etc.)
- Small config values

### Data Isolation

- Plugins CANNOT access other plugins' storage
- Plugins CANNOT access the host filesystem outside their volume
- Bridge KV keys are namespaced by plugin ID
- Uninstalling a plugin prompts the server owner to keep or delete data

### Uninstall Flow

When a server owner removes a plugin:

1. Container is stopped and removed
2. Server owner is prompted: **"Keep plugin data?"**
   - **Yes** — Volume is archived to `./plugin-data/.archive/{pluginId}-{timestamp}/` (allows reinstall with data intact)
   - **No** — Volume is permanently deleted
3. Bridge token is revoked
4. Plugin removed from server's plugin list and sidebar
5. `server_plugins` row deleted from database
6. Archived data is auto-purged after 30 days if not reinstalled

---

## 10. Permissions System

### Permission Definitions

| Permission           | Description                                | Risk Level |
| -------------------- | ------------------------------------------ | ---------- |
| `chat:read`          | Read messages in server channels           | Low        |
| `chat:write`         | Send messages to server channels           | Medium     |
| `users:read`         | Read user profiles and member list         | Low        |
| `presence:read`      | See who's online/offline                   | Low        |
| `storage:persistent` | Store data that persists across restarts   | Low        |
| `network:external`   | Make HTTP requests to external services    | Medium     |
| `ui:notifications`   | Show toast notifications in UnCorded shell | Low        |
| `ui:navigate`        | Navigate the user to channels/views        | Low        |

### Permission Groups (Convenience)

| Group   | Includes                                          |
| ------- | ------------------------------------------------- |
| `basic` | `users:read`, `presence:read`, `ui:notifications` |
| `chat`  | `chat:read`, `chat:write`                         |
| `full`  | All permissions                                   |

### Permission Enforcement

1. **Install time** — Server owner reviews and approves required permissions
2. **Runtime** — Bridge Server checks permissions on every API call
3. **Frontend** — UnCorded shell checks permissions on every postMessage request
4. **Updates** — If a new version requires additional permissions, server owner must re-approve

### Permission Escalation

A plugin CANNOT request permissions at runtime that it didn't declare in its manifest. If a plugin needs a new permission, it must release a new version with an updated manifest. The server owner reviews the permission change before updating.

---

## 11. Security Model

### Threat Matrix

| Threat                                 | Mitigation                                                                        |
| -------------------------------------- | --------------------------------------------------------------------------------- |
| Plugin reads UnCorded auth tokens      | iframe sandbox — different origin, no cookie/localStorage access                  |
| Plugin XSS attacks UnCorded shell      | postMessage validation — only known message types accepted, origin checked        |
| Plugin escapes Docker container        | Standard Docker isolation — no privileged mode, no host mounts except data volume |
| Plugin mines crypto / abuses resources | CPU and memory limits enforced per container                                      |
| Plugin exfiltrates user data           | Permissions system — plugin only gets data it's approved for                      |
| Plugin serves malicious frontend       | Server owner chose to install it — trust model                                    |
| Plugin backend attacks host network    | Docker network isolation — only bridge and internet access                        |
| Malicious plugin update                | Server owner must approve permission changes, can pin versions                    |

### iframe Security

```
sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
```

- `allow-scripts` — Plugin needs JavaScript
- `allow-forms` — Plugin may have form inputs
- `allow-popups` — Plugin may open OAuth windows
- `allow-same-origin` — Plugin frontend can talk to its own backend
- NO `allow-top-navigation` — Plugin cannot redirect UnCorded
- NO `allow-modals` — Plugin cannot show alert/confirm/prompt

### Bridge Token Security

- Bridge tokens are generated per plugin at install time
- Tokens are 256-bit random values
- Tokens are passed via environment variable (not exposed to frontend)
- Tokens are rotated on every container start (including auto-restart after crash)
- Bridge validates token on every request

### Content Security Policy

UnCorded's shell sets a strict CSP:

```
Content-Security-Policy:
  default-src 'self';
  frame-src http://localhost:*;
  connect-src 'self' wss://api.uncorded.app;
```

Plugin iframes can only load from `localhost` (Docker-mapped ports).

---

## 12. Distribution & Discovery

### Plugin Registry

UnCorded maintains a public registry of approved plugins. The registry is a Git repository:

```
uncorded-plugins/
├── registry.json          ← Index of all plugins
├── plugins/
│   ├── t3chat/
│   │   └── listing.json   ← Plugin metadata + screenshots
│   ├── excalidraw/
│   │   └── listing.json
│   └── project-board/
│       └── listing.json
```

### Registry Entry

```json
{
  "id": "t3chat",
  "name": "T3 Chat",
  "description": "AI chat powered by multiple providers.",
  "author": "T3 Community",
  "repository": "https://github.com/t3-community/uncorded-t3chat",
  "image": "ghcr.io/t3-community/uncorded-t3chat",
  "category": "AI",
  "tags": ["ai", "chat"],
  "verified": false,
  "featured": false,
  "downloads": 1523,
  "screenshots": ["screenshot1.png", "screenshot2.png"],
  "latestVersion": "1.2.0",
  "addedAt": "2026-04-15"
}
```

### Discovery Flow

1. Server owner opens Plugin Browser in Electron app
2. Browses categories, searches, or views featured plugins
3. Clicks a plugin → sees description, screenshots, permissions, reviews
4. Clicks Install → reviews permissions → approves
5. Electron pulls Docker image and configures container

### Sideloading

Server owners can install plugins not in the registry by providing a Git repo URL or Docker image directly. This is the "developer mode" path — no review required, but a warning is shown.

### Submission Process

1. Plugin developer opens a PR to the registry repo
2. Automated checks: manifest validation, Docker image builds, basic security scan
3. Manual review for featured/verified status (optional)
4. Merged → plugin appears in the registry

---

## 13. Developer Experience

### Plugin SDK

UnCorded provides an SDK for plugin developers:

**Frontend SDK (`@uncorded/plugin-client`):**

```typescript
import { UnCordedPlugin } from "@uncorded/plugin-client";

const plugin = new UnCordedPlugin();

// Get current user
const user = await plugin.getUser();

// Get server members
const members = await plugin.getMembers();

// Listen for messages
plugin.on("message:create", (message) => {
  console.log(`${message.author.username}: ${message.content}`);
});

// Send a message
await plugin.sendMessage(channelId, "Hello from T3 Chat!");

// Show a notification in UnCorded
plugin.showToast("Analysis complete!", "info");

// Navigate user to a channel
plugin.navigate({ to: "channel", channelId: "abc123" });
```

**Backend SDK (`@uncorded/plugin-server`):**

```typescript
import { UnCordedBridge } from "@uncorded/plugin-server";

const bridge = new UnCordedBridge();

// Get server info
const server = await bridge.getServer();

// Read messages
const messages = await bridge.getMessages(channelId, { limit: 50 });

// Send message
await bridge.sendMessage(channelId, "Hello from backend!");

// Store data
await bridge.storage.set("last-sync", Date.now());
const lastSync = await bridge.storage.get("last-sync");

// Listen for real-time events
bridge.on("message:create", (message) => {
  // Process incoming message
});

// Push update to frontend
await bridge.notify({ type: "analysis-complete", data: { result: "..." } });
```

### Plugin Template

A `create-uncorded-plugin` CLI scaffolds new plugins:

```bash
bunx create-uncorded-plugin my-plugin
```

Generates:

- Manifest with sensible defaults
- Dockerfile optimized for the chosen runtime (Bun/Node/Python)
- Frontend boilerplate with SDK initialized
- Backend boilerplate with Bridge connection
- GitHub Actions workflow for publishing
- `docker-compose.dev.yml` for local development with hot reload

```bash
# Scaffold and immediately sideload into local UnCorded for testing
bunx create-uncorded-plugin my-plugin --sideload
```

The `--sideload` flag builds the Docker image locally and installs it into the running Electron app's plugin host, so the developer sees their plugin in context immediately. Edit → hot reload → see it live.

### Local Development

```bash
# Start plugin in dev mode
cd my-plugin
docker compose -f docker-compose.dev.yml up

# Dev compose mounts source as volume for hot reload
# and connects to a local UnCorded Bridge mock server
```

The SDK includes a mock Bridge Server for local development that simulates UnCorded events and API responses without needing a real UnCorded server. The mock and real Bridge Server are both generated from a shared OpenAPI schema (`@uncorded/bridge-schema`) to prevent drift. If the mock diverges from the real bridge, plugins break in production — the shared schema prevents this.

---

## 14. Migration from Current System

### What Exists Today

- **Plugin catalog**: Hardcoded array in `apps/server/src/routes/plugins.ts` with one entry (claude-code)
- **Plugin installs**: `plugin_installs` table (pluginId + userId flag)
- **Bot system**: Bot accounts with WebSocket token auth, dedicated user records with `isBot: true`
- **Claude channel plugin**: MCP server at `C:\Projects\UnCorded-Plugins\claude-channel` — connects via WebSocket, exposes reply/fetch/edit tools

### Migration Path

**Phase 1 — Keep existing system, build new alongside it:**

- Current Claude bot plugin continues working as-is
- New Docker-based plugins are a separate system
- Both coexist — server owners can have bots AND Docker plugins

**Phase 2 — Unify:**

- Bot accounts become a type of plugin connection
- The Claude channel plugin gets a Dockerfile and becomes a Docker plugin
- Plugin installs table expanded with new fields (config, permissions, state)
- Old hardcoded catalog replaced by registry

**Phase 3 — Deprecate old system:**

- Bot-only plugins migrated to Docker containers
- Old bot auth flow kept for backward compatibility but new plugins use Bridge API

### Database Changes Needed

```sql
-- Expand plugin_installs → plugins (server-scoped, not user-scoped)
CREATE TABLE server_plugins (
  id TEXT PRIMARY KEY,
  server_id TEXT NOT NULL REFERENCES servers(id) ON DELETE CASCADE,
  plugin_id TEXT NOT NULL,
  manifest JSONB NOT NULL,
  config JSONB DEFAULT '{}',
  state TEXT NOT NULL DEFAULT 'installed',
  bridge_token_hash TEXT NOT NULL,
  installed_by TEXT REFERENCES user(id),
  installed_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(server_id, plugin_id)
);

-- Plugin registry cache
CREATE TABLE plugin_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  author TEXT,
  repository TEXT,
  image TEXT,
  category TEXT,
  latest_version TEXT,
  metadata JSONB,
  updated_at TIMESTAMP DEFAULT NOW()
);
```

---

## 15. Electron Integration

### Electron App Architecture

The Electron app is the plugin runtime host. It manages Docker containers and runs the Bridge Server.

```
┌───────────────────────────────────────────────┐
│  UnCorded Desktop (Electron)                   │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Main Process                             │  │
│  │                                           │  │
│  │  ├── Bridge Server (HTTP + WS)            │  │
│  │  │   └── Per-plugin auth + permissions    │  │
│  │  │                                        │  │
│  │  ├── Docker Manager                       │  │
│  │  │   ├── Pull images                      │  │
│  │  │   ├── Start/stop containers            │  │
│  │  │   ├── Health monitoring                │  │
│  │  │   ├── Resource enforcement             │  │
│  │  │   └── Log collection                   │  │
│  │  │                                        │  │
│  │  ├── UnCorded Gateway Connection          │  │
│  │  │   └── WebSocket + MessagePack          │  │
│  │  │                                        │  │
│  │  └── Seeding Engine (WebTorrent)          │  │
│  │      └── Persistent file availability     │  │
│  └──────────────────────────────────────────┘  │
│                                                │
│  ┌──────────────────────────────────────────┐  │
│  │  Renderer Process                         │  │
│  │  └── UnCorded Web App + Plugin iframes    │  │
│  └──────────────────────────────────────────┘  │
└───────────────────────────────────────────────┘
```

### Docker Manager

The Docker Manager communicates with Docker Engine via the Docker API:

```typescript
// Simplified interface
interface DockerManager {
  pullImage(image: string): Promise<void>;
  createContainer(pluginId: string, config: ContainerConfig): Promise<string>;
  startContainer(containerId: string): Promise<void>;
  stopContainer(containerId: string): Promise<void>;
  removeContainer(containerId: string): Promise<void>;
  getContainerStatus(containerId: string): Promise<ContainerStatus>;
  getContainerLogs(containerId: string, tail: number): Promise<string>;
  listContainers(): Promise<ContainerInfo[]>;
}
```

### Docker Requirement

- Electron app checks for Docker on startup
- If not found: shows install guide with one-click link to Docker Desktop
- Plugins are disabled until Docker is available
- Chat and all non-plugin features work without Docker

### Offline Behavior

- Plugins that don't need external APIs continue working offline
- Bridge Server operates locally without internet
- Gateway connection retries with backoff when internet returns

---

## 16. Scaling & Performance

### Per-Server Limits

| Resource             | Free Server | Server Owner |
| -------------------- | ----------- | ------------ |
| Max plugins          | 5           | 15           |
| Total plugin memory  | 2 GB        | 8 GB         |
| Total plugin CPU     | 1 core      | 4 cores      |
| Total plugin storage | 5 GB        | 50 GB        |

### Performance Targets

| Metric                   | Target       |
| ------------------------ | ------------ |
| Plugin iframe load time  | < 2 seconds  |
| Bridge API response time | < 50ms       |
| postMessage round-trip   | < 10ms       |
| Container start time     | < 10 seconds |
| Health check interval    | 10 seconds   |

### Optimizations

- **Lazy loading** — Plugin iframes only load when the user clicks the tab
- **Suspension** — Unused plugin containers can be paused after inactivity (configurable)
- **Image caching** — Docker images cached locally, only pull diffs on update
- **Bridge connection pooling** — Single gateway connection shared across all plugins

---

## 17. Implementation Phases

### Phase 1: Foundation (Electron + Bridge)

**Goal:** Desktop app that runs, connects to UnCorded, and manages Docker containers.

- [ ] Electron app shell (loads UnCorded web app)
- [ ] Gateway connection from Electron main process
- [ ] Docker Manager — pull, start, stop, remove containers
- [ ] Bridge Server — HTTP API + WebSocket events
- [ ] Bridge auth (per-plugin tokens)
- [ ] Health monitoring and auto-restart
- [ ] Plugin settings UI in Electron (install, configure, start/stop)

### Phase 2: UI Integration

**Goal:** Plugins appear in the sidebar and render in the content area.

- [ ] Sidebar plugin tabs (dynamic, based on installed plugins)
- [ ] Content area slot switching (chat ↔ plugin iframe)
- [ ] postMessage bridge (frontend SDK)
- [ ] Permission enforcement (frontend + bridge)
- [ ] Plugin header and right panel slots
- [ ] Loading states and error boundaries for plugin iframes

### Phase 3: Developer Experience

**Goal:** Plugin developers can build, test, and publish plugins.

- [ ] `@uncorded/plugin-client` SDK (npm package)
- [ ] `@uncorded/plugin-server` SDK (npm package)
- [ ] `create-uncorded-plugin` CLI scaffolding tool
- [ ] Mock Bridge Server for local development
- [ ] Plugin template repository
- [ ] Developer documentation site

### Phase 4: Registry & Distribution

**Goal:** Server owners can browse and install plugins from a public registry.

- [ ] Plugin registry repository (GitHub)
- [ ] Registry API (served from UnCorded or static)
- [ ] Plugin Browser UI in Electron app
- [ ] One-click install from browser
- [ ] Version management and updates
- [ ] Sideloading support (direct repo URL / image)

### Phase 5: Ecosystem

**Goal:** Community-driven plugin ecosystem.

- [ ] Plugin submission flow
- [ ] Automated security scanning
- [ ] Plugin reviews and ratings
- [ ] Featured plugins curation
- [ ] Plugin analytics (install counts, usage)
- [ ] Revenue sharing (optional paid plugins — future)

---

## Appendix A: Example Plugins

### Excalidraw Whiteboard

- **Category:** Productivity
- **UI Slot:** Content (fullscreen)
- **Backend:** Serves Excalidraw web app, stores boards in SQLite
- **Permissions:** `users:read`, `presence:read`, `storage:persistent`
- **Use case:** Team brainstorming, architecture diagrams

### GitHub Project Board

- **Category:** Developer
- **UI Slot:** Content (fullscreen)
- **Backend:** GitHub API integration, syncs issues/PRs
- **Permissions:** `chat:write`, `users:read`, `storage:persistent`, `network:external`
- **Config:** GitHub token, repo URL
- **Use case:** Team project management from within UnCorded

### AI Chat (T3Chat-style)

- **Category:** AI
- **UI Slot:** Content (fullscreen)
- **Backend:** Proxies to OpenAI/Anthropic/etc, stores conversations
- **Permissions:** `users:read`, `storage:persistent`, `network:external`
- **Config:** API keys for AI providers
- **Use case:** Team AI assistant with shared conversation history

### Music Player

- **Category:** Media
- **UI Slot:** Panel (sidebar)
- **Backend:** Serves web player, integrates with Spotify/YouTube APIs
- **Permissions:** `presence:read`, `storage:persistent`, `network:external`
- **Config:** Spotify API credentials
- **Use case:** Listen together feature

### Document Viewer

- **Category:** Utility
- **UI Slot:** Content (fullscreen)
- **Backend:** Renders DOCX/PDF/Markdown locally, no external calls
- **Permissions:** `storage:persistent`
- **Use case:** View shared documents without uploading to third-party services

---

## Appendix B: Glossary

| Term              | Definition                                                 |
| ----------------- | ---------------------------------------------------------- |
| **Shell**         | UnCorded's UI frame — sidebar, header, navigation          |
| **Content Area**  | Main viewport that plugins or chat occupy                  |
| **Bridge Server** | HTTP + WS server in Electron that plugins talk to          |
| **Bridge Token**  | Per-plugin auth token for Bridge API access                |
| **Plugin Host**   | The Electron app that manages Docker containers            |
| **Manifest**      | `uncorded-plugin.json` — plugin metadata and configuration |
| **Sideloading**   | Installing a plugin outside the official registry          |
| **Registry**      | Public index of available plugins                          |
