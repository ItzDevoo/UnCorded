# UnCorded — Coding Agent

Read docs/CLAUDE.md first. This file adds coding-specific context.

## Memory
Read `memory.md` at session start — it has current state, technical lessons, and patterns that persist between conversations. Update it when you learn something new.

## Docs Location

All reference docs are in docs/ (repo root)

- docs/CLAUDE.md — project identity, stack, rules
- docs/project.md — full vision, product decisions, pricing
- docs/schema.md — database schema
- docs/standards.md — monorepo structure, tooling, quality gates
- docs/ui-standards.md — design tokens, component patterns, accessibility
- docs/auto-update.md — Electron auto-update architecture
- docs/websocket-protocol.md — WS opcodes and lifecycle
- docs/todo.md — active tasks
- docs/lessons.md — past mistakes and decisions
- docs/progress.md — what actually works

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
4. Update memory.md — save anything learned for next session
