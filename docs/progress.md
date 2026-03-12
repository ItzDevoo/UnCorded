# UnCorded — Progress

What is actually built and working right now.
Updated by the coding agent at the end of every session.

---

## Current Status: Week 4 In Progress

Stripe subscriptions working. Deep review complete (all 5 batches). 93 tests passing. All issues migrated to GitHub Issues.
Quick-wins batch: invite accept race condition fixed (db.transaction), roles/member_roles tables removed, Object.assign consistency applied.
User settings: profile editing (username/display name/avatar), password change, account deletion, appearance (dark/light theme, message density).

---

## What Works

### Infrastructure

- Bun monorepo with Turborepo (apps/web, apps/server, packages/shared, packages/protocol)
- PostgreSQL (Neon) + Drizzle ORM — 17+ tables, 6 migrations applied
- Redis (Upstash) — rate limiting with in-memory fallback, pub/sub foundation (subscriber stubbed)
- TypeScript strict mode, branded ID types, typed error hierarchy
- Oxlint + Oxfmt (zero warnings/errors)
- Vitest — 93 tests (rate limiting, webhooks, permissions, schemas)
- GitHub Actions CI (typecheck, lint, test on push/PR to main)
- Turbo pipeline: typecheck depends on ^build, lint task registered
- Dev runner TUI (colored prefixed output for server + web)

### Auth

- Better Auth (email/password + Discord OAuth + Google OAuth)
- Session-based auth with cookie credentials
- authResolve() factory (single source of truth for all routes)

### Backend API

- Server CRUD, Channel CRUD, Member management, Invites
- Message CRUD with cursor-based pagination (composite cursor with tiebreaking)
- Friend system (request, accept, decline, block, remove)
- DM channels (create/get, always P2P for files)
- Paginated list endpoints (members, friends, DMs) with hasMore flags
- Permission helpers (requireMember, requireOwner, isMember)
- CSRF content-type guard on all state-changing endpoints

### WebSocket Gateway

- HELLO → IDENTIFY → READY lifecycle with MessagePack binary frames
- Heartbeat (30s client, 45s server timeout) with HEARTBEAT_ACK (10s client timeout)
- Close handler race condition fixed (atomic last-connection check)
- Per-user per-opcode rate limiting (token bucket, Redis-backed)
- Per-IP rate limiting on unauthenticated endpoints
- In-memory connection registry (WeakMap for WS context)
- In-memory server membership dual-map (O(1) broadcast + O(1) disconnect cleanup)
- In-memory channel resolution cache (channel→server + DM membership)
- Username cached in WsContext on IDENTIFY
- Events: MESSAGE_CREATE/UPDATE/DELETE, TYPING_START, FILE_SHARE, FILE_AVAILABILITY_UPDATE, WEBRTC_OFFER/ANSWER/ICE_CANDIDATE, SERVER_CREATE/DELETE, MEMBER_ADD/REMOVE, FRIEND_REQUEST/ACCEPT/REMOVE, DM_CHANNEL_CREATE, PRESENCE_UPDATE

### Presence System

- In-memory presence manager with per-user idle timers (5min timeout)
- Status states: online, idle, dnd, offline
- DND persists across reconnects (stored in DB, restored on IDENTIFY)
- Idle detection: server-side timer resets on real activity (messages, typing, file share)
- Client-side activity tracking (mousemove/keydown/click/focus, throttled 60s)
- Presence broadcast to all server co-members + accepted friends
- StatusDot component with color-coded indicators (green/amber/red/gray)
- Status selector dropdown in sidebar footer (Online/Idle/DND)
- StatusDot integrated: DM list, chat header, member list, friends page
- Member list groups by online/offline status

### Stripe Subscriptions

- Supporter ($5/mo) and Server Owner ($10/mo) products created
- Checkout flow (creates Stripe Checkout Session, redirects to Stripe)
- Webhook handlers: checkout.session.completed, subscription.updated, subscription.deleted, invoice.payment_failed
- Subscription status sync to DB (users.subscription_tier)
- Customer Portal for self-serve management
- Force WS reconnect on tier change (CloseCode.SESSION_UPDATED)

### P2P File Sharing

- WebTorrent in browser (seed + download via WebRTC DataChannels)
- WebRTC signaling through WS gateway
- STUN configuration (Google public servers)
- File receipts stored in DB (magnet URI as message)
- Drag-and-drop + clipboard paste file selection
- Download progress bar, seeder count, rich image previews
- Free users: DM file sharing only (P2P, both online)
- Error messaging when P2P fails (NAT blocked, no TURN for free users)

### Frontend

- SolidJS + Vite + Tailwind v4
- Green-tinted OKLCH design system with DM Sans font
- UI primitives: Button, Input, Badge, Card, Dialog, Tooltip, ScrollArea, Skeleton, Empty
- Collapsible sidebar with server switcher dropdown
- Channels + DMs unified in sidebar with collapsible sections
- Mobile: sidebar as sheet/drawer
- Virtual scrolling message list (@tanstack/solid-virtual)
- Message hover toolbar (edit, delete, copy)
- Inline message editing + delete with confirmation
- Typing indicators with animation
- Skeleton loading states + empty states
- Focus trap in dialogs (WCAG 2.1)
- Landing page (hero, features, pricing, CTA)
- Friends page (All/Pending/Blocked tabs)
- Lazy-loaded channels per server (fetched on select)
- "Load more" pagination for DMs and friends

### User Settings

- Settings page at /home/settings with Profile/Account/Appearance tabs
- Profile: username + display name editing, avatar upload to Cloudflare R2 (drag-and-drop, click, client-side preview)
- Account: email display, password change via Better Auth, account deletion with password confirmation + server ownership check
- Appearance: dark/light theme toggle, cozy/compact message density — both localStorage-persisted
- R2 infrastructure: lazy S3Client singleton, avatar upload/delete, immutable cache headers
- Settings gear icon in sidebar footer

### Domain

- uncorded.app (Cloudflare)

---

_Update this file at the end of every coding session._
