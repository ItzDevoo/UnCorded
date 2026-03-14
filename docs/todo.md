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
- **Deep Review** — All 5 tiers resolved (security, protocol consolidation, pagination, Redis, tests)

## Current: Week 4 — Subscriptions + Server File Sharing

### Done

- [x] Stripe checkout flow for tier upgrades
- [x] Stripe webhook handler (subscription created/updated/cancelled/payment_failed)
- [x] Subscription status sync to DB (users.subscription_tier)
- [x] Stripe Customer Portal for self-serve management

### Remaining (see GitHub Issues)

- [ ] Stripe Tax + transparency receipt UI (#18)
- [ ] Server file sharing gate + TURN relay (#19)
- [x] Presence system (#20)
- [x] User settings (#21)
- [x] Server settings (#22) — merged PR #50
- [ ] Report button (#23)
- [ ] Mobile responsive polish (#30)
- [ ] Keyboard shortcuts (#24)
- [ ] CSAM hashing (#25)
- [ ] Legal pages (#26)

## From Deep Review — 2026-03-14

### Tier 1 — Fix Before Next Feature

- [ ] SEC-1: Add decode size limits to MessagePack codec (`packages/protocol/src/codec.ts`)
- [ ] SEC-2: Add per-user rate limiting on message creation (`apps/server/src/routes/message.ts`)
- [ ] SEC-3: Add per-user rate limiting on friend requests (`apps/server/src/routes/friend.ts`)
- [ ] SEC-4: Add `.max(128)` to password fields in schemas (`packages/shared/src/schemas/user.ts`)
- [ ] SEC-5: Require non-empty message content or explicit file-only handling (`packages/shared/src/schemas/message.ts`)
- [ ] AC-4: Swap server deletion order — DB delete first, then broadcast (`apps/server/src/routes/server.ts`)
- [ ] AC-5: Wrap webhook handlers in `db.transaction()` (`apps/server/src/routes/webhook.ts`)

### Tier 2 — Fix This Week

- [ ] AC-2: Add frontend WS handlers for CHANNEL_CREATE/UPDATE/DELETE (ops 40-42)
- [ ] LB-3: Destroy download torrents after file save (`apps/web/src/lib/torrent-client.ts`)
- [ ] SEC-6: Verify target user exists before friend block (`apps/server/src/routes/friend.ts`)
- [ ] SEC-7: Add self-interaction checks on friend endpoints (`apps/server/src/routes/friend.ts`)
- [ ] SEC-10: Add resource creation limits (servers/channels/invites per user/server)
- [ ] SEC-11: Wrap channel position assignment in transaction (`apps/server/src/routes/channel.ts`)
- [ ] LB-1: Populate DM cache on DB fallback miss (`apps/server/src/ws/connections.ts`)
- [ ] LB-2: Update member store on PRESENCE_UPDATE events (`apps/web/src/stores/member-store.ts`)
- [ ] CQ-6: Add `.trim()` + whitespace-only rejection to name/username schemas
- [ ] CQ-3: Replace remaining `or()` chains with `inArray()` in friend.ts

## Next: Week 5 — Desktop App + Deployment

- [ ] Electron desktop app (#27)
- [ ] Production deployment (#28)
- [ ] Launch checklist (#29)

## Post-Launch

- [ ] Voice/video, reactions, search, discovery (#31)

---

_All detailed tracking now lives in GitHub Issues. This file is a quick reference only._
