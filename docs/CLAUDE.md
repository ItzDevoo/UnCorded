# UnCorded

Real-time chat app built on radical transparency. Files transfer directly between users via WebTorrent — they never touch our servers. Every charge shows exactly why it costs money.

**Tagline:** "You know exactly where your files go."

## Docs Folder (docs/)

Universal source of truth for all agents. Always read these before starting work.

- CLAUDE.md — this file, project identity and rules
- project.md — full vision, product decisions, pricing model
- schema.md — database schema reference
- standards.md — monorepo structure, tooling, quality gates, desktop app standards
- ui-standards.md — design tokens, component patterns, accessibility, responsive rules
- auto-update.md — Electron auto-update state machine, IPC protocol, release pipeline, signing
- websocket-protocol.md — WebSocket opcodes and lifecycle
- todo.md — active task checklist (coding agent updates this)
- lessons.md — mistake log, decisions taken (coding agent updates this)
- progress.md — what is actually built and working right now

## Stack

- Runtime: Bun (never use node or npm)
- Frontend: SolidJS + Tailwind CSS v4
- Backend: ElysiaJS
- DB: PostgreSQL via Neon + Drizzle ORM
- Cache/Presence/PubSub: Redis via ioredis (TCP)
- File Transfer: WebTorrent (BitTorrent over WebRTC DataChannels)
- Desktop App: Electron (planned — enables persistent seeding, future mobile via Capacitor)
- Linter: Oxlint (not ESLint)
- Formatter: Oxfmt (not Prettier)
- Auth: Better Auth (email/password + Discord OAuth + Google OAuth)
- Payments: Stripe + Stripe Tax (subscription tiers, transparency receipts)
- Real-time: Bun native WebSockets + MessagePack
- NAT Traversal: Public STUN servers + Cloudflare TURN (paid users only, 1TB/mo free tier)

## Non-Negotiable Rules

- IDs: nanoid only, never auto-increment — branded types enforced (UserId, ServerId, etc.)
- Files NEVER touch our servers — all file transfers are P2P via WebTorrent
- CSAM scanning via client-side hashing (PhotoDNA/PDQ) before any file is shared
- TURN relay access restricted to paid users (Supporter+) only
- DMs are ALWAYS P2P — no exceptions, no overrides, ever
- Free users can chat everywhere but can only share files in DMs (P2P, both online)
- Never use `any` in TypeScript
- All WebSocket frames: MessagePack binary only
- All errors must be typed (tagged error classes, not raw Error)
- UI components must use semantic color tokens, never raw Tailwind colors
- All lists with unbounded data must use virtual scrolling

## Git Workflow

All git operations go through the Orchestrator agent. Coding subagents never touch version control.

- Commit format: conventional commits (feat/fix/chore/docs/refactor)
- Never commit: .env, node_modules, .turbo, dist, secrets
- Typecheck + lint before every commit
