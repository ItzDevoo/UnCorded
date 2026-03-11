# UnCorded — Task Tracker

Reference: C:\Nexis (monorepo patterns, auth, WS gateway), C:\t3Code (tooling, UI, Electron patterns)

## Week 1: Foundation + Auth + App Shell (COMPLETE)

### Day 1-2: Project Setup

- [x] bun init monorepo with workspaces (ref: C:\Nexis structure)
- [x] Turborepo config
- [x] TypeScript configs
- [x] ESLint + Prettier
- [x] .gitignore + .env.example
- [x] Git init + initial commit (f288d50)
- [x] Neon + Upstash accounts, env vars set in .env
- [x] packages/shared scaffolded (Zod schemas, types, createId)
- [x] packages/protocol scaffolded (opcodes enum, MessagePack helpers)

### Day 3-4: Backend Core

- [x] ElysiaJS server scaffold (ref: C:\Nexis\apps\server)
- [x] Drizzle schema + first migration (17 tables in Neon)
- [x] Better Auth (email/password + Discord OAuth + Google OAuth)
- [x] Auth middleware (resolve-based guard with getSession helper)
- [x] GET /api/users/@me, PATCH /api/users/@me
- [x] CORS, rate limiting, error handling

### Day 5-7: Frontend Shell

- [x] SolidJS + Vite + Tailwind v4 scaffold
- [x] Routing setup (/, /login, /register, /app)
- [x] Auth store (better-auth/solid client with credentials: include)
- [x] API client (typed fetch wrapper)
- [x] Login + Register pages
- [x] App shell layout (server sidebar, channel sidebar, main area)
- [x] Dark theme default via CSS variables (@theme block)

**Milestone: User can register, login, and see the app shell.**

---

## Week 2: Servers, Channels, Real-time Chat (COMPLETE)

### Day 1-2: Server & Channel API

- [x] Server CRUD routes (POST/GET/PATCH/DELETE /api/servers)
- [x] Channel CRUD routes (/api/servers/:id/channels + /api/channels/:id)
- [x] Member routes (GET/DELETE /api/servers/:id/members)
- [x] Invite routes (create, public preview, accept)
- [x] Permission helpers (requireMember, requireOwner)
- [x] Fixed auth resolve pattern (JSON error body instead of empty 401)

### Day 2-3: WebSocket Gateway

- [x] WebSocket endpoint /gateway
- [x] HELLO -> IDENTIFY -> READY lifecycle
- [x] Heartbeat (30s client, 45s server timeout)
- [x] In-memory Map for single instance (Redis pub/sub deferred until multi-instance scaling needed)
- [x] Client-side WS manager (auto-reconnect, event emitter)

### Day 4-5: Messaging

- [x] POST/GET/PATCH/DELETE /channels/:id/messages
- [x] Cursor-based pagination
- [x] Real-time delivery (MESSAGE_CREATE, UPDATE, DELETE)
- [x] Typing indicators (debounced) — server-side TYPING_START handler
- [x] Message list UI with real-time WS updates
- [x] Chat input with auto-resize, typing indicator send/display

### Day 6-7: Server/Channel UI

- [x] Server list sidebar
- [x] Channel list with storage policy badges
- [x] Server creation modal
- [x] Invite link generation + join flow
- [ ] Member list panel
- [x] Virtual scrolling message list
- [ ] Markdown rendering
- [ ] Unread indicators

**Milestone: Users can create servers, chat in real-time.**

---

## Week 2.5: Tooling & Standards Migration

### Day 1: Schema Migration + Linter & Formatter Migration

- [x] Update Drizzle schema to match docs/schema.md (P2P pivot)
  - [x] Drop: attachments, purchases, storage_policy/purchase_item/purchase_status enums
  - [x] Add: file_receipts, subscriptions, subscription_tier/subscription_status enums
  - [x] Change: channels.storage*policy → file_sharing_enabled, users.has*\* → subscription_tier
  - [x] Update all referencing code (routes, WS handlers, shared schemas, frontend types/UI)
  - [x] Generate and apply migration (0003_schema_pivot_p2p.sql)
- [x] Remove ESLint + Prettier configs and dependencies
- [x] Install and configure Oxlint (`.oxlintrc.json` — plugins: eslint, oxc, typescript, unicorn)
- [x] Install and configure Oxfmt (`.oxfmtrc.json`)
- [x] Update root `package.json` scripts: `lint` → oxlint, `fmt` → oxfmt
- [x] Run oxfmt on entire codebase, fix any formatting drift
- [x] Run oxlint on entire codebase, fix all warnings/errors
- [x] Verify: `bun run typecheck`, `bun run lint`, and `bun run fmt` pass cleanly

### Day 2: Review Fixes + TypeScript Strictness + Branded Types

- [x] Review fixes: MessageInput throttle to module level, MessageBubble constants, unused sendFrame re-export, typing throttle/timeout comments
- [x] Add strict TS flags to `tsconfig.base.json` (exactOptionalPropertyTypes, noImplicitOverride, target ES2023)
- [x] Fix all new type errors from stricter checks (InviteModal exactOptionalPropertyTypes)
- [x] Add branded ID types to `@uncorded/protocol` (UserId, ServerId, ChannelId, MessageId, InviteCode, etc.)
- [x] Update route handlers, WS payloads, and stores to use branded types at response boundaries
- [x] Verify: `bun run typecheck` passes with zero errors, `bun run lint` passes with zero warnings

### Day 3: Typed Errors + Dev Runner + Carryover Fixes

- [x] Thread branded types into frontend (app-store, MessageInput, InviteModal, ChatArea, CreateServerModal, JoinServerModal)
- [x] Zod validation for WS payloads (IDENTIFY + TYPING_START)
- [x] Reports FK onDelete set null (migration 0004)
- [x] Create typed error hierarchy in `@uncorded/shared` (AppError base, UnauthorizedError, ForbiddenError, SessionExpiredError, ValidationError, NotFoundError, ConflictError, RateLimitError)
- [x] Central `.onError()` handler catches AppError subclasses
- [x] Replace inline `set.status` + return error patterns with `throw` in all route handlers
- [x] Convert permission helpers (requireMember, requireOwner) to throw; add isMember() non-throwing helper
- [x] Create `scripts/dev.ts` dev runner (colored prefixed output for server + web)
- [x] Update root `package.json` scripts (dev, dev:server, dev:web)
- [x] Verify: typecheck (0 errors), lint (0 warnings), fmt clean

### Day 4: Color System + UI Foundation + Virtual Scrolling + Review Fixes

- [x] Green-tinted color system (Railway-inspired, OKLCH, hue ~150°)
  - [x] Rewrite `index.css` with full semantic token system (--background, --foreground, --primary, etc.)
  - [x] @theme inline block mapping CSS vars → Tailwind utilities
  - [x] Radius scale (0.625rem base with sm/md/lg/xl/2xl)
  - [x] Base layer: `border-border` on all elements, `bg-background text-foreground` on body
- [x] Migrate all component token references (12 files)
  - [x] bg-bg-primary → bg-background, bg-bg-secondary → bg-card, bg-bg-tertiary → bg-secondary
  - [x] bg-bg-server-bar → bg-sidebar, bg-bg-input → bg-input, bg-bg-hover → bg-accent
  - [x] text-text-primary → text-foreground, text-text-secondary → text-secondary-foreground
  - [x] text-text-muted → text-muted-foreground, bg-brand → bg-primary, text-brand → text-primary
  - [x] bg-danger → bg-destructive, text-danger → text-destructive
- [x] Update docs/ui-standards.md with new color palette
- [x] Fix all 8 review issues:
  - [x] #1-2: Branded types in CreateServerModal + JoinServerModal response interfaces
  - [x] #3-4: InternalError class + throw in server.ts and message.ts
  - [x] #5: message-store branded params (ChannelId, MessageId, UserId)
  - [x] #6: Client-side Zod validation for all WS event handlers
  - [x] #7: Dev runner stream readers collected and error-handled
  - [x] #8: cause parameter on all error subclass constructors
- [x] UI primitives (button, input, badge, card, dialog, tooltip)
  - [x] cn() utility (clsx + tailwind-merge)
  - [x] CVA variants, data-slot attributes, focus-visible rings
- [x] Virtual scrolling (@tanstack/solid-virtual)
  - [x] VirtualMessageList with dynamic heights, auto-scroll, load-more
  - [x] ChatArea updated to use VirtualMessageList
- [x] Verify: typecheck (0 errors), lint (0 warnings)

### Day 5: Component Adoption + Polish + Review Fixes

- [x] DM Sans font import + `--font-sans` in @theme inline
- [x] Z-index scale via CSS custom properties (--z-dropdown, --z-modal, --z-tooltip, --z-toast)
- [x] WebKit scrollbar styling (6px thumb, rounded, green-tinted)
- [x] `.no-transitions` utility class for theme switching
- [x] Dialog focus trap (WCAG 2.1 Level A): Tab/Shift+Tab cycling, auto-focus first element on mount
- [x] Dialog z-index migrated from `z-50` to `z-[--z-modal]`
- [x] Tooltip: position fallback (`?? positionClasses.top`), removed `pointer-events-none`, `z-[--z-tooltip]`
- [x] Login page: raw inputs → `<Input>`, raw button → `<Button>`, `role="alert"` on error
- [x] Register page: raw inputs → `<Input>`, raw button → `<Button>`, `role="alert"` on error
- [x] CreateServerModal: `<Modal>` → `<Dialog>` + `<Input>` + `<Button>` + `<DialogFooter>`
- [x] JoinServerModal: `<Modal>` → `<Dialog>` + `<Input>` + `<Button>` + `<DialogFooter>`
- [x] InviteModal: `<Modal>` → `<Dialog>` + `<Input>` + `<Button>`, typed body (`Record<string, unknown>` → `{ maxUses?: number; expiresAt?: string }`)
- [x] Deleted Modal.tsx (all modals now use Dialog)
- [x] MessageInput: documenting comment for branded key limitation
- [x] VirtualMessageList: `min-h-0` on scroll container, `min-h-[100px]` on loading state
- [x] Schema docs: file_receipts NOT NULL, messages.content nullable, Better Auth tables note
- [x] Verify: typecheck (0 errors), lint (0 warnings)

**Milestone: Codebase modernized — Oxlint/Oxfmt, strict TS, branded types, typed errors, dev runner TUI, UI primitives adopted across all components, focus trap, virtual scrolling, green-tinted design system with DM Sans.**

---

## Week 3: P2P File Sharing (Web)

### Day 1-2: WebRTC Signaling Layer

- [x] Add WebRTC opcodes to @uncorded/protocol (WEBRTC_OFFER, WEBRTC_ANSWER, WEBRTC_ICE_CANDIDATE, FILE_SHARE, FILE_AVAILABILITY_UPDATE)
- [x] WS gateway handlers: forward signaling frames between peers via connection registry
- [x] Client-side signaling: send/receive offers, answers, ICE candidates through existing gateway
- [x] STUN configuration (Google public STUN servers)

### Day 3-4: WebTorrent Integration (Browser)

- [x] WebTorrent client initialization in browser
- [x] File -> torrent creation (generate magnet URI + info hash)
- [x] Seed from browser tab (in-memory, while tab open)
- [x] Download from magnet URI via WebRTC DataChannel
- [x] file_receipts table + Drizzle migration
- [x] FILE_SHARE message type: magnet URI stored as message, receipt saved to DB

### Day 5-6: DM File Sharing UI

- [x] Drag-and-drop + clipboard paste file selection
- [x] File sharing in DMs (P2P, both users online) — DM routes now exist
- [x] Download progress bar
- [x] Seeder count indicator ("X seeders" / "No seeders online")
- [x] Rich previews for images (generate thumbnail after download)
- [x] Clear error messaging when P2P fails for free users (NAT blocked, no TURN)
- [x] Code review fixes (9 fixes: tier gate, Zod bounds, raw cast, shape validation, etc.)

### Day 7: DMs + Friends + Review Fixes (13 items)

- [x] Code review fixes (13 items from Day 5-6 review):
  - [x] Fix #1 (High): Bounded WebRTC data field (SDP ≤16KB, ICE as record)
  - [x] Fix #2 (High): Zod readyDataSchema for READY payload validation on client
  - [x] Fix #3 (High): Validate HELLO heartbeatInterval (Number.isFinite + positive)
  - [x] Fix #4 (High): File size upper bound (100MB) on server fileShareSchema
  - [x] Fix #5 (Medium): .min(1) on fileAvailabilitySchema IDs
  - [x] Fix #6 (Medium): .min(1) on typingStartSchema channelId
  - [x] Fix #7 (Medium): Download timeout (5 min) on downloadFromMagnet
  - [x] Fix #8 (Medium): "cancelled" status in TransferProgress + UI badge
  - [x] Fix #9 (Medium): Race fix in seedFile — client error handler before seed callback
  - [x] Fix #10 (Medium): Console.warn/error gated behind import.meta.env.DEV
  - [x] Fix #11 (Low): FREE_TIER constant replaces magic "free" string
  - [x] Fix #12 (Low): No action — already has explanatory comment
  - [x] Fix #13 (Low): TODO comment on broadcastToServer cache optimization
- [x] Friend system (request, accept, decline, block, remove)
- [x] DM channels (create/get, always P2P for files)
- [x] DM message support (resolveChannel + broadcastToDm in message routes)
- [x] READY payload includes dmChannels + friends arrays
- [x] DM list in sidebar (ChannelSidebar toggles between channels/DMs)
- [x] Friends page (/app/friends) with All/Pending/Blocked tabs
- [x] Friend store (WS listeners for FRIEND_REQUEST/ACCEPT/REMOVE)
- [x] Schema docs: member_roles cascade info

### Post-Review Fixes (9 items from Day 7 review)

- [x] Fix #1: subscriptionTier missing from READY user payload + ReadyUser interface + schema
- [x] Fix #2: Visible error message for oversized files in FileDropZone (was silent console.warn)
- [x] Fix #3: .min(1) on webRtcSignalSchema targetUserId + channelId
- [x] Fix #4: .min(1) on signalingEventSchema fromUserId + channelId
- [x] Fix #5: Bounded z.record() in WebRTC data with JSON.stringify size refine (16KB cap)
- [x] Fix #6: Branded type constructors at signaling parse boundary (no more `as SignalingEvent`)
- [x] Fix #7: MAX_FILE_SIZE_BYTES shared constant (removed duplicates from FileDropZone + gateway)
- [x] Fix #8: console.warn in FileDropZone gated behind import.meta.env.DEV
- [x] Fix #9: Safe ArrayBuffer type narrowing in server gateway (no more `raw as ArrayBuffer`)

### Pre-Week 4 Review Fixes (12 items)

- [x] Fix #1 (High): console.warn in message-store.ts gated behind import.meta.env.DEV
- [x] Fix #2 (High): Friends.tsx async onClick handlers wrapped with try/catch + visible error signal
- [x] Fix #3 (High): Zod .min(1) param validation on all friend route params (:userId)
- [x] Fix #4 (High): dm.ts — no route params exist, body already validated via createDmSchema (no-op)
- [x] Fix #5 (Medium): handlers.ts `as string` casts on branded types replaced with proper branded local types
- [x] Fix #6 (Medium): Friends.tsx `as string` casts on friend.userId removed (UserId assignable to string)
- [x] Fix #7 (Medium): message-store fetchMessages catch block now exposes fetchError on ChannelMessages
- [x] Fix #8 (Low): Magic numbers in gateway.ts Zod limits extracted to named constants
- [x] Fix #9 (Low): servers.ownerId FK annotated with onDelete: "restrict" (explicit intent, matches default NO ACTION behavior)
- [x] Fix #10 (Low): progress.md already up to date with Week 2.5 + Week 3 entries
- [x] Fix #11 (Low): FileMessage.tsx thumbnail img — added tabIndex, role="button", onKeyDown for keyboard accessibility
- [x] Fix #12 (Low): FileMessage.tsx transfer()!.downloadSpeed replaced with transfer()?.downloadSpeed ?? 0

**Milestone: Users can share files in DMs via P2P. Magnet links persist in chat.**

---

## Week 3.5: UI Overhaul (t3Code-inspired)

Goal: Replace Discord-clone UI with a distinctive, polished design inspired by t3Code's UX. Modern, minimal, refined — not another shadcn template.

### Phase 1: Design Foundation (Day 1)

- [x] Rework CSS tokens in index.css:
  - [x] Refine color palette (alpha-based borders, layered backgrounds)
  - [x] Add body noise texture (SVG fractal noise at low opacity)
  - [x] Inset shadows on buttons/inputs for depth (t3Code pattern)
  - [x] Transition utilities (duration-200 default, scale/opacity for modals)
- [x] Upgrade existing UI primitives:
  - [x] Button: inset shadow, better hover/active transitions
  - [x] Input: shadow-xs, refined focus ring
  - [x] Card: shadow depth, rounded-2xl for larger surfaces
  - [x] Dialog: scale-98→100 + opacity entrance, backdrop-blur
  - [x] Toast: slide-in animation
- [x] New UI primitives:
  - [x] ScrollArea — custom scrollbar with opacity transitions
  - [x] Skeleton — shimmer loading animation
  - [x] Empty — centered empty state layout

### Phase 2: Layout Redesign (Day 2)

- [x] Replace 3-panel Discord layout with single collapsible sidebar + main content
- [x] Server switcher: dropdown/select at sidebar top (not icon strip)
- [x] Channels + DMs unified in sidebar with collapsible section groups
- [x] Sidebar collapse to icon rail on desktop
- [x] Mobile: sidebar as sheet/drawer (offcanvas)
- [x] Main content inset with proper spacing
- [x] User panel redesign at sidebar bottom

### Phase 3: Chat & Messages (Day 3)

- [x] Message hover toolbar (edit, delete, copy actions)
- [x] Edit message UI (inline edit mode, save/cancel)
- [x] Delete message UI (confirmation, optimistic removal)
- [x] Refined message layout (better spacing, timestamps, avatar circles)
- [x] Typing indicator animation upgrade (smoother dots)
- [ ] Markdown rendering in messages (descoped — Week 2 leftover)
- [x] ScrollArea integration in message list

### Phase 4: Pages, Modals, Polish (Day 4 — DONE)

- [x] Auth pages redesign (login/register — brand wordmark, gradient bg, animation, label update)
- [x] Friends page refresh (Input/Empty components, header spacing)
- [x] Modal responsive sizing (mobile margins, max-height, overflow scroll)
- [x] Skeleton loading states for message list (6 skeleton messages)
- [x] Empty state components (no messages, no channel, no friends, gateway states)
- [x] Accessibility polish (aria-label on logout button)

**Milestone: UnCorded has its own visual identity. Polished, modern, distinctive.**

---

## Pre-Week 4: Code Review Fixes + Route Restructure

### Part A — Code Review Fixes

- [x] A1: Gate startup log behind DEV (apps/server/src/index.ts)
- [x] A2: Remove redundant `as` casts in friend-store.ts
- [x] A3: Type peerIds as UserId[] in friend.ts GET / route
- [x] A4: Verify gateway.ts comment (accurate, no change)
- [x] A5: Expand ensureDmChannel JSDoc in friend.ts

### Part B — Route Restructure (changes.md #1, #2, #3)

- [x] B1: App.tsx — add Landing, remove RootRedirect, `/` → Landing, `/home` → AppLayout
- [x] B2: Login.tsx — `/app` → `/home`
- [x] B3: Register.tsx — `/app` → `/home`
- [x] B4: AppSidebar.tsx — `/app/friends` → `/home/friends`
- [x] B5: app-store.ts — remove auto-select-first-server effect + hasAutoSelected flag
- [x] B6: Landing.tsx — public landing page (hero, features, pricing, CTA)
- [x] B7: apps/web/CLAUDE.md — routes section updated (already done)

### Verification

- [x] `bun run typecheck` — 0 errors
- [x] `bun run lint` — 0 warnings

---

## Pre-Week 4: Infrastructure — In-Memory Membership Registry

- [x] In-memory dual-map registry (serverId→users, userId→servers) in server-members.ts
- [x] broadcastToServer() rewritten from async DB query to sync cache lookup
- [x] Registry seeded on IDENTIFY, updated on join/create/leave/kick/disconnect/delete
- [x] SERVER_CREATE event to joining user on invite accept
- [x] MEMBER_ADD/REMOVE broadcast on join/leave/kick
- [x] SERVER_DELETE on leave/kick/server deletion
- [x] Client listeners (server-store.ts) with Zod validation, dedup, HMR cleanup
- [x] websocket-protocol.md updated with 4 new event payload docs

---

## Week 4: Subscriptions + Server File Sharing

### Day 1-2: Stripe Subscriptions

- [ ] Stripe account setup + Stripe Tax enabled
- [ ] Supporter tier — $5/mo
- [ ] Server Owner tier — $10/mo base (traffic scaling TBD after cost data)
- [ ] Transparency receipt UI (subscription cost, our cost, our margin)
- [x] Stripe checkout flow for tier upgrades
- [x] Stripe webhook handler (subscription created/updated/cancelled)
- [x] Subscription status sync to DB (users.subscription_tier)
- [x] Stripe Customer Portal for self-serve management

### Day 3-4: Server File Sharing (Supporter+)

- [ ] Gate file sharing in server channels behind Supporter+ tier
- [ ] Channel file_sharing_enabled toggle (server owner setting)
- [ ] TURN relay setup (self-hosted, paid users only)
- [ ] TURN credential generation for Supporter+ users
- [ ] File sharing UI in server channels (same as DM but tier-gated)

### Day 5-6: Presence + Polish

- [ ] Presence (online/idle/dnd/offline via Redis)
- [ ] Status dots on avatars
- [ ] User settings (profile, account, appearance)
- [ ] Server settings (channels, moderation)
- [ ] Report button on every message and file
- [ ] Mobile-responsive layout
- [ ] Keyboard shortcuts (Ctrl+K, Escape)

### Day 7: Safety + Legal

- [ ] Client-side CSAM hashing integration (PDQ/PhotoDNA)
- [ ] Register NCMEC CyberTipline (non-dev, free)
- [ ] Register DMCA agent with Copyright Office (non-dev, $6)
- [ ] Terms of Service page
- [ ] Privacy Policy page
- [ ] DMCA policy page

**Milestone: Paid users can share files in servers. Subscriptions working. Safety in place.**

---

## Week 5: Desktop App + Deployment

### Day 1-3: Electron Desktop App

- [ ] Electron project setup in apps/desktop (follows t3Code patterns)
- [ ] Main process: spawn ElysiaJS server as child process
- [ ] Preload script with contextBridge (typed desktopBridge API)
- [ ] Context isolation enabled, node integration disabled, sandbox enabled
- [ ] Persistent seed folder configuration (native file dialog via IPC)
- [ ] Background seeding (app stays connected when minimized)
- [ ] Auto-update mechanism (electron-updater with state machine)
- [ ] Code signing (Windows + macOS)
- [ ] Client-side CSAM scanning before file share (PhotoDNA/PDQ)
- [ ] tsdown bundler config (main.ts + preload.ts → dist-electron/)

### Day 4-5: Deployment

- [ ] Railway backend deploy
- [ ] Cloudflare Pages frontend deploy
- [ ] TURN server deploy
- [ ] Env vars + secrets configured
- [ ] Lazy-load routes, CSP headers
- [ ] Waitlist landing page
- [ ] Desktop app distribution (GitHub Releases or similar)

### Day 6-7: Launch

- [ ] Cross-browser testing (Chrome, Firefox, Safari, Edge)
- [ ] Desktop testing (Windows, macOS)
- [ ] Sentry error tracking
- [ ] Plausible analytics
- [ ] Server owner traffic dashboard (cost transparency)

**Milestone: App live — web + desktop. Subscriptions, P2P file sharing, persistent seeding all working.**

---

## Post-Launch

- [ ] Voice / video calls (WebRTC infrastructure already in place)
- [ ] Screen sharing + annotation
- [ ] Emoji reactions
- [ ] @mention autocomplete
- [ ] Message search (pg full-text)
- [ ] Public server discovery
- [ ] Server owner traffic-based pricing formula (based on real cost data)

---

## From Deep Review — 2026-03-11

### Tier 1 — Fix Before Next Feature

- [x] WS gateway rate limiting — per-user per-opcode token bucket in `apps/server/src/ws/gateway.ts`
- [x] Wrap server creation in `db.transaction()` — `apps/server/src/routes/server.ts` lines 36-63
- [x] Wrap DM channel creation in `db.transaction()` — `apps/server/src/routes/dm.ts` + `apps/server/src/routes/friend.ts` ensureDmChannel
- [x] Add missing DB indexes — `subscriptions.user_id`, `subscriptions.stripe_subscription_id`, `dm_members.user_id`, `file_receipts.channel_id`, `invites.server_id`
- [x] Cache `resolveChannelMembership` in-memory — `apps/server/src/helpers/resolve-channel.ts` (2 DB queries per WS message)
- [x] Cache DM membership in-memory (like server-members.ts) — `apps/server/src/ws/connections.ts` broadcastToDm
- [x] Cache username in WsContext on IDENTIFY — `apps/server/src/ws/gateway.ts` TYPING_START handler

### Tier 2 — Fix This Week

- [ ] Switch message list to `leftJoin` for deleted authors — `apps/server/src/routes/message.ts` lines 161-179
- [ ] Switch `fetchMessageWithAuthor` to `leftJoin` — `apps/server/src/routes/message.ts` lines 37-64
- [ ] Add logging to webhook handler early returns — `apps/server/src/routes/webhook.ts`
- [ ] Friend request: return consistent response for nonexistent users — `apps/server/src/routes/friend.ts` lines 111-118
- [ ] DM endpoint: `or()` chain → `inArray()` — `apps/server/src/routes/dm.ts` lines 154-165
- [ ] Broadcast tier change to WS connections on webhook update — `apps/server/src/routes/webhook.ts`

---

_Update this file at the end of every coding session._
