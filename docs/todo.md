# UnCorded — Task Tracker

All issues and feature requests tracked on GitHub Issues: https://github.com/ItzDevoo/UnCorded/issues

Reference: C:\Nexis (monorepo patterns, auth, WS gateway), C:\t3Code (tooling, UI, Electron patterns)

## Completed Milestones

- **Week 1** — Foundation + Auth + App Shell
- **Week 2** — Servers, Channels, Real-time Chat
- **Week 2.5** — Tooling migration (Oxlint/Oxfmt), strict TS, branded types, typed errors, dev runner, UI primitives, design system
- **Week 3** — P2P File Sharing (WebTorrent, DMs, friends, file receipts)
- **Week 3.5** — UI Overhaul (layout redesign, chat polish, auth pages, empty states)
- **Pre-Week 4** — Code review fixes, route restructure, in-memory membership registry
- **Deep Review 1** — All 5 tiers resolved (security, protocol consolidation, pagination, Redis, tests)
- **Deep Review 2** — Security hardening, validation, scalability, fresh-eyes audit

## From Deep Review 2 — Verified 2026-03-15

### Resolved (code-verified)

- [x] SEC-1: MessagePack decode size limits (`packages/protocol/src/codec.ts`)
- [x] SEC-2: Per-user rate limiting on message creation (`apps/server/src/routes/message.ts`)
- [x] SEC-3: Per-user rate limiting on friend requests (`apps/server/src/routes/friend.ts`)
- [x] SEC-4: `.max(128)` on password fields (`packages/shared/src/schemas/user.ts`)
- [x] SEC-5: Non-empty message content enforced at route level (`apps/server/src/routes/message.ts`)
- [x] AC-4: Server deletion order — DB first, then broadcast (`apps/server/src/routes/server.ts`)
- [x] AC-5: Webhook handlers wrapped in `db.transaction()` (`apps/server/src/routes/webhook.ts`)
- [x] AC-2: Frontend WS handlers for CHANNEL_CREATE/UPDATE/DELETE (`apps/web/src/stores/server-store.ts`)
- [x] LB-3: Download torrents destroyed after save/error/timeout (`apps/web/src/lib/torrent-client.ts`)
- [x] SEC-6: Target user existence check on block (`apps/server/src/routes/friend.ts`)
- [x] SEC-7: Self-interaction checks on friend/block/remove (`apps/server/src/routes/friend.ts`)
- [x] SEC-10: Resource creation limits enforced (100 servers, 500 channels, 50 invites)
- [x] CQ-6: `.trim().min(1)` on all name/username schemas — whitespace-only rejected
- [x] CQ-3: `.or()` chains in friend.ts are correct for bidirectional checks — not applicable for `inArray()`

### Still Open (0 items)

- [x] SEC-11: Wrap channel PATCH endpoint in `db.transaction()` (`apps/server/src/routes/channel.ts`)
- [x] LB-1: Backfill DM cache after DB fallback miss (`apps/server/src/ws/connections.ts`)
- [x] LB-2: Sync PRESENCE_UPDATE events into member-store (`apps/web/src/stores/member-store.ts`)

## Current: Week 4 — Subscriptions + Polish

### Done

- [x] Stripe checkout flow for tier upgrades
- [x] Stripe webhook handler (subscription created/updated/cancelled/payment_failed)
- [x] Subscription status sync to DB (users.subscription_tier)
- [x] Stripe Customer Portal for self-serve management
- [x] Server file sharing gate + TURN relay (#19)
- [x] Presence system (#20)
- [x] User settings (#21)
- [x] Server settings (#22)

### Remaining Features

- [x] Report system (#23) — POST /api/reports + ReportDialog in message toolbar
- [ ] Mobile responsive polish (#30) — sidebar needs Sheet component, responsive breakpoints
- [ ] Keyboard shortcuts (#24) — no system exists yet
- [ ] Stripe Tax + transparency receipt UI (#18)
- [ ] CSAM hashing (#25) — client-side PhotoDNA/PDQ before file share
- [ ] Legal pages (#26) — Terms of Service, Privacy Policy

## Next: Week 5 — Desktop App + Deployment

- [ ] Electron desktop app (#27)
- [ ] Production deployment (#28)
- [ ] Launch checklist (#29)

## Post-Launch

- [ ] Voice/video, reactions, search, discovery (#31)

---

_All detailed tracking now lives in GitHub Issues. This file is a quick reference only._
