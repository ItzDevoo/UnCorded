# UnCorded — Progress

What is actually built and working right now.
Updated by the coding agent at the end of every session.
This is the real state of the codebase — not what is planned, but what works.

---

## Current Status: Week 2.5 Day 1 — Schema Migration + Tooling Migration

---

### Week 2.5 Day 1 — 2026-03-08
**What was done:**
- Drizzle schema migrated to match P2P pivot (docs/schema.md)
  - Dropped: `attachments` table, `purchases` table, `storage_policy`/`purchase_item`/`purchase_status` enums
  - Added: `file_receipts` table (magnet URI, info hash, metadata), `subscriptions` table (Stripe tiers), `subscription_tier`/`subscription_status` enums
  - Changed: `channels.storage_policy` → `channels.file_sharing_enabled` (boolean), `users.has_extended_expiry` + `has_custom_avatar` → `users.subscription_tier` (enum)
  - Updated all referencing code: shared Zod schemas, server routes (user, channel, server, invite), WS handlers (READY payload), Better Auth config, frontend types (ReadyChannel), UI components (ChannelSidebar badges, CreateServerModal, JoinServerModal)
  - Migration 0003_schema_pivot_p2p.sql applied to Neon DB
- ESLint + Prettier removed, Oxlint + Oxfmt installed
  - Deleted: `eslint.config.js`, `prettier.config.js`, all ESLint/Prettier deps
  - Created: `.oxlintrc.json` (plugins: eslint, oxc, typescript, unicorn), `.oxfmtrc.json`
  - Updated root scripts: `lint` → `oxlint`, `fmt` → `oxfmt .`
  - Removed per-package `lint` scripts (oxlint runs from root)
  - Removed `lint` task from turbo.json pipeline
  - Formatted entire codebase with oxfmt (double quotes, consistent style)
  - Fixed all oxlint warnings: toReversed/toSorted for non-mutating array ops, addEventListener over on-handlers, SolidJS ref suppressions
- All checks pass: typecheck (0 errors), lint (0 warnings/errors), fmt (no changes)

---

### Architectural Pivot — 2026-03-07

**Decision:** Pivoted from server-side ephemeral file storage (Cloudflare R2 + TTL + cron job) to P2P file sharing via WebTorrent (BitTorrent over WebRTC DataChannels).

**What this means:**

- Files NEVER touch our servers — all transfers are direct P2P between users
- WebTorrent handles torrent creation, magnet URIs, and swarm coordination in the browser
- Existing WebSocket gateway becomes the WebRTC signaling relay
- Desktop app (Tauri) planned for persistent seeding from local folder
- Pricing changed from a-la-carte items to subscription tiers (Free / Supporter $5 / Server Owner $10+)
- TURN relay restricted to paid users — honest monetization tied to real infrastructure cost

**What carries forward unchanged:**

- All auth (Better Auth, login/register, sessions)
- All server/channel/member/invite CRUD (routes + UI)
- All messaging (REST API + WS real-time + chat UI + typing indicators)
- WebSocket gateway (extended with WebRTC signaling opcodes)
- App shell, modals, sidebar components

**What's dropped:**

- R2 file storage, presigned uploads, TTL logic, expiry cron job, FILE_EXPIRED opcode
- storage_policy enum (replaced by file_sharing_enabled boolean)
- a-la-carte purchases (custom_avatar, extended_expiry) — replaced by subscription tiers
- attachments table — replaced by file_receipts table

**Previous architecture preserved on GitHub at commit 4ca9500.**

---

### Week 2 Day 4-5 (cont.) — 2026-03-06

**What works:**

- Message list UI with real-time updates wired to WebSocket events
  - `message-store.ts`: SolidJS store for messages per channel, typing indicators, WS listeners for MESSAGE_CREATE/UPDATE/DELETE/TYPING_START
  - `fetchMessages(channelId)`: GET with cursor pagination (`?before=<oldestId>&limit=50`), deduplication, `hasMore` detection
  - Messages cached across channel switches (instant re-render for visited channels)
- `MessageBubble.tsx`: displays author name, content, relative timestamp ("just now", "2m ago", "Mar 6, 2:45 PM"), "(edited)" label
  - Own messages highlighted with `bg-brand/5`, username in brand color
- `MessageInput.tsx`: auto-resizing textarea, Enter to send / Shift+Enter for newline
  - POST `/api/channels/:channelId/messages`, clears + refocuses on success
  - Typing indicator send: throttled to once per 5s per channel via `sendFrame(TYPING_START)`
  - Typing indicator display: "X is typing", "X and Y are typing", "Several people are typing" with animated bouncing dots
- `ChatArea.tsx` rewritten: scrollable message list with `<For>`, auto-scroll on new messages (only if at bottom), "Load older messages" button with cursor pagination, loading spinner, empty state
- Typing dots CSS animation in `index.css` (3 bouncing dots via `@keyframes`)
- Files: `stores/message-store.ts` (new), `components/MessageBubble.tsx` (new), `components/MessageInput.tsx` (new), `components/ChatArea.tsx` (rewritten), `index.css` (typing dots CSS)
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Week 2 Day 6-7 (cont.) — 2026-03-06

**What works:**

- Server creation modal (CreateServerModal)
  - Form with name (required) + icon URL (optional), validated with `createServerSchema` from shared
  - POST /api/servers, injects new server into readyData store via `addServer()`, auto-selects it
  - Loading state, inline error display, close on success
- Join server modal (JoinServerModal)
  - Two-step: enter invite code → preview (server name, icon, member count, storage policy badges) → join
  - POST /api/invites/:code/accept, injects server into store, auto-selects it
  - Handles 404 (not found) and 409 (already member) gracefully
- Invite modal (InviteModal)
  - Auto-generates invite on open via POST /api/servers/:serverId/invites
  - Copy-to-clipboard with "Copied!" feedback
  - Advanced options (max uses, expires in hours) behind toggle, "Generate New" button
- Reusable Modal wrapper (Modal.tsx)
  - Backdrop overlay, centered content, escape key close, backdrop click close
  - Consistent styling across all modals
- ServerSidebar: "+" button opens create modal, arrow-door button opens join modal, both 48x48 with divider
- ChannelSidebar: invite button (person-plus icon) in server name header, opens InviteModal
- gateway-store: `addServer()` helper appends server to readyData via Solid store path-based setter
- Files: `modals/Modal.tsx`, `modals/CreateServerModal.tsx`, `modals/JoinServerModal.tsx`, `modals/InviteModal.tsx` (new), `ServerSidebar.tsx`, `ChannelSidebar.tsx`, `gateway-store.ts` (modified)
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Week 2 Day 6-7 — 2026-03-06

**What works:**

- Server list sidebar renders real servers from gateway READY payload
  - Server icons (image if iconUrl, first-letter fallback), active indicator pill, click to select
  - Home button + add server placeholder retained
- Channel list sidebar renders channels for selected server
  - Sorted by position, active highlight, click to select
  - Storage policy badge: colored dot (ephemeral=orange, extended=blue, persistent=green)
  - Server name in header updates with selection
  - User panel with username/status/logout preserved
- App store (`stores/app-store.ts`): selection signals + derived computations
  - Auto-selects first server on READY, auto-selects first channel on server change
- Chat area placeholder with channel name header
- Gateway lifecycle in AppLayout: connects on session available, disconnects on cleanup
- Loading spinner while gateway connecting, disconnected message on failure
- Backend: READY payload now includes `storagePolicy` field on channels
- Files: `stores/app-store.ts` (new), `components/ChatArea.tsx` (new), `components/ServerSidebar.tsx` (modified), `components/ChannelSidebar.tsx` (modified), `components/AppLayout.tsx` (modified), `server/src/ws/handlers.ts` (modified), `lib/gateway-store.ts` (ReadyChannel type updated)
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Week 2 Day 4-5 — 2026-03-06

**What works:**

- Message CRUD routes at `/api/channels/:channelId/messages`
  - POST `/` — create message with content validation (max 4000 chars), returns message + author info, broadcasts MESSAGE_CREATE to server
  - GET `/` — cursor-based pagination (before/after messageId + limit, default 50, max 100), composite cursor on createdAt + id for tiebreaking, returns oldest-first with author info joined
  - PATCH `/:messageId` — author-only edit, sets editedAt, broadcasts MESSAGE_UPDATE
  - DELETE `/:messageId` — author or server owner can delete, broadcasts MESSAGE_DELETE
- All routes require auth (session) + channel membership (channel → serverId → requireMember)
- WS gateway: TYPING_START handler added — validates identified user, checks channel membership, broadcasts to server (excluding sender) with { channelId, userId, username }
- WS broadcast payloads: MESSAGE_CREATE (full message + author), MESSAGE_UPDATE (id, channelId, content, editedAt), MESSAGE_DELETE (id, channelId), TYPING_START (channelId, userId, username)
- Files: `src/routes/message.ts` (new), `src/ws/gateway.ts` (TYPING_START case added), `src/index.ts` (messageRoutes registered)
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Week 2 Day 2-3 (cont.) — 2026-03-06

**What works:**

- Client-side WebSocket manager (`apps/web/src/lib/gateway.ts`)
  - `connectGateway(token)` / `disconnectGateway()` — full lifecycle control
  - HELLO → IDENTIFY → READY handshake (mirrors server protocol)
  - Heartbeat: sends HEARTBEAT at server-specified interval from HELLO payload
  - Auto-reconnect with exponential backoff (1s base, 30s max), skips on auth failures (4004/4005)
  - `onGatewayEvent(opcode, cb)` — subscribe to any opcode, returns unsubscribe function
  - `sendFrame(frame)` — encode via MessagePack and send (guards on OPEN readyState)
- Reactive gateway store (`apps/web/src/lib/gateway-store.ts`)
  - `gatewayStatus` signal: 'disconnected' | 'connecting' | 'connected'
  - `readyData` store: READY payload (user profile + servers + channels) with `reconcile` for efficient diffing
  - Exported types: ReadyData, ReadyUser, ReadyServer, ReadyChannel
- Separation: gateway-store.ts has zero imports from gateway.ts (prevents circular deps)
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Week 2 Day 2-3 — 2026-03-06

**What works:**

- WebSocket gateway at `/gateway` with full connection lifecycle
- HELLO → IDENTIFY → READY handshake: server sends HELLO with heartbeat interval, client sends IDENTIFY with session token, server validates session in DB and sends READY with user profile + servers + channels (nested, sorted by position)
- Heartbeat monitoring: 30s client interval, 45s server timeout → terminate on miss
- In-memory connection registry (`Map<userId, Set<ws>>`) supporting multiple tabs per user
- Broadcast utilities: `sendToUser()`, `broadcastToServer()` (queries members table per call — future optimization target)
- Presence: user set online on IDENTIFY, offline on last connection close (multi-tab safe via Set size check)
- WeakMap pattern for WS context (userId + heartbeatTimeout) keyed on `ws.raw` — survives Elysia wrapper recreation per event
- Close codes: 4001 (not binary), 4002 (bad msgpack), 4003 (already identified), 4004 (missing token), 4005 (invalid session), 4006 (not identified)
- Files: `src/ws/connections.ts`, `src/ws/handlers.ts`, `src/ws/gateway.ts`
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Week 2 Day 1-2 — 2026-03-06

**What works:**

- Server CRUD: POST /api/servers (creates server + "general" channel + member in transaction), GET (list with channelCount subquery), GET /:id, PATCH /:id, DELETE /:id
- Channel CRUD: POST /api/servers/:serverId/channels (auto-position via max(position)+1), GET (ordered by position), PATCH /api/channels/:id, DELETE /api/channels/:id
- Member routes: GET /api/servers/:serverId/members (joins user table for profile info), DELETE /@me (leave, blocked for owner), DELETE /:userId (kick, owner only)
- Invite routes: POST /api/servers/:serverId/invites (create), GET /api/invites/:code (public preview with memberCount + storagePolicies), POST /api/invites/:code/accept (validates expiry/maxUses, increments uses in transaction)
- Permission helpers: requireMember() and requireOwner() in helpers/permissions.ts
- Auth resolve pattern fixed: returns JSON error body `{ code: 'UNAUTHORIZED', message }` instead of empty 401
- Invite schema added to @uncorded/shared
- All checks pass: typecheck (0 errors), lint (0 errors)

---

### Quick Fixes — 2026-03-06

**What was done:**

- Added `purchaseItemEnum` to Drizzle schema — `purchases.item` is now a proper PG enum (migration 0002 applied)
- Fixed auth resolve to use `request.headers` directly instead of HeadersInit cast
- Typed PATCH /@me update object as `Partial<typeof user.$inferInsert>`
- API client error handling validates response shape before casting to ApiError
- Extracted validation constants (USERNAME_MIN/MAX, PASSWORD_MIN) from shared schemas for client reuse

**All checks pass:** typecheck (0 errors), lint (0 errors), migration applied

---

### Week 1 Day 5-7 — 2026-03-06

**What works:**

- SolidJS + Vite + Tailwind v4 scaffold with @tailwindcss/vite plugin
- Dark theme via @theme block in index.css (bg-primary/secondary/tertiary, text colors, brand, etc.)
- @solidjs/router with lazy-loaded pages: /, /login, /register, /app
- Auth via better-auth/solid client (signIn, signUp, signOut, useSession)
  - All API calls use credentials: "include" for cross-origin cookie auth
- Typed API client (api.ts) with ApiRequestError class
- Login page: email + password, error display, redirect to /app on success
- Register page: email + username + password, error display, redirect to /app on success
- App shell: 3-column layout (72px server sidebar, 240px channel sidebar, flex-1 main area)
  - Server sidebar: home button + create server placeholder
  - Channel sidebar: server name header, channel list placeholder, user panel with username/status/logout
  - Main area: "Welcome to UnCorded" placeholder
- AuthGuard component redirects to /login if not authenticated
- Root route redirects to /app if authenticated, /login if not
- Logout clears session and redirects to /login
- All checks pass: typecheck (0 errors), lint (0 errors), build succeeds

**Backend fix from Day 3-4:**

- Reverted Better Auth middleware from `.all('/api/auth/*')` back to `.mount(auth.handler)` — the `.all()` approach consumed the request body before Better Auth could read it, causing "Body already used" errors on POST requests (registration, login). The `.mount()` approach passes the raw Request without body parsing.
- CORS origin defaults to http://localhost:5173 for Vite dev server

**Known issues:**

- None

---

### Week 1 Day 3-4 — 2026-03-06

**What works:**

- ElysiaJS server scaffold with plugin architecture
- Zod-validated env config with sensible defaults for empty env vars
- Drizzle ORM schema: all 17 tables from schema.md migrated to Neon
- Better Auth configured: email/password + conditional Discord/Google OAuth
- Auth middleware: getSession helper, inline .resolve() guard on protected routes
- GET /api/users/@me, PATCH /api/users/@me
- CORS, rate limiting (300 req/min), global error handler
- GET /health — health check endpoint

---

### Week 1 Day 1-2 — 2026-03-05

**What works:**

- Bun monorepo with workspaces
- Turborepo pipelines (build, typecheck, lint, dev)
- packages/shared: createId, Zod schemas, shared types
- packages/protocol: Opcode enum, MessagePack codec, GatewayFrame
- All checks pass: typecheck, lint, build
