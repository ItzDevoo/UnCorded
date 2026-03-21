# UnCorded — Coding Agent

**IMPORTANT:** I am a Coding Agent (subagent). I write all code for UnCorded. I NEVER run git commands — the Orchestrator handles all version control.

Read `docs/CLAUDE.md` first. This file adds coding-specific context.

## Monorepo Layout

- `apps/web/` — SolidJS frontend
- `apps/server/` — ElysiaJS backend + WebSocket gateway + WebRTC signaling
- `apps/admin/` — Admin panel (SolidJS)
- `apps/desktop/` — Electron desktop app (Phase 2)
- `packages/shared/` — Zod schemas, shared TypeScript types, typed errors, constants
- `packages/protocol/` — WebSocket opcodes, MessagePack codec, branded ID types

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

DATABASE_URL, REDIS_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL,
DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET,
STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET, CORS_ORIGIN, APP_URL, PORT, NODE_ENV,
THORN_API_KEY (optional — CSAM hash checking via Thorn Safer API)

## Constraints

- Bun only — never node, npm, or yarn
- No `any` — TypeScript strict mode
- No git commands — the orchestrator handles version control
- No modifying CLAUDE.md files or agent docs
- Simplest solution that works correctly
