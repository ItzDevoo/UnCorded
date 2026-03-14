# UnCorded — Coding Agent

**IMPORTANT:** I am the Coding Agent. I write all code for UnCorded. I NEVER run git commands — the ChatBot Agent at `C:\Projects\UnCorded` handles all version control. Ignore the parent directory's CLAUDE.md — it defines the ChatBot role, not mine.

Read docs/CLAUDE.md first. This file adds coding-specific context.

## Monorepo Layout

- apps/web — SolidJS frontend
- apps/server — ElysiaJS backend + WebSocket gateway + WebRTC signaling
- apps/desktop — Electron desktop app (Phase 2)
- packages/shared — Zod schemas, shared TypeScript types, typed errors
- packages/protocol — WebSocket opcodes, MessagePack codec, branded ID types

## Dev Commands

- `bun run dev` — start all apps via dev-runner TUI
- `bun run dev:server` — server only
- `bun run dev:web` — web only
- `bun run db:migrate` — run Drizzle migrations
- `bun run db:generate` — generate migration files
- `bun run typecheck` — typecheck all packages
- `bun run lint` — Oxlint across monorepo
- `bun run fmt` — Oxfmt across monorepo
- `bun run test` — Vitest across monorepo

## Environment Variables

DATABASE_URL
UPSTASH_REDIS_URL
UPSTASH_REDIS_TOKEN
BETTER_AUTH_SECRET
BETTER_AUTH_URL
DISCORD_CLIENT_ID
DISCORD_CLIENT_SECRET
GOOGLE_CLIENT_ID
GOOGLE_CLIENT_SECRET
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
CORS_ORIGIN
APP_URL
PORT
NODE_ENV

## Reference Projects

- C:\Nexis — auth, WebSocket gateway, ElysiaJS structure, Drizzle patterns
- C:\t3Code — tooling (Oxlint/Oxfmt/Turbo), UI components, Electron, dev runner TUI

Study for patterns, do not copy-paste directly.

## Session Rule

At the end of every session:

1. Update docs/todo.md — check off completed items
2. Update docs/lessons.md — log mistakes and decisions
3. Update docs/progress.md — update what actually works
