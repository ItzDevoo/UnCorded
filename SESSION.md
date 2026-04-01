# Session: Fix Stubbed Bridge Routes

## What This Is

The sidecar bridge has 4 routes that exist but return empty/stub responses. Plugins that call `bridge.sendMessage()` or `bridge.getMessages()` from the server SDK get "not implemented." This needs to work before launch.

## Scope

Sidecar only. No server, frontend, or database changes.

## Tasks

### 1. Add API getters to PluginLifecycle

**File:** `apps/desktop/sidecar/plugins/lifecycle.ts`

The routes need `apiBaseUrl` and `apiToken` to make authenticated HTTP calls to the REST API. These are currently private fields with no getters.

Add two public methods:
```typescript
getApiBaseUrl(): string | null { return this.apiBaseUrl; }
getApiToken(): string | null { return this.apiToken; }
```

### 2. Create shared API client helper

**New file:** `apps/desktop/sidecar/bridge/api-client.ts`

Extract a reusable fetch helper to avoid duplicating cookie auth + timeout logic across routes.

Reference pattern: `lifecycle.ts` `reportTunnelUrl` method (lines 464-507) shows the HTTP + cookie pattern.

```typescript
// Factory: createApiClient(getBaseUrl, getToken)
// Returns: { get(path, params?), post(path, body?) }
// Handles: Cookie header, Content-Type, AbortController timeout (10s), error wrapping
// Auth: Cookie: __Secure-uncorded.session_token=${token}
```

### 3. Implement GET /bridge/channels/:channelId/messages

**File:** `apps/desktop/sidecar/bridge/routes.ts` (lines 122-128)

Replace stub with:
1. Get `apiBaseUrl` and `apiToken` from `deps.plugins.getApiBaseUrl()` / `deps.plugins.getApiToken()`
2. If either is null, return `gatewayError()` (502)
3. Read query params: `limit` (default 50, clamp to max 100), `before`, `after`
4. Call: `GET ${apiBaseUrl}/api/channels/${channelId}/messages?limit=${limit}&before=${before}&after=${after}`
5. Return response as-is: `{ messages: [...], hasMore: boolean }`

The server endpoint (`apps/server/src/routes/message.ts` line 136) already handles cursor pagination. This is a direct passthrough.

### 4. Implement POST /bridge/channels/:channelId/messages

**File:** `apps/desktop/sidecar/bridge/routes.ts` (lines 130-135)

Replace stub with:
1. Read `body.content` — validate it's a non-empty string, return `badRequestError` if not
2. Call: `POST ${apiBaseUrl}/api/channels/${channelId}/messages` with `{ content }`
3. Server returns 201 with message object
4. Return: `{ sent: true, message: {...} }`

### 5. Implement GET /bridge/presence

**File:** `apps/desktop/sidecar/bridge/routes.ts` (lines 152-154)

Replace stub with:
1. Get gateway ready data: `deps.gateway.getReadyData()`
2. **IMPORTANT:** If gateway is not connected or ready data is null, return `{ presence: [] }` — do NOT crash. The gateway may not have connected yet.
3. Find the plugin's server in ready data using `getPluginServer()` helper (same pattern as the working `/bridge/server` route)
4. Map server members to `{ userId, status }` entries
5. If `ReadyServer.members` type in `apps/desktop/sidecar/gateway/client.ts` doesn't include `status`, extend the type. Check the actual gateway READY payload shape — the status field is likely already sent but not typed.
6. For personal-scope plugins: derive from friends list instead

### 6. Implement POST /bridge/notify

**File:** `apps/desktop/sidecar/bridge/routes.ts` (lines 157-159)

**New file:** `apps/desktop/sidecar/bridge/notifications.ts`

Create a simple in-memory notification queue:
```typescript
interface PluginNotification {
  pluginId: string;
  title: string;
  body: string;
  level?: "info" | "warning" | "error";
  timestamp: number;
}

// push(notification) — add to queue
// drain() — return all pending and clear queue
```

In the route:
1. Validate body has `title` (string) and `body` (string), optional `level`
2. Push to notification queue with `plugin.id` from context
3. Return `{ sent: true }`

**New management endpoint in `apps/desktop/sidecar/bridge/server.ts`:**
- `GET /notifications/pending` — no auth (called by Electron main process, same as `/plugins`). Returns `drain()` result.

The Electron main process already polls plugin state. Add polling for `/notifications/pending` in the same cycle (`apps/desktop/src/main/index.ts`). When notifications arrive, show via `new Notification(...)` from main process.

## What NOT To Do

- Don't modify the server (`apps/server/`)
- Don't modify the frontend (`apps/web/`)
- Don't add database migrations
- Don't change the permission system — it already works
- Don't change the auth middleware — it already validates tokens and permissions

## Verify

1. `bun run typecheck` passes
2. Start sidecar with valid gateway connection
3. Test each route with curl using a valid plugin token:
   - `GET /bridge/channels/{id}/messages` returns real messages
   - `POST /bridge/channels/{id}/messages` sends and returns message
   - `GET /bridge/presence` returns member statuses (or empty array gracefully)
   - `POST /bridge/notify` returns `{ sent: true }`
   - `GET /notifications/pending` returns queued notifications
