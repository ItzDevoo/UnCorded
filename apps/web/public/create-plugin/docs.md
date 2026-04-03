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

## Iframe Headers (Required)

All HTML responses served to the iframe **must** include these headers, or the browser will block loading:

```typescript
headers: {
  "content-type": "text/html; charset=utf-8",
  "x-frame-options": "ALLOWALL",
  "content-security-policy": "frame-ancestors *",
}
```

This applies to every route that returns HTML — `/`, `/sidebar`, and any other page your plugin serves. Without these headers, the iframe will show a blank page or a loading error.

The plugin iframe sandbox is configured as:
```
sandbox="allow-scripts allow-forms allow-popups allow-same-origin"
```

`allow-same-origin` is required so the iframe can fetch its own scripts and assets (e.g. `<script src="/app.js">`). Without it, the iframe gets an opaque origin and all same-origin requests fail silently.

## Icons

The `icon` field in the manifest can be:
- A **relative file path** (e.g. `./icon.png`) — bundled in the Docker image
- A **URL to a hosted image** — use a raw GitHub URL so the icon is always accessible

For hosted icons, use your plugin's git repository:
```
https://raw.githubusercontent.com/your-org/your-plugin/main/icon.png
```

This ensures the icon is viewable in the plugin store and server settings even when the plugin container is not running. Recommended format: SVG or PNG, square, at least 128x128px.

Example in manifest:
```json
{
  "icon": "https://raw.githubusercontent.com/your-org/your-plugin/main/icon.svg"
}
```

## Local Development

### Mock Bridge

```bash
bunx @uncorded/mock-bridge --port 7070
```

The mock bridge provides fake data: 3 users, 2 channels, and sample messages. It accepts any Bearer token for authentication.

### Running Locally

```bash
# Terminal 1 — mock bridge
bunx @uncorded/mock-bridge --port 7070

# Terminal 2 — plugin dev server
UNCORDED_BRIDGE_URL=http://localhost:7070 UNCORDED_BRIDGE_TOKEN=dev bun run dev
```

Your plugin runs at `http://localhost:3000`. The sidebar is at `http://localhost:3000/sidebar`.

### Testing in Docker

```bash
# Build image
docker build -t my-plugin:latest .

# Run standalone (for testing)
docker run --rm -p 3000:3000 \
  -e UNCORDED_BRIDGE_URL=http://host.docker.internal:7070 \
  -e UNCORDED_BRIDGE_TOKEN=dev \
  my-plugin:latest

# Verify health
curl http://localhost:3000/health
```

## Building & Docker

### Dockerfile

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

If your plugin has a frontend build step (Vite, etc.), add it before the CMD:

```dockerfile
COPY . .
RUN bun run build
EXPOSE 3000
```

### Image Naming

Use versioned tags for production — never rely on `:latest` alone:
```bash
docker build -t my-plugin:1.0.0 -t my-plugin:latest .
```

## Sideloading (Testing with UnCorded)

Sideloading installs a plugin directly into a running UnCorded instance without going through the plugin store.

### Step 1 — Build the Docker image

```bash
docker build -t my-plugin:latest .
```

### Step 2 — Find the sidecar port

In the UnCorded desktop app, open DevTools (Ctrl+Shift+I) and run:
```js
await window.desktopBridge.getSidecarPort()
```

### Step 3 — Install the plugin

```bash
curl -X POST http://127.0.0.1:{SIDECAR_PORT}/plugins/install \
  -H "Content-Type: application/json" \
  -d '{
    "manifest": { ... your uncorded-plugin.json contents ... },
    "scope": "server",
    "serverId": "your-server-id"
  }'
```

### Step 4 — Start the plugin

```bash
curl -X POST http://127.0.0.1:{SIDECAR_PORT}/plugins/{PLUGIN_ID}/start
```

### Managing sideloaded plugins

```bash
# Restart (keeps same container)
curl -X POST http://127.0.0.1:{PORT}/plugins/{ID}/restart

# Stop
curl -X POST http://127.0.0.1:{PORT}/plugins/{ID}/stop

# Uninstall (removes container)
curl -X POST http://127.0.0.1:{PORT}/plugins/{ID}/uninstall
```

**Important:** `restart` reuses the existing Docker container. If you rebuild the image, you must `uninstall` and `install` again to pick up the new image.

## Publishing to the Plugin Store

### Step 1 — Submit your plugin

Authenticated API call:
```bash
POST /api/developer/plugins
```

Required fields:
```json
{
  "id": "my-plugin",
  "name": "My Plugin",
  "description": "What your plugin does (10-500 chars)",
  "author": "Your Name",
  "category": "productivity",
  "scope": "server",
  "image": "my-plugin:1.0.0",
  "version": "1.0.0",
  "manifest": {
    "runtime": { "image": "my-plugin:1.0.0", "port": 3000, "healthCheck": "/health" },
    "permissions": ["server.read", "storage.read", "storage.write"]
  },
  "tags": ["whiteboard", "collaboration"],
  "repository": "https://github.com/you/my-plugin",
  "screenshots": ["https://raw.githubusercontent.com/you/my-plugin/main/screenshot.png"]
}
```

Categories: `ai`, `productivity`, `developer`, `media`, `social`, `utility`, `other`

### Step 2 — Review

Submitted plugins go through review. Check status:
```bash
GET /api/developer/plugins/{pluginId}/status
```

Statuses: `pending` → `approved` (published) or `rejected` (with reason).

### Step 3 — After approval

Your plugin appears in the UnCorded plugin store. Server owners can install it with one click.

## Version Updates

### Pushing new versions

After your plugin is published, push updates:
```bash
PUT /api/developer/plugins/{pluginId}/version
```

```json
{
  "version": "1.1.0",
  "image": "my-plugin:1.1.0",
  "manifest": { ... updated manifest if changed ... }
}
```

Version must be greater than the current version (semver comparison). If the image or manifest changes, the plugin goes through re-review.

### Auto-updates

The UnCorded desktop app checks for plugin updates automatically. When a new version is available:
1. The sidecar calls `POST /api/plugins/check-updates` with installed plugin versions
2. If updates are available, the desktop app shows an update notification
3. Server owners can apply updates from the plugin settings page
4. The sidecar pulls the new Docker image, recreates the container, and restarts

Use immutable versioned image tags (e.g. `my-plugin:1.0.0`, not just `:latest`) so version comparison works correctly.

## UI Styling

Plugin iframes should match the UnCorded shell's dark theme. Recommended CSS variables:

| Element | Color | Hex |
|---|---|---|
| Main content background | `bg-card` | `#111111` |
| Sidebar background | `bg-sidebar` | `#0a0a0a` |
| Text | `text-foreground` | `#e8e8e8` |
| Muted text | `text-muted-foreground` | `#6b6b6b` |
| Borders | `border-border` | `#2a2a2a` |
| Accent / hover | `bg-accent` | `#181818` |

Use these colors in your plugin's HTML/CSS to seamlessly blend with the shell. The shell uses Tailwind semantic tokens internally — these hex values are the resolved defaults.

## Responsive Breakpoints

The UnCorded shell uses these breakpoints:

| Breakpoint | Width | Behavior |
|---|---|---|
| Mobile | < 768px | Left sidebar is a sheet overlay, single column |
| Tablet | 768px - 1279px | Left sidebar fixed, plugin sidebar is sheet overlay |
| Desktop | >= 1280px | Left sidebar fixed, plugin sidebar inline (240px) |

Design your plugin UI to work at all three sizes. The sidebar iframe is 240px wide on desktop and 288px as a sheet overlay on mobile.
