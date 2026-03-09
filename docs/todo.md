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
- [ ] Virtual scrolling message list
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

- [ ] Drag-and-drop + clipboard paste file selection
- [ ] File sharing in DMs (P2P, both users online)
- [ ] Download progress bar
- [ ] Seeder count indicator ("X seeders" / "No seeders online")
- [ ] Rich previews for images (generate thumbnail before torrenting)
- [ ] Clear error messaging when P2P fails for free users (NAT blocked, no TURN)

### Day 7: DMs + Friends

- [ ] Friend system (request, accept, decline, block)
- [ ] DM channels (always P2P for files)
- [ ] DM list in sidebar
- [ ] /channels/me friend list page

**Milestone: Users can share files in DMs via P2P. Magnet links persist in chat.**

---

## Week 4: Subscriptions + Server File Sharing

### Day 1-2: Stripe Subscriptions

- [ ] Stripe account setup + Stripe Tax enabled
- [ ] Supporter tier — $5/mo
- [ ] Server Owner tier — $10/mo base (traffic scaling TBD after cost data)
- [ ] Transparency receipt UI (subscription cost, our cost, our margin)
- [ ] Stripe checkout flow for tier upgrades
- [ ] Stripe webhook handler (subscription created/updated/cancelled)
- [ ] Subscription status sync to DB (users.subscription_tier)
- [ ] Stripe Customer Portal for self-serve management

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

_Update this file at the end of every coding session._
