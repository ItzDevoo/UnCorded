# Fresh-Eyes Audit — 2026-03-15

Auditor: Claude (fresh context, no prior sessions)
Scope: Schema drift, dead code, contract mismatches, env gaps, test coverage, production readiness

---

## Critical (will break in production)

### ~~C1: Frontend ignores CHANNEL_CREATE/UPDATE/DELETE WebSocket events~~ — FALSE POSITIVE

- **Files:** `apps/web/src/stores/server-store.ts:102-136`
- **Status:** Already fixed. The `setupServerStore()` function wires `onGatewayEvent()` listeners for CHANNEL_CREATE (line 102), CHANNEL_UPDATE (line 117), and CHANNEL_DELETE (line 131), calling the gateway-store mutation functions. The lessons.md note about this being missing is outdated.

### ~~C2: Ungated console.error() calls leak to production~~ — RESOLVED

**Fixed in PR #58 on 2026-03-16.**

- `"[app-store] Failed to fetch channels:"` in `apps/web/src/stores/app-store.ts:58` — now gated behind `if (import.meta.env.DEV)`
- `"[settings] Failed to fetch user email:"` in `apps/web/src/components/settings/account-settings.tsx:31` — now gated behind `if (import.meta.env.DEV)`
- All 20 frontend `console.error`/`console.warn` calls are now consistently dev-gated.

---

## Inconsistencies (won't crash but will confuse)

### ~~I1: .env.example missing 4 environment variables~~ — RESOLVED

**Fixed in PR #58 on 2026-03-16.** All 4 vars added to `.env.example`: `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `TURN_KEY_ID`, `TURN_KEY_API_TOKEN`.

### ~~I2: CORS origin accepts wildcard with credentials~~ — FALSE POSITIVE

- **File:** `apps/server/src/env.ts:3-6`
- **Status:** `CORS_ORIGIN` uses `optionalUrl` which pipes through `z.string().url().optional()`. Setting `CORS_ORIGIN=*` would fail Zod URL validation at startup. No risk here.

### I3: IDLE_TIMEOUT_MS is 5 minutes, docs/progress.md says 5 minutes — consistent

- **File:** `packages/shared/src/constants.ts:43`

  ```typescript
  export const IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes
  ```

- **Status:** Verified consistent. No drift here.

---

## Dead Code (safe to remove)

### ~~D1: clearTurnCredentialsCache() — exported but never used~~ — RESOLVED

**Fixed in PR #58 on 2026-03-16.** Export removed from `apps/web/src/lib/rtc-config.ts`.

---

## Documentation Drift (docs don't match reality)

### ~~DD1: .env.example out of date~~ — RESOLVED

- **Same as I1 above.** Fixed in PR #58 on 2026-03-16.

### DD2: Schema docs — verified in sync

- **Files:** `docs/schema.md` vs `apps/server/src/db/schema.ts`
- **Status:** All 6 enums, 15 tables, columns, defaults, foreign keys, and indexes match. No drift detected.

### DD3: WebSocket protocol docs — verified in sync

- **Files:** `docs/websocket-protocol.md` vs `packages/protocol/src/opcodes.ts` vs `apps/server/src/ws/gateway.ts`
- **Status:** All 37 opcodes documented, defined, and properly scoped (client→server handled in gateway, server→client sent via broadcast). Heartbeat interval: docs say 30s, code uses `HEARTBEAT_INTERVAL_MS = 30_000` — matches.

### DD4: READY payload — verified in sync

- **Files:** `apps/server/src/ws/handlers.ts` (lines 254-268) vs `packages/protocol/src/schemas.ts` (readyEventSchema)
- **Status:** All fields match: user, servers, dmChannels, hasMoreDmChannels, friends, hasMoreFriends. No drift.

---

## Test Gaps (untested paths)

### T1: Zero frontend test files

- **Path:** `apps/web/src/` — no `*.test.ts`, `*.test.tsx`, `*.spec.ts` files exist
- **Impact:** All UI components, stores, WebSocket client, file sharing flows, and presence management are completely untested.
- **Fix:** Add vitest config to apps/web, start with gateway.ts (connection/reconnect logic) and store initialization.

### T2: 11 of 12 route files have no tests

- **Tested:** `apps/server/src/routes/__tests__/webhook.test.ts` (17 tests)
- **Untested routes:**
  - `routes/user.ts` — profile updates, avatar upload, account deletion
  - `routes/server.ts` — server CRUD, ownership transfer
  - `routes/channel.ts` — channel CRUD
  - `routes/member.ts` — join/leave server
  - `routes/message.ts` — message CRUD, pagination
  - `routes/friend.ts` — friend requests, accept/remove
  - `routes/dm.ts` — DM channel operations
  - `routes/invite.ts` — invite create/revoke/join
  - `routes/stripe.ts` — checkout session creation
  - `routes/turn.ts` — TURN credential generation
  - `routes/gateway.ts` — ticket generation
- **Impact:** Permission checks, pagination edge cases, and tier restrictions are only manually tested.

### T3: No WebSocket gateway integration tests

- **File:** `apps/server/src/ws/gateway.ts` — 400+ lines of opcode routing
- **Impact:** Connection lifecycle (HELLO→IDENTIFY→READY), heartbeat timeout, rate limiting, and presence broadcasts have no automated tests. The only WS-adjacent test is `rate-limit.test.ts` (6 tests for the rate limiter utility).

### T4: Existing tests are unit-only, no integration tests

- **What exists (6 files, ~77 test cases):**
  - `apps/server/src/helpers/__tests__/permissions.test.ts` — 6 tests
  - `apps/server/src/middleware/ip-rate-limit.test.ts` — 6 tests
  - `apps/server/src/routes/__tests__/webhook.test.ts` — 17 tests
  - `apps/server/src/ws/rate-limit.test.ts` — 6 tests
  - `packages/protocol/src/schemas.test.ts` — 16 tests
  - `packages/shared/src/schemas.test.ts` — 26 tests
- **Gap:** All tests mock dependencies. No tests hit a real database, real WebSocket, or real Stripe API. The webhook tests mock Stripe signature verification.

---

## Recommendations (quick wins)

### ~~R1: Add missing env vars to .env.example~~ — RESOLVED

**Fixed in PR #58 on 2026-03-16.** Added `RATE_LIMIT_MAX`, `RATE_LIMIT_WINDOW_MS`, `TURN_KEY_ID`, `TURN_KEY_API_TOKEN`.

### ~~R2: Gate 2 ungated console.error calls~~ — RESOLVED

**Fixed in PR #58 on 2026-03-16.** Both `"[app-store] Failed to fetch channels:"` and `"[settings] Failed to fetch user email:"` now wrapped in `if (import.meta.env.DEV)`.

### ~~R3: Remove dead clearTurnCredentialsCache export~~ — RESOLVED

**Fixed in PR #58 on 2026-03-16.** Export removed from `apps/web/src/lib/rtc-config.ts`.

### R4: Add vitest to apps/web

- Copy vitest config pattern from apps/server, add `"test"` script to web package.json
- Start with testing `gateway.ts` reconnection logic and store initialization
- Effort: 30 minutes for setup, ongoing for coverage

---

## What's NOT broken

Credit where due — several things that commonly go wrong are handled well here:

- **Schema ↔ docs:** Fully synchronized across 15 tables and 6 enums
- **READY payload:** Backend and frontend agree on exact shape
- **WebSocket protocol:** All 37 opcodes documented, defined, and handled correctly
- **Console logging:** All 20 frontend console calls are now dev-gated (last 2 fixed in PR #58)
- **Hardcoded URLs:** Both frontend and backend use env vars with safe localhost fallbacks, with production validation that blocks localhost in prod
- **Heartbeat timing:** Docs, shared constants, and gateway code all agree on 30s/45s
- **Branded types:** Consistently used throughout — no ID confusion possible
- **Binary protocol:** MessagePack encoding/decoding is solid with Zod validation on all payloads
- **CORS validation:** `optionalUrl` Zod schema prevents wildcard or invalid origins at startup
