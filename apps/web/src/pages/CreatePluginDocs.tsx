import { A } from "@solidjs/router";
import { buttonVariants } from "../components/ui/button.js";
import { cn } from "../lib/cn.js";

const Code = (props: { children: string; block?: boolean }) => {
  if (props.block) {
    return (
      <pre class="my-3 overflow-x-auto rounded-lg bg-gray-900 p-4 text-sm leading-relaxed text-gray-200">
        <code>{props.children}</code>
      </pre>
    );
  }
  return (
    <code class="rounded bg-gray-800 px-1.5 py-0.5 text-sm text-emerald-400">{props.children}</code>
  );
};

const CreatePluginDocs = () => {
  return (
    <div class="min-h-screen bg-gray-950 text-gray-100">
      <nav class="sticky top-0 z-50 border-b border-gray-800 bg-gray-950/90 backdrop-blur-sm">
        <div class="mx-auto flex h-14 max-w-4xl items-center px-4">
          <A href="/" class={cn(buttonVariants({ variant: "ghost", size: "sm" }))}>
            &larr; Back to Home
          </A>
        </div>
      </nav>

      <main class="mx-auto max-w-4xl px-4 py-12">
        <h1 class="mb-2 text-3xl font-bold tracking-tight text-white">
          UnCorded Plugin SDK Documentation
        </h1>
        <p class="mb-10 text-sm text-gray-400">
          Reference for building UnCorded plugins. Optimized for AI-assisted development.
        </p>

        <div class="space-y-12 text-sm leading-relaxed text-gray-300">
          {/* 1. What is UnCorded */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">What is UnCorded?</h2>
            <p>
              UnCorded is a self-hosted, local-first communication platform. All data lives on the
              server owner's machine — no cloud dependency. It is a plugin platform with chat built
              in, not a Discord clone. Server owners install plugins to extend functionality.
              Plugins run as isolated Docker containers alongside the UnCorded server.
            </p>
          </section>

          {/* 2. What is a Plugin */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">What is a Plugin?</h2>
            <p>
              A plugin is a Docker container that runs alongside the UnCorded server. Its UI is
              rendered inside an iframe within the UnCorded shell. Plugins communicate with the host
              via a bridge API (server-side) and PostMessage protocol (client-side). Plugins can be
              installed one-click from the plugin store or sideloaded via a manifest file.
            </p>
          </section>

          {/* 3. Quick Start */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Quick Start</h2>
            <Code block>{`bun create uncorded-plugin my-plugin
cd my-plugin && bun install

# Terminal 1 — start mock bridge
bunx @uncorded/mock-bridge

# Terminal 2 — start plugin dev server
UNCORDED_BRIDGE_URL=http://localhost:7070 UNCORDED_BRIDGE_TOKEN=dev bun run dev`}</Code>
          </section>

          {/* 4. Plugin Manifest */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">
              Plugin Manifest (<Code>uncorded-plugin.json</Code>)
            </h2>
            <Code block>{`{
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
}`}</Code>

            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">Field Reference</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-800 text-gray-400">
                    <th class="pb-2 pr-4">Field</th>
                    <th class="pb-2 pr-4">Required</th>
                    <th class="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/50">
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">id</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Reverse-domain unique identifier</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">name</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Human-readable display name</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">version</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Semver version string</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">description</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Short description</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">author</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Author name or org</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">scope</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">
                      <Code>server</Code> | <Code>personal</Code> | <Code>both</Code>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">permissions</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Array of permission strings (see Permissions table)</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">runtime.image</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Docker image name</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">runtime.port</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Port the plugin listens on</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">runtime.healthCheck</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">Health check endpoint path</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">ui.type</td>
                    <td class="py-1.5 pr-4">Yes</td>
                    <td class="py-1.5">
                      <Code>panel</Code> | <Code>page</Code> | <Code>both</Code>
                    </td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">ui.panelWidth</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">Panel width in pixels (default: 360)</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">ui.sidebar</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">Enable right-side sidebar panel (serves /sidebar route)</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">icon</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">Path to plugin icon</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">repository</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">Source repository URL</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">license</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">SPDX license identifier</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">env</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">
                      Environment variable declarations (keys cannot start with UNCORDED_)
                    </td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">resources</td>
                    <td class="py-1.5 pr-4">No</td>
                    <td class="py-1.5">CPU and memory limits for the container</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 5. Permissions */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Permissions</h2>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-800 text-gray-400">
                    <th class="pb-2 pr-4">Permission</th>
                    <th class="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/50">
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">server.read</td>
                    <td class="py-1.5">Read server name, icon, and metadata</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">members.read</td>
                    <td class="py-1.5">List server members and their roles</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">channels.read</td>
                    <td class="py-1.5">List channels and read channel metadata</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">messages.read</td>
                    <td class="py-1.5">Read messages in channels</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">messages.send</td>
                    <td class="py-1.5">Send messages to channels</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">users.read</td>
                    <td class="py-1.5">Read user profiles by ID</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">presence.read</td>
                    <td class="py-1.5">Read online/offline status of members</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">notifications.send</td>
                    <td class="py-1.5">Send notifications to the server owner</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">config.read</td>
                    <td class="py-1.5">Read plugin configuration set by the server owner</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">storage.read</td>
                    <td class="py-1.5">Read from plugin key-value storage</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">storage.write</td>
                    <td class="py-1.5">Write to plugin key-value storage</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          {/* 6. Server SDK */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">
              Server SDK (<Code>@uncorded/plugin-server</Code>)
            </h2>
            <Code block>bun add @uncorded/plugin-server</Code>

            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">Environment Variables</h3>
            <div class="overflow-x-auto">
              <table class="w-full text-left text-sm">
                <thead>
                  <tr class="border-b border-gray-800 text-gray-400">
                    <th class="pb-2 pr-4">Variable</th>
                    <th class="pb-2">Description</th>
                  </tr>
                </thead>
                <tbody class="divide-y divide-gray-800/50">
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">UNCORDED_BRIDGE_URL</td>
                    <td class="py-1.5">Bridge API base URL (e.g. http://bridge:7070)</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">UNCORDED_BRIDGE_TOKEN</td>
                    <td class="py-1.5">Auth token for bridge API requests</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">UNCORDED_TUNNEL_URL</td>
                    <td class="py-1.5">Public tunnel URL for this plugin (if exposed)</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">UNCORDED_SERVER_ID</td>
                    <td class="py-1.5">ID of the server this plugin is installed on</td>
                  </tr>
                  <tr>
                    <td class="py-1.5 pr-4 font-mono text-emerald-400">UNCORDED_PLUGIN_ID</td>
                    <td class="py-1.5">This plugin's unique ID</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">UnCordedBridge API</h3>
            <Code
              block
            >{`import { UnCordedBridge, createReadinessCheck } from "@uncorded/plugin-server";

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
// Call markReady() once your plugin is initialized`}</Code>
          </section>

          {/* 7. Client SDK */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">
              Client SDK (<Code>@uncorded/plugin-client</Code>)
            </h2>
            <Code block>bun add @uncorded/plugin-client</Code>

            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">UnCordedPlugin API</h3>
            <Code block>{`import { UnCordedPlugin } from "@uncorded/plugin-client";

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
plugin.destroy();                                  // Cleanup`}</Code>

            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">PostMessage Protocol</h3>
            <p>
              Communication between the iframe and shell uses <Code>window.postMessage</Code>. Three
              message types:
            </p>
            <ul class="mt-2 list-disc space-y-1 pl-5">
              <li>
                <strong class="text-white">request</strong> — plugin sends to shell, expects
                response (id + method + params)
              </li>
              <li>
                <strong class="text-white">response</strong> — shell replies to plugin (id + result
                | error)
              </li>
              <li>
                <strong class="text-white">event</strong> — shell pushes to plugin (event name +
                data)
              </li>
            </ul>
          </section>

          {/* 8. Health & Readiness */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Health &amp; Readiness</h2>
            <ul class="list-disc space-y-2 pl-5">
              <li>
                <Code>/health</Code> — <strong class="text-white">Required.</strong> Liveness check.
                Return 200 OK. The sidecar pings this to know the container is alive.
              </li>
              <li>
                <Code>/ready</Code> — <strong class="text-white">Recommended.</strong> Readiness
                check. Return 200 when the plugin is fully initialized. The shell shows a loading
                spinner until this returns 200.
              </li>
            </ul>
          </section>

          {/* 9. Plugin Server Template */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Plugin Server Template</h2>
            <p class="mb-2">
              Complete minimal <Code>src/server.ts</Code>:
            </p>
            <Code
              block
            >{`import { UnCordedBridge, createReadinessCheck } from "@uncorded/plugin-server";

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

    const file = Bun.file(\`public\${url.pathname}\`);
    if (await file.exists()) return new Response(file);

    return new Response("Not Found", { status: 404 });
  },
});

markReady();
console.log(\`Plugin running on port \${server.port}\`);`}</Code>
          </section>

          {/* 10. Sidebar */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Sidebar</h2>
            <p class="mb-3 text-gray-300">
              Plugins can declare a right-side sidebar panel by setting{" "}
              <Code>ui.sidebar: true</Code> in the manifest. The shell loads a second iframe from
              the plugin's <Code>/sidebar</Code> route.
            </p>
            <p class="mb-3 text-sm text-gray-400">
              <strong>Desktop (≥1280px):</strong> Inline panel, 240px wide.{" "}
              <strong>Mobile (&lt;1280px):</strong> Sheet overlay, 288px wide, swipe to close.
            </p>
            <p class="mb-3 text-sm text-gray-400">
              Both the main iframe and sidebar iframe receive plugin events via postMessage. Use{" "}
              <Code>plugin.isSidebar</Code> to detect which context you're running in.
            </p>
            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">Sidebar Route</h3>
            <Code block>{`// In your server.ts
if (url.pathname === "/sidebar") {
  return new Response(sidebarHtml, {
    headers: {
      "content-type": "text/html; charset=utf-8",
      "x-frame-options": "ALLOWALL",
      "content-security-policy": "frame-ancestors *",
    },
  });
}`}</Code>
            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">Sidebar Client</h3>
            <Code block>{`import { UnCordedPlugin } from "@uncorded/plugin-client";

const plugin = new UnCordedPlugin();
console.log("Is sidebar:", plugin.isSidebar); // true

// Full SDK access — same permissions as main iframe
const user = await plugin.getUser();`}</Code>
          </section>

          {/* 11. Docker */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Dockerfile</h2>
            <Code block>{`FROM oven/bun:1-alpine
WORKDIR /app
COPY package.json bun.lock* ./
RUN bun install --frozen-lockfile
COPY . .
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \\
  CMD wget -qO- http://127.0.0.1:3000/health || exit 1
CMD ["bun", "run", "src/server.ts"]`}</Code>
          </section>

          {/* 12. Key Rules */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Key Rules</h2>
            <ul class="list-disc space-y-2 pl-5">
              <li>
                Everything runs in an <strong class="text-white">iframe</strong> — plugin UI must
                work embedded. No access to parent window.
              </li>
              <li>
                <strong class="text-white">Bun only</strong> — never use node, npm, or yarn. All
                scripts, installs, and runtime use Bun.
              </li>
              <li>
                Plugin containers{" "}
                <strong class="text-white">cannot access the host filesystem</strong>. They are
                sandboxed Docker containers.
              </li>
              <li>
                Permissions are <strong class="text-white">enforced by the shell</strong> — request
                only what you need in the manifest.
              </li>
              <li>
                Use <Code>bridge.storage</Code> for persistence, not <Code>localStorage</Code>.
                localStorage is per-browser and won't persist across users or devices.
              </li>
              <li>
                <Code>env</Code> keys in the manifest{" "}
                <strong class="text-white">cannot start with UNCORDED_</strong> (reserved prefix).
              </li>
            </ul>
          </section>

          {/* 13. Local Development */}
          <section>
            <h2 class="mb-3 text-xl font-semibold text-white">Local Development</h2>

            <h3 class="mb-2 mt-2 text-base font-semibold text-gray-200">Mock Bridge</h3>
            <Code block>{`bunx @uncorded/mock-bridge --port 7070`}</Code>
            <p class="mt-2">
              The mock bridge provides fake data: 3 users, 2 channels, and sample messages. It
              accepts any Bearer token for authentication.
            </p>

            <h3 class="mb-2 mt-4 text-base font-semibold text-gray-200">Build &amp; Test</h3>
            <Code block>{`# Build Docker image
docker build -t my-plugin:latest .

# Sideload into UnCorded (POST manifest to sidecar)
curl -X POST http://localhost:7071/plugins/sideload \\
  -H "Content-Type: application/json" \\
  -d @uncorded-plugin.json`}</Code>
          </section>
        </div>
      </main>
    </div>
  );
};

export default CreatePluginDocs;
