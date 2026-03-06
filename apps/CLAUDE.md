# UnCorded — Coding Agent

Read C:\UnCorded\Docs\CLAUDE.md first. This file adds coding-specific context.

## Docs Location
All reference docs are in C:\UnCorded\Docs\
- @C:\UnCorded\Docs\todo.md — active tasks
- @C:\UnCorded\Docs\schema.md — database schema
- @C:\UnCorded\Docs\websocket-protocol.md — WS opcodes
- @C:\UnCorded\Docs\lessons.md — past mistakes
- @C:\UnCorded\Docs\progress.md — what actually works

## Monorepo Layout
- apps/web — SolidJS frontend
- apps/server — ElysiaJS backend + WebSocket gateway
- packages/shared — Zod schemas, shared TypeScript types
- packages/protocol — WebSocket opcodes enum, MessagePack codec

## Dev Commands
- `bun dev` — start all apps (Turborepo)
- `bun run db:migrate` — run Drizzle migrations
- `bun run db:generate` — generate migration files
- `bun run typecheck` — typecheck all packages
- `bun run lint` — ESLint across monorepo

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
R2_ACCOUNT_ID
R2_ACCESS_KEY_ID
R2_SECRET_ACCESS_KEY
R2_BUCKET_NAME
R2_PUBLIC_URL
STRIPE_SECRET_KEY
STRIPE_WEBHOOK_SECRET
STRIPE_AVATAR_PRICE_ID
STRIPE_EXPIRY_PRICE_ID
CORS_ORIGIN
APP_URL
PORT
NODE_ENV

## Reference Project
C:\Nexis — use for implementation patterns only, do not copy-paste directly.
Key files to reference:
- C:\Nexis\package.json — monorepo + Turborepo setup
- C:\Nexis\apps\server\src\auth.ts — Better Auth config
- C:\Nexis\apps\server\src\db\schema.ts — Drizzle schema patterns
- C:\Nexis\apps\server\src\middleware\auth.ts — auth middleware
- C:\Nexis\packages\protocol\src\opcodes.ts — WS opcode enum pattern

## Session Rule
At the end of every session:
1. Update C:\UnCorded\Docs\todo.md — check off completed items
2. Update C:\UnCorded\Docs\lessons.md — log mistakes and decisions
3. Update C:\UnCorded\Docs\progress.md — update what actually works
