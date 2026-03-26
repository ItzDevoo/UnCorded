# UnCorded

**You know exactly where your files go.**

Real-time chat with P2P file sharing. Files transfer directly between users via WebTorrent — they never touch our servers. Every charge shows exactly why it costs money.

[![CodeRabbit Pull Request Reviews](https://img.shields.io/coderabbit/prs/github/ItzDevoo/UnCorded?utm_source=oss&utm_medium=github&utm_campaign=ItzDevoo%2FUnCorded&labelColor=171717&color=FF570A&link=https%3A%2F%2Fcoderabbit.ai&label=CodeRabbit+Reviews)](https://coderabbit.ai)

## What is UnCorded?

UnCorded is a chat platform built on radical transparency. No dark patterns, no hidden fees, no file storage on our servers.

- **P2P file sharing** — files go directly from sender to receiver via WebTorrent. Our server handles signaling only.
- **Transparent pricing** — every charge explains what it costs and why. Profit margins shown on subscriptions.
- **Privacy-first** — DMs are always P2P. Files never touch our servers. There's nothing to hand over if requested.
- **CSAM safety** — client-side perceptual hashing before any file is shared.

## Stack

| Layer | Technology |
|-------|-----------|
| Runtime | [Bun](https://bun.sh) |
| Frontend | [SolidJS](https://solidjs.com) + [Tailwind CSS v4](https://tailwindcss.com) |
| Backend | [ElysiaJS](https://elysiajs.com) |
| Database | PostgreSQL via [Neon](https://neon.tech) + [Drizzle ORM](https://orm.drizzle.team) |
| Cache / PubSub | Redis via ioredis |
| File Transfer | [WebTorrent](https://webtorrent.io) (BitTorrent over WebRTC) |
| Auth | [Better Auth](https://better-auth.com) (email/password + Discord + Google OAuth) |
| Payments | Stripe + Stripe Tax |
| Real-time | Bun native WebSockets + MessagePack |
| Linter | [Oxlint](https://oxc.rs) |
| Formatter | [Oxfmt](https://oxc.rs) |

## Project Structure

```
apps/
  web/          SolidJS frontend
  server/       ElysiaJS API + WebSocket server
  admin/        Admin panel (SolidJS)
packages/
  shared/       Shared types, schemas, constants
  protocol/     WebSocket opcodes + frame types
```

## Development

```bash
# Install dependencies
bun install

# Run dev servers
bun run dev

# Typecheck all packages
bun run typecheck

# Lint
bun run lint

# Format
bun run fmt
```

## Key Design Decisions

- **nanoid for all IDs** — never auto-increment. Branded types enforced (`UserId`, `ServerId`, etc.)
- **Files never touch our servers** — all transfers are P2P via WebTorrent
- **MessagePack binary** for all WebSocket frames — no JSON over the wire
- **Typed errors only** — tagged error classes, never raw `Error`
- **Virtual scrolling** for all unbounded lists

## License

Private. All rights reserved.
