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

## Next: Week 5 — Desktop App + Deployment

- [ ] Electron desktop app (#27)
- [ ] Production deployment (#28)
- [ ] Launch checklist (#29)

## Post-Launch

- [ ] Voice/video, reactions, search, discovery (#31)

---

_All detailed tracking now lives in GitHub Issues. This file is a quick reference only._
