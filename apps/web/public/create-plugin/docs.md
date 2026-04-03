# UnCorded Plugin SDK Documentation

Reference for building UnCorded plugins. Optimized for AI-assisted development.

---

## What is UnCorded?

UnCorded is a self-hosted, local-first communication platform. All data lives on the server owner's machine — no cloud dependency. It is a plugin platform with chat built in, not a Discord clone. Server owners install plugins to extend functionality. Plugins run as isolated Docker containers alongside the UnCorded server.

## What is a Plugin?

A plugin is a Docker container that runs alongside the UnCorded server. Its UI is rendered inside an iframe within the UnCorded shell. Plugins communicate with the host via a bridge API (server-side) and PostMessage protocol (client-side). Plugins can be installed one-click from the plugin store or sideloaded via a manifest file.

## Quick Start

```bash
bun create uncorded-plugin my-plugin
cd my-plugin && bun install

# Terminal 1 — start mock bridge
bunx @uncorded/mock-bridge

# Terminal 2 — start plugin dev server
UNCORDED_BRIDGE_URL=http://localhost:7070 UNCORDED_BRIDGE_TOKEN=dev bun run dev
```

## Plugin Manifest (`uncorded-plugin.json`)

```json
{
  "id": "com.example.my-plugin",
  "name": "My Plugin",
  "version": "1.0.0",
  "description": "A brief description of what the plugin does",
  "author": "Your Name",
  "scope": "server",
  "permissions": ["server.read", "messages.read", "messages.send"],
  "runtime": {
    "image": "my-plugin:latest",
    "port": 3000,
    "healthCheck": "/health"
  },
  "ui": {
    "type": "page",
    "sidebar": true
  },
  "icon": "./icon.png",
  "repository": "https://github.com/you/my-plugin",
  "license": "MIT",
  "env": {
    "MY_API_KEY": { "description": "API key for service", "required": true }
  },
  "resources": {
    "cpus": 0.5,
    "memoryMb": 256
  }
}
```

### Field Reference

| Field | Required | Description |
|---|---|---|
| `id` | Yes | Reverse-domain unique identifier |
| `name` | Yes | Human-readable display name |
| `version` | Yes | Semver version string |
| `description` | Yes | Short description |
| `author` | Yes | Author name or org |
| `scope` | Yes | `server` \| `personal` \| `both` |
| `permissions` | Yes | Array of permission strings (see Permissions table) |
| `runtime.image` | Yes | Docker image name |
| `runtime.port` | Yes | Port the plugin listens on |
| `runtime.healthCheck` | Yes | Health check endpoint path |
| `ui.type` | Yes | `panel` \| `page` \| `both` |
| `ui.panelWidth` | No | Panel width in pixels (default: 360) |
| `ui.sidebar` | No | Enable right-side sidebar panel (serves /sidebar route) |
| `icon` | No | Path to plugin icon |
| `repository` | No | Source repository URL |
| `license` | No | SPDX license identifier |
| `env` | No | Environment variable declarations (keys cannot start with `UNCORDED_`) |
| `resources` | No | CPU and memory limits for the container |

## Permissions

| Permission | Description |
|---|---|
| `server.read` | Read server name, icon, and metadata |
| `members.read` | List server members and their roles |
| `channels.read` | List channels and read channel metadata |
| `messages.read` | Read messages in channels |
| `messages.send` | Send messages to channels |
| `users.read` | Read user profiles by ID |
| `presence.read` | Read online/offline status of members |
| `notifications.send` | Send notifications to the server owner |
| `config.read` | Read plugin configuration set by the server owner |
| `storage.read` | Read from plugin key-value storage |
| `storage.write` | Write to plugin key-value storage |

## Server SDK (`@uncorded/plugin-server`)

```bash
bun add @uncorded/plugin-server
```

### Environment Variables

| Variable | Description |
|---|---|
| `UNCORDED_BRIDGE_URL` | Bridge API base URL (e.g. http://bridge:7070) |
| `UNCORDED_BRIDGE_TOKEN` | Auth token for bridge API requests |
| `UNCORDED_TUNNEL_URL` | Public tunnel URL for this plugin (if exposed) |
| `UNCORDED_SERVER_ID` | ID of the server this plugin is installed on |
| `UNCORDED_PLUGIN_ID` | This plugin's unique ID |

### UnCordedBridge API

```typescript
import { UnCordedBridge, createReadinessCheck } from "@uncorded/plugin-server";

const bridge = new UnCordedBridge();

// Server & member data
await bridge.getServer();                          // Server info
await bridge.getMembers();                         // All server members
await bridge.getChannels();                        // All channels
await bridge.getMessages(channelId, { limit: 50 }); // Channel messages

// Actions
await bridge.sendMessage(channelId, content);      // Send a message
await bridge.getUser(userId);                      // Get user by ID
await bridge.getPresence();                        // Online/offline map
await bridge.notify({ title, body });              // Send notification
await bridge.getConfig();                          // Plugin config
await bridge.getTunnelUrl();                       // Public tunnel URL

// Key-value storage
await bridge.storage.get(key);                     // Read value
await bridge.storage.set(key, value, { encrypt: true }); // Write (optionally encrypted)
await bridge.storage.delete(key);                  // Delete key

// Readiness check helper
const { markReady, isReady } = createReadinessCheck();
// Call markReady() once your plugin is initialized
```

## Client SDK (`@uncorded/plugin-client`)

```bash
bun add @uncorded/plugin-client
```

### UnCordedPlugin API

```typescript
import { UnCordedPlugin } from "@uncorded/plugin-client";

const plugin = new UnCordedPlugin();

// Context
plugin.isSidebar;                                  // true if running in sidebar iframe

// Data access
const user = await plugin.getUser();               // Current user
const server = await plugin.getServer();           // Server info
const channels = await plugin.getChannels();       // Channel list
const members = await plugin.getMembers();         // Member list
const presence = await plugin.getPresence();       // Presence map

// Actions
await plugin.sendMessage(channelId, content);      // Send message
plugin.showToast("Saved!", "success");             // Show toast (success|error|info)
plugin.navigate("channel", channelId);             // Navigate shell to channel

// Events
plugin.on("message", (msg) => { /* new message */ });
plugin.on("presence", (data) => { /* presence change */ });
plugin.on("navigate", (data) => { /* shell navigation */ });
plugin.off("message", handler);                    // Remove listener
plugin.destroy();                                  // Cleanup
```

### PostMessage Protocol

Communication between the iframe and shell uses `window.postMessage`. Three message types:

- **request** — plugin sends to shell, expects response (id + method + params)
- **response** — shell replies to plugin (id + result | error)
- **event** — shell pushes to plugin (event name + data)

## Health & Readiness

- `/health` — **Required.** Liveness check. Return 200 OK. The sidecar pings this to know the container is alive.
- `/ready` — **Recommended.** Readiness check. Return 200 when the plugin is fully initialized. The shell shows a loading spinner until this returns 200.

## Plugin Server Template

Complete minimal `src/server.ts`:

```typescript
import { UnCordedBridge, createReadinessCheck } from "@uncorded/plugin-server";

const bridge = new UnCordedBridge();
const { markReady, isReady } = createReadinessCheck();

const server = Bun.serve({
  port: 3000,
  async fetch(req) {
    const url = new URL(req.url);

    // Health & readiness
    if (url.pathname === "/health") return new Response("OK");
    if (url.pathname === "/ready") {
      return isReady()
        ? new Response("OK")
        : new Response("Not ready", { status: 503 });
    }

    // API example: list members
    if (url.pathname === "/api/members") {
      const members = await bridge.getMembers();
      return Response.json(members);
    }

    // Serve static files
    if (url.pathname === "/" || url.pathname === "/index.html") {
      return new Response(Bun.file("public/index.html"));
    }

    const file = Bun.file(`public${url.pathname}`);
    if (await file.exists()) return new Response(file);

    return new Response("Not Found", { status: 404 });
  },
});

markReady();
console.log(`Plugin running on port ${server.port}`);
```

## Sidebar

Plugins can declare a right-side sidebar panel by setting `ui.sidebar: true` in the manifest. The shell loads a second iframe from the plugin's `/sidebar` route.

**Desktop (>=1280px):** Inline panel, 240px wide. **Mobile (<1280px):** Sheet overlay, 288px wide, swipe to close.

Both the main iframe and sidebar iframe receive plugin events via postMessage. Use `plugin.isSidebar` to detect which context you're running in.

### Sidebar Route

```typescript
// In your server.ts
if (url.pathname === "/sidebar") {
  return new Response(sidebarHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "ALLOWALL",
      "content-security-policy": "frame-ancestors *",
    },
  });
}
```

### Sidebar Client

```typescript
import { UnCordedPlugin } from "@uncorded/plugin-client";

const plugin = new UnCordedPlugin();
console.log("Is sidebar:", plugin.isSidebar); // true

// Full SDK access — same permissions as main iframe
const user = await plugin.getUser();
```

## Dockerfile

```dockerfile
FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["bun", "run", "src/server.ts"]
```

## Key Rules

- Everything runs in an **iframe** — plugin UI must work embedded. No access to parent window.
- **Bun only** — never use node, npm, or yarn. All scripts, installs, and runtime use Bun.
- Plugin containers **cannot access the host filesystem**. They are sandboxed Docker containers.
- Permissions are **enforced by the shell** — request only what you need in the manifest.
- Use `bridge.storage` for persistence, not `localStorage`. localStorage is per-browser and won't persist across users or devices.
- `env` keys in the manifest **cannot start with `UNCORDED_`** (reserved prefix).

## Local Development

### Mock Bridge

```bash
bunx @uncorded/mock-bridge --port 7070
```

The mock bridge provides fake data: 3 users, 2 channels, and sample messages. It accepts any Bearer token for authentication.

### Build & Test

```bash
# Build Docker image
docker build -t my-plugin:latest .

# Sideload into UnCorded (POST manifest to sidecar)
curl -X POST http://localhost:7071/plugins/sideload \
  -H "Content-Type: application/json" \
  -d @uncorded-plugin.json
```
