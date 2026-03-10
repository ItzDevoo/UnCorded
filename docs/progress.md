# UnCorded — Progress

What is actually built and working right now.
Updated by the coding agent at the end of every session.
This is the real state of the codebase — not what is planned, but what works.

---

## Current Status: Pre-Week 4 Review — 12 correctness/validation/accessibility fixes

---

### Pre-Week 4 Review Fixes — 2026-03-09

**What was done:**

- 12 review fixes across P2P file sharing, friend system, and message store:
  - Fix #1 (High): All 4 console.warn calls in message-store.ts gated behind import.meta.env.DEV
  - Fix #2 (High): Friends.tsx async onClick handlers (accept/decline/remove/unblock) wrapped with try/catch + actionError signal shown in UI
  - Fix #3 (High): Zod .min(1) param validation on all 4 friend route params (:userId) in friend.ts
  - Fix #4 (High): dm.ts has no route params — body validation already uses createDmSchema with .min(1). No changes needed.
  - Fix #5 (Medium): handlers.ts readyDmChannels/readyFriends local types updated to use branded ReturnType<> instead of string. Removed 3 `as string` casts.
  - Fix #6 (Medium): Friends.tsx 4 `as string` casts on friend.userId removed — UserId (branded) is assignable to string parameters.
  - Fix #7 (Medium): message-store fetchMessages catch block now sets fetchError on ChannelMessages interface for UI consumption.
  - Fix #8 (Low): 5 magic numbers in gateway.ts Zod schemas extracted to named constants (MAX_SDP_SIZE, MAX_FILE_NAME_LENGTH, etc.)
  - Fix #9 (Low): servers.ownerId FK annotated with { onDelete: "restrict" } for explicit documentation. Matches PostgreSQL default NO ACTION behavior.
  - Fix #10 (Low): progress.md already current — no changes needed.
  - Fix #11 (Low): FileMessage.tsx thumbnail <img> made keyboard-accessible with tabIndex={0}, role="button", and onKeyDown handler (Enter/Space triggers download)
  - Fix #12 (Low): FileMessage.tsx transfer()!.downloadSpeed replaced with transfer()?.downloadSpeed ?? 0
- All checks pass: typecheck (0 errors), lint (0 warnings), fmt clean

---

### Week 3 Post-Review Fixes — 2026-03-09

**What was done:**

- 9 review fixes across P2P file sharing and WebRTC signaling code:
  - Fix #1: subscriptionTier added to READY user payload (server select + ReadyUser interface + Zod schema). FileMessage.tsx no longer uses unsafe cast — reads subscriptionTier directly from readyData.
  - Fix #2: FileDropZone shows visible error text when file exceeds 100MB (was silent console.warn). Error clears on next valid drop.
  - Fix #3: webRtcSignalSchema targetUserId + channelId now have .min(1) — reject empty strings.
  - Fix #4: signalingEventSchema fromUserId + channelId now have .min(1) — reject empty strings.
  - Fix #5: z.record() in WebRTC data field bounded with .refine() — JSON.stringify ≤16KB cap.
  - Fix #6: Branded constructors (userId(), channelId()) used at signaling parse boundary instead of `as SignalingEvent` cast.
  - Fix #7: MAX_FILE_SIZE_BYTES constant created in packages/shared/src/constants.ts, imported by both server gateway and FileDropZone. Local duplicates removed.
  - Fix #8: console.warn in FileDropZone gated behind import.meta.env.DEV.
  - Fix #9: Server gateway `raw as ArrayBuffer` replaced with proper instanceof chain (Uint8Array | ArrayBuffer | bail).
- All checks pass: typecheck (0 errors), lint (0 warnings), fmt clean

---

### Week 3 Day 7 — 2026-03-09

**What was done:**

- Code review fixes (13 items from Day 5-6 review):
  - Fix #1 (High): Bounded WebRTC data field — SDP strings ≤16KB, ICE candidates as bounded records
  - Fix #2 (High): readyDataSchema Zod validation for READY payload on client, close WS + log on failure
  - Fix #3 (High): HELLO heartbeatInterval validated with Number.isFinite + positive check
  - Fix #4 (High): Server fileShareSchema max file size 100MB
  - Fix #5-6 (Medium): .min(1) on fileAvailabilitySchema IDs + typingStartSchema channelId
  - Fix #7 (Medium): 5-minute download timeout on downloadFromMagnet with torrent destroy on timeout
  - Fix #8 (Medium): "cancelled" status in TransferProgress union + Cancelled badge with retry in FileMessage
  - Fix #9 (Medium): seedFile race condition — client-level error handler attached before seed(), removed after torrent created
  - Fix #10 (Medium): All console.warn/error in production client code gated behind import.meta.env.DEV
  - Fix #11 (Low): FREE_TIER constant replaces magic "free" string in tier check
  - Fix #13 (Low): TODO comment on broadcastToServer for future cache optimization
  - Schema docs: member_roles cascade info for all three FKs
- Friend system backend:
  - `apps/server/src/routes/friend.ts`: POST /request (with auto-accept for mutual requests), POST /:userId/accept, POST /:userId/decline, POST /:userId/block, DELETE /:userId, GET / (list accepted), GET /pending (list incoming)
  - All routes broadcast real-time WS events (FRIEND_REQUEST, FRIEND_ACCEPT, FRIEND_REMOVE)
- DM channel backend:
  - `apps/server/src/routes/dm.ts`: POST / (create or get existing DM, requires friendship), GET / (list user's DMs with other user info)
  - DM_CHANNEL_CREATE broadcast on creation
- DM message support:
  - `apps/server/src/routes/message.ts`: replaced getChannelServerId() with resolveChannel() that checks both server channels AND DM channels
  - broadcastToDm() helper sends frames to other DM members
  - All 4 message routes (POST/GET/PATCH/DELETE) updated to work for both server and DM channels
- READY payload expanded:
  - `apps/server/src/ws/handlers.ts`: loads dmChannels (via dm_members join) and friends (via friendships table) and includes them in READY
- Frontend friend system:
  - `apps/web/src/stores/friend-store.ts`: WS listeners for FRIEND_REQUEST/ACCEPT/REMOVE + API functions
  - `apps/web/src/lib/gateway-store.ts`: ReadyDmChannel/ReadyFriend types, readyDataSchema, addDmChannel/addFriend/removeFriend/updateFriendStatus helpers
  - `apps/web/src/pages/Friends.tsx`: All/Pending/Blocked tabs, add friend input, accept/decline/remove buttons
- Frontend DM support:
  - `apps/web/src/stores/app-store.ts`: selectedDmChannelId signal, selectDmChannel/selectHome helpers
  - `apps/web/src/components/DMList.tsx`: DM channel list with avatars, online dots, active highlight
  - `apps/web/src/components/ChannelSidebar.tsx`: toggles between channel list (server selected) and DM list + Friends button (home selected)
  - `apps/web/src/components/ChatArea.tsx`: works for both server channels and DM channels, shows "@username" header for DMs
  - `apps/web/src/components/ServerSidebar.tsx`: home button calls selectHome()
  - `apps/web/src/components/AppLayout.tsx`: routes to ChatArea for both server and DM selections
  - `apps/web/src/App.tsx`: /app/friends route added
- Shared schemas: friendRequestSchema + createDmSchema in packages/shared
- All checks pass: typecheck (0 errors), lint (0 warnings), fmt clean

---

### Week 3 Day 5-6 — 2026-03-09

**What was done:**

- Code review fixes (9 issues from Day 3-4 review):
  - Fix #1 (High): Subscription tier gate on FILE_SHARE — free users blocked from server channel file sharing
  - Fix #2 (High): ArrayBuffer instanceof guard in client gateway before decode()
  - Fix #3 (Medium): Explanatory comments on broadcastToServer() usage (no per-channel perms yet)
  - Fix #4 (Medium): Zod input bounds on fileShareSchema (min/max/positive/startsWith)
  - Fix #5 (Medium): Zod schema for inbound signaling events in signaling.ts
  - Fix #6 (Medium): Safe raw cast in server gateway (Uint8Array instanceof check)
  - Fix #7 (Medium): Shape validation in decode() — throws on missing op/d fields
  - Fix #8 (Medium): Runtime guards on HELLO/READY payloads in client gateway
  - Fix #9 (Low): Explanatory comment on frame.op as Opcode cast in WebRTC handler
- Schema docs: Better Auth export name note, cascade info on members/friendships/dm_members
- DM File Sharing UI components:
  - `FileDropZone.tsx`: drag-and-drop overlay with 100MB size validation, dragCounter for nested elements
  - `FileMessage.tsx`: file receipt display with idle/downloading/done/error/seeding states, download progress bar, seeder count badges, image thumbnail generation via OffscreenCanvas, error messaging for free users/no seeders
  - ChatArea wired with FileDropZone wrapper and shareFile integration
  - MessageInput onPaste handler for clipboard file detection
  - VirtualMessageList renders FileMessage components for channel file receipts
  - file-store downloadFile() now returns File[] for caller thumbnail generation
- DM wiring SKIPPED — DM routes don't exist yet (schema only)
- All checks pass: typecheck (0 errors), lint (0 warnings), fmt clean

---

### Week 3 Day 3-4 — 2026-03-09

**What was done:**

- Carryover review fixes from Day 1-2:
  - Fix #1: Target user membership validation in WebRTC signaling handlers — sender AND target must be members of the same server before forwarding signaling frames
  - Fix #2: Split `FileSharePayload` into `FileShareRequest` (client sends) + `FileShareBroadcast` (server broadcasts with senderId + fileReceiptId) in `packages/protocol/src/signaling.ts`
  - Fix #3: Configurable STUN servers in `apps/web/src/lib/rtc-config.ts` — reads `VITE_STUN_SERVERS` env var (JSON array), falls back to Google public STUN
- WebTorrent integration:
  - Installed `webtorrent` + `@types/webtorrent` in apps/web
  - Created `apps/web/src/lib/torrent-client.ts` — singleton WebTorrent client manager:
    - `initTorrentClient()` / `destroyTorrentClient()` — lifecycle with HMR cleanup
    - `seedFile(file)` — creates torrent from File, returns magnetUri + infoHash
    - `downloadFromMagnet(magnetUri, onProgress)` — downloads via WebRTC, converts to File[]
    - `stopSeeding(infoHash)` — removes active torrent
    - `getActiveTorrents()` — lists all active torrents with progress/speed/peers
    - STUN config applied via simple-peer's `Peer.config` before client creation
  - Created `apps/web/src/stores/file-store.ts` — SolidJS file sharing store:
    - Follows message-store.ts pattern: `createStore` + `produce` + Zod schemas + `onGatewayEvent` + HMR cleanup
    - Store: `receipts` (channelId → FileReceipt[]), `transfers` (infoHash → TransferProgress), `seeders` (fileReceiptId → userId[])
    - `shareFile(channelId, file)` — seeds via torrent-client, sends FILE_SHARE frame
    - `downloadFile(magnetUri, fileName)` — downloads via torrent-client, triggers browser save
    - `getReceipts(channelId)`, `getTransferProgress(infoHash)`, `getSeeders(fileReceiptId)`
    - WS listeners: FILE_SHARE → addReceipt with branded types, FILE_AVAILABILITY_UPDATE → updateSeeders
- All checks pass: typecheck (0 errors), lint (0 warnings), fmt clean

---

### Week 3 Day 1-2 — 2026-03-08

**What was done:**

- Dev runner review fixes (`scripts/dev-runner.ts`):
  - Port offset upper bound guard: rejects offsets that would exceed port 65535
  - `checkPort()` timeout: 5s safety timeout prevents hangs on unresponsive listen attempts
  - Explicit comment on EADDRNOTAVAIL vs other errors
- Auto-kill for occupied ports:
  - `findPidOnPort()`: Windows (`netstat -ano | findstr`), macOS/Linux (`lsof -ti`)
  - `killProcess()`: Windows (`taskkill /PID /F`), macOS/Linux (`kill -9`)
  - `autoKillPort()`: find → kill → verify port freed, with 500ms grace period
  - `ensurePortsAvailable()` auto-kills busy ports before erroring
  - `--no-kill` flag skips auto-kill, uses old error-and-exit behavior
- Auth trustedOrigins comment added (APP_URL always has a value)
- WebRTC opcodes added to `@uncorded/protocol`:
  - WEBRTC_OFFER (30), WEBRTC_ANSWER (31), WEBRTC_ICE_CANDIDATE (32), FILE_SHARE (33), FILE_AVAILABILITY_UPDATE (34)
  - Replaced FILE_EXPIRED (30) which was dropped in the P2P pivot
- Signaling frame types (`packages/protocol/src/signaling.ts`):
  - `WebRtcSignalPayload`, `FileSharePayload`, `FileAvailabilityPayload`
  - Exported from protocol index
- Server-side signaling handlers (5 new gateway cases):
  - WEBRTC_OFFER/ANSWER/ICE_CANDIDATE: Zod-validated, membership-checked, forwarded to target via `sendToUser()` with sender info
  - FILE_SHARE: validates membership, inserts `fileReceipts` row, broadcasts to channel
  - FILE_AVAILABILITY_UPDATE: validates membership, broadcasts to channel
  - All cases require identified user, silently drop if target offline
- Client-side signaling (`apps/web/src/lib/signaling.ts`):
  - `sendOffer()`, `sendAnswer()`, `sendIceCandidate()` — typed wrappers around `sendFrame()`
  - `onSignalingEvent(type, callback)` — subscribe to incoming offer/answer/ice-candidate events
- STUN config (`apps/web/src/lib/rtc-config.ts`):
  - Google public STUN servers (stun.l.google.com, stun1.l.google.com)
- All checks pass: typecheck (0 errors), lint (0 warnings)

---

### Week 2.5 Day 5 — 2026-03-08

**What was done:**

- Polish & foundation:
  - DM Sans Google Font imported, set as `--font-sans` in `@theme inline`
  - Z-index scale via CSS custom properties: `--z-dropdown: 40`, `--z-modal: 50`, `--z-tooltip: 60`, `--z-toast: 70`
  - WebKit scrollbar styling: 6px width, rounded thumb with green tint, hover state
  - `.no-transitions` utility class for suppressing animations during theme switches
- Dialog focus trap (WCAG 2.1 Level A):
  - Auto-focuses first focusable element on mount
  - Tab cycles through focusable elements within dialog panel
  - Shift+Tab reverses the cycle
  - `FOCUSABLE_SELECTOR` constant for reusable query
  - `panelRef` with oxlint suppression for SolidJS ref pattern
- Z-index migration: Dialog overlay, wrapper, and panel use `z-[--z-modal]` instead of `z-50`; Tooltip uses `z-[--z-tooltip]`
- Tooltip fixes: position fallback (`?? positionClasses.top`), removed `pointer-events-none`
- Auth pages adopt UI primitives:
  - Login: 2 raw `<input>` → `<Input>`, raw `<button>` → `<Button size="lg">`, `role="alert"` on error
  - Register: 3 raw `<input>` → `<Input>`, raw `<button>` → `<Button size="lg">`, `role="alert"` on error
- All 3 modals migrated from `<Modal>` to `<Dialog>`:
  - CreateServerModal: Dialog + DialogContent + DialogHeader + DialogTitle + DialogFooter + Input + Button
  - JoinServerModal: same pattern, 1 input + 4 buttons replaced
  - InviteModal: same pattern + **Fix #4**: `Record<string, unknown>` → `{ maxUses?: number; expiresAt?: string }`
  - Old `Modal.tsx` deleted (all modals now use Dialog)
- MessageInput: documenting comment for branded type limitation on `Record<string, number>`
- VirtualMessageList: `min-h-0` on scroll container (flex child overflow fix), `min-h-[100px]` on loading state
- Schema docs: `magnet_uri`/`info_hash` marked NOT NULL, `content` marked nullable, Better Auth tables note corrected
- All checks pass: typecheck (0 errors), lint (0 warnings)

---

### Week 2.5 Day 4 — 2026-03-08

**What was done:**

- Green-tinted color system (Railway-inspired approach):
  - Rewrote `apps/web/src/index.css` with OKLCH semantic tokens at hue ~155°
  - All surfaces carry brand green at low chroma for visual cohesion
  - Token system: background, foreground, card, primary, secondary, muted, accent, destructive, success, warning, info, sidebar
  - Radius scale: 0.625rem base with sm/md/lg/xl/2xl derived sizes
  - Base layer sets `border-border` and `bg-background text-foreground` globally
- Migrated all 12 component files from old tokens (bg-bg-primary, text-text-primary, bg-brand, etc.) to new semantic tokens (bg-background, text-foreground, bg-primary, etc.)
- Fixed all 8 review issues:
  - Branded types in modal response interfaces (CreateServerModal: ServerId/UserId/ChannelId, JoinServerModal: ServerId/UserId/InviteCode)
  - Created `InternalError` class (500, "INTERNAL_ERROR") in `packages/shared/src/errors/internal.ts`
  - Replaced inline 500 returns with `throw new InternalError()` in server.ts and message.ts
  - Added `options?: { cause?: unknown }` to all error subclass constructors
  - Message-store functions now use branded params (ChannelId, MessageId, UserId) with string keys for store paths
  - Added Zod validation schemas for all 4 WS event handlers (MESSAGE_CREATE, MESSAGE_UPDATE, MESSAGE_DELETE, TYPING_START) — parse + warn + early return on failure, brand at parse boundary
  - Dev runner stream readers: collected IIFE promises with `.catch(console.error)`, included in final `Promise.all()`
- UI primitives created in `apps/web/src/components/ui/`:
  - `cn()` utility (clsx + tailwind-merge) in `lib/cn.ts`
  - `button.tsx`: CVA with 6 variants (default, secondary, ghost, outline, destructive, link) and 5 sizes
  - `input.tsx`: styled with focus-visible ring, error state via aria-invalid
  - `badge.tsx`: CVA with 6 variants (default, success, warning, destructive, info, outline)
  - `card.tsx`: compound Card/CardHeader/CardTitle/CardDescription/CardContent/CardFooter
  - `dialog.tsx`: Dialog/DialogOverlay/DialogContent/DialogHeader/DialogFooter/DialogTitle/DialogDescription with a11y
  - `tooltip.tsx`: CSS-positioned hover tooltip with delay, 4 sides
  - All primitives have `data-slot` attributes
- Virtual scrolling:
  - `VirtualMessageList.tsx` using `@tanstack/solid-virtual` createVirtualizer
  - Dynamic row heights via measureElement, overscan 5
  - Auto-scroll to bottom on new messages (100px threshold)
  - Load more when scrolled to top
  - `ChatArea.tsx` updated to use VirtualMessageList instead of `<For>` list
- Dependencies added: zod, class-variance-authority, tailwind-merge, clsx, @tanstack/solid-virtual
- Updated docs/ui-standards.md with new OKLCH color palette and cn() utility
- All checks pass: typecheck (0 errors), lint (0 warnings)

---

### Week 2.5 Day 3 — 2026-03-08

**What was done:**

- Carryover fixes from code review:
  - Branded types threaded into frontend: `app-store.ts` signals use `ServerId | null` / `ChannelId | null`, `MessageInput` prop typed as `ChannelId`, `InviteModal` prop typed as `ServerId`, `ChatArea` and modals updated
  - WS payload validation: replaced `as Record<string, unknown>` casts with Zod schemas (`identifySchema`, `typingStartSchema`) in handlers.ts and gateway.ts
  - Reports FK: added `{ onDelete: "set null" }` to `messageId` and `fileReceiptId` references in reports table, migration 0004 written
- Typed error hierarchy created in `@uncorded/shared`:
  - `AppError` base class with `_tag`, `statusCode`, `code`, `message`
  - `UnauthorizedError` (401), `ForbiddenError` (403), `SessionExpiredError` (401)
  - `ValidationError` (400), `NotFoundError` (404), `ConflictError` (409), `RateLimitError` (429)
- Central error handler in `apps/server/src/index.ts` catches `AppError` subclasses
- All route handlers converted from inline `set.status = X; return { code, message }` to `throw new XError(...)`:
  - user.ts (4 sites), server.ts (5 sites), channel.ts (5 sites), message.ts (8 sites), invite.ts (4 sites), member.ts (5 sites)
- Permission helpers refactored:
  - `requireMember()` and `requireOwner()` now throw instead of returning null + mutating `set`
  - `set` parameter removed from both
  - New `isMember()` non-throwing helper for inverse checks (invite accept)
- Dev runner script `scripts/dev.ts`:
  - Spawns server and web dev processes in parallel
  - Prefixes output with colored labels: `[server]` (cyan), `[web]` (magenta)
  - Ctrl+C kills all child processes gracefully
- Root package.json updated: `dev` → `bun run scripts/dev.ts`, added `dev:server` and `dev:web`
- All checks pass: typecheck (0 errors), lint (0 warnings), fmt clean

---

### Week 2.5 Day 2 — 2026-03-08

**What was done:**

- Review fixes applied:
  - `MessageInput.tsx`: moved `lastTypingSent` to module level (explicit shared state if mounted multiple times)
  - `MessageBubble.tsx`: extracted `ONE_MINUTE_MS`, `ONE_HOUR_MS`, `ONE_DAY_MS` constants
  - `message-store.ts`: removed unused `sendFrame` re-export, added comments linking TYPING_THROTTLE_MS (5s) and TYPING_TIMEOUT_MS (6s)
- TypeScript strictness tightened in `tsconfig.base.json`:
  - Added `exactOptionalPropertyTypes: true` — prevents assigning `undefined` to optional properties
  - Added `noImplicitOverride: true`
  - Changed `target` from `ESNext` to `ES2023`
  - Fixed `InviteModal.tsx` — build options object conditionally instead of passing `undefined` values
- Branded ID types added to `@uncorded/protocol`:
  - New file `packages/protocol/src/branded.ts` with 10 branded types: UserId, ServerId, ChannelId, MessageId, InviteCode, FileReceiptId, DmChannelId, SubscriptionId, ReportId, RoleId
  - Each type has a cast constructor function (e.g., `userId(raw)`) for branding at boundaries
  - Exported from `packages/protocol/src/index.ts`
- Server routes branded at response boundaries:
  - `user.ts`: `id: userId(dbUser.id)` in GET/PATCH responses
  - `server.ts`: `serverId()`, `userId()` on all server responses
  - `channel.ts`: `channelId()`, `serverId()` on all channel responses
  - `message.ts`: `messageId()`, `channelId()`, `userId()` on messages + broadcasts
  - `invite.ts`: `inviteCode()`, `serverId()`, `userId()` on invite responses
  - `member.ts`: `userId()` on member list
  - `handlers.ts` (WS READY): all IDs in user, servers, and channels branded
- Frontend types updated:
  - `gateway-store.ts`: `ReadyUser.id` → `UserId`, `ReadyServer.id` → `ServerId`, etc.
  - `message-store.ts`: `Message.id` → `MessageId`, `Message.channelId` → `ChannelId`, etc.
  - `CreateServerModal.tsx`, `JoinServerModal.tsx`: brand raw API response IDs at parse boundary
- All checks pass: typecheck (0 errors), lint (0 warnings/errors)

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
