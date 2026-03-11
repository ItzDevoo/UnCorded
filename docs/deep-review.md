# UnCorded Deep Review

Date: 2026-03-11
Reviewer: Deep Review Agent

## Executive Summary

The foundation is **solid for a prototype** but has **critical gaps that will bite in production**. The code is well-organized, consistently structured, and shows disciplined use of typed errors, branded IDs, and Zod validation at boundaries. However, the single biggest risk is the **complete absence of authorization on the WebSocket gateway for most operations** combined with **all real-time state being in-memory on a single process** -- this means the app cannot horizontally scale and a single restart loses all presence/membership data, while a malicious user can potentially abuse the gateway with minimal effort.

## Architecture Concerns

### 1. Server creation is not transactional

**File:** `apps/server/src/routes/server.ts` lines 36-63

The POST `/api/servers` handler inserts the server, then the "general" channel, then the member row as three separate DB operations. If the channel or member insert fails, the server row persists as an orphan with no channels and no owner membership.

**Right approach:** Wrap all three inserts in `db.transaction()`. This is explicitly called out in the existing lessons.md as a known issue but remains unfixed.

### 2. DM channel creation is not transactional

**File:** `apps/server/src/routes/dm.ts` lines 88-93, `apps/server/src/routes/friend.ts` lines 42-47

The `ensureDmChannel` function and the DM creation route insert into `dm_channels`, then `dm_members` as separate operations. If the second insert fails, orphan dm_channels rows accumulate. Same issue in dm.ts POST handler.

**Right approach:** Wrap in a transaction.

### 3. In-memory state with no persistence layer

**Files:** `apps/server/src/ws/connections.ts`, `apps/server/src/ws/server-members.ts`

The entire connection registry (`clients` Map), server membership registry (dual Map in `server-members.ts`), and presence state exist only in process memory. This means:

- Cannot run multiple server instances (no horizontal scaling)
- Server restart = all users appear offline, all membership lookups fail until users reconnect
- No way to send WS messages from background jobs (e.g., Stripe webhook updating tier should notify connected user)

**Right approach:** Redis for presence and pub/sub. The docs mention Upstash Redis but it's not wired up. This is the #1 scalability blocker.

### 4. `resolveChannelMembership` hits DB on every WS message

**File:** `apps/server/src/helpers/resolve-channel.ts`

Every TYPING_START, WEBRTC_OFFER/ANSWER/ICE_CANDIDATE, FILE_SHARE, and FILE_AVAILABILITY_UPDATE triggers 1-2 DB queries via `resolveChannelMembership` (one for server channel lookup, one for member check). Under load with 100 concurrent users in a server all typing, this is 200 DB queries per 5-second window just for typing indicators.

**Right approach:** Cache channel-to-server mapping. The server membership registry already exists in-memory; channel resolution should use it too. Only fall through to DB for DM channels (which should also be cached).

### 5. `broadcastToDm` hits DB on every call

**File:** `apps/server/src/ws/connections.ts` lines 73-100

Every DM message send, typing indicator, file share, and WebRTC signal in a DM triggers a DB query to look up `dm_members`. This is called out in lessons.md but unfixed.

**Right approach:** In-memory DM membership cache (similar to server-members.ts), populated on IDENTIFY and updated on DM creation.

### 6. No channel-level permission model

The `broadcastToServer` function sends to all server members. There is no concept of channel-specific permissions or visibility. The `roles` and `member_roles` tables exist in the schema but are completely unused anywhere in the codebase. When these are needed, they'll require touching every broadcast path.

**Right approach:** This is acceptable for MVP. But the roles tables should either be removed from the schema (to avoid confusion) or have a concrete plan for integration.

### 7. Session token sent over WebSocket in plaintext

**File:** `apps/web/src/lib/gateway.ts` line 64

The IDENTIFY frame sends `{ token }` as the session token over the WS connection. If the WebSocket connection is not over WSS (TLS), this token is exposed. The code constructs the WS URL by replacing `http` with `ws` in the API base URL, which means in dev (http://localhost:3000) the token travels in cleartext.

**Right approach:** This is acceptable in dev. In production, enforce WSS-only connections. Consider using a short-lived WS-specific ticket instead of the full session token.

## Security Issues

### CRITICAL: Invite preview endpoint is completely unauthenticated

**File:** `apps/server/src/routes/invite.ts` lines 58-91

`GET /api/invites/:code` requires no authentication. It returns the server name, icon URL, and member count. An attacker can enumerate invite codes (8-character nanoids = ~2.8 trillion combinations, but rate limiting is only 300/min globally) to discover private server names and member counts.

**How to exploit:** Brute-force invite codes with a script. Even with rate limiting at 300/min, a determined attacker from multiple IPs can map out servers.

**Fix:** This is partially by design (invite previews work for unauthenticated users so they can see what they're joining before registering). Add stricter rate limiting on this specific endpoint (e.g., 10/min per IP) or require authentication.

### CRITICAL: No rate limiting on WebSocket messages

**File:** `apps/server/src/ws/gateway.ts`

The HTTP rate limiter (`elysia-rate-limit`) only applies to REST endpoints. WebSocket messages have zero rate limiting. A connected user can flood TYPING_START, FILE_SHARE, or WEBRTC_OFFER messages at maximum speed, each triggering DB queries and broadcasts.

**How to exploit:** Connect, identify, then send thousands of TYPING_START frames per second. Each triggers `resolveChannelMembership` (2 DB queries) + username lookup (1 DB query) + broadcast. The DB connection pool will exhaust and the server will slow to a crawl.

**Fix:** Per-user per-opcode rate limiting in the gateway message handler. Token bucket or sliding window per user ID.

### HIGH: Webhook endpoint lacks IP allowlisting

**File:** `apps/server/src/routes/webhook.ts`

The Stripe webhook endpoint relies solely on signature verification. While signature verification is correct, adding Stripe's IP allowlist as a defense-in-depth measure would prevent abuse if the webhook secret leaks.

**Fix:** Validate request comes from Stripe's documented IP ranges, or put this behind a reverse proxy that does.

### HIGH: No CSRF protection on state-changing POST endpoints

All POST/PATCH/DELETE endpoints use cookie-based session auth (`credentials: "include"`). While CORS is configured, CORS does not prevent simple form submissions (which don't trigger preflight). A malicious page could submit a form to `/api/servers` with `Content-Type: application/x-www-form-urlencoded` and the browser would include cookies.

**Fix:** Elysia's body parsing likely rejects non-JSON content types, but this should be explicitly verified. Consider adding a custom header check (`X-Requested-With`) or SameSite cookie attribute enforcement.

### HIGH: Friend request by username leaks user existence

**File:** `apps/server/src/routes/friend.ts` lines 111-118

The friend request endpoint returns 404 "User not found" when a username doesn't exist and different errors for existing users (already friends, request pending, etc.). This allows enumerating valid usernames.

**Fix:** Return the same generic response regardless of whether the user exists. E.g., always return `{ status: "pending" }` even for non-existent users.

### MEDIUM: No input sanitization on message content

**File:** `apps/server/src/routes/message.ts`

Message content is stored and broadcast as-is. If the frontend renders HTML or interprets any content, this is an XSS vector. The createMessageSchema likely validates string type but doesn't sanitize content.

**Fix:** The frontend appears to render content as text (SolidJS doesn't dangerously set HTML by default), so this is mitigated client-side. But defense-in-depth: strip or escape HTML entities server-side.

### MEDIUM: User status update has no validation of allowed values

**File:** `apps/server/src/routes/user.ts` line 66

The `updateUserSchema` allows setting `status` but the schema isn't visible in the reviewed files. If it accepts arbitrary strings, a user could set their status to any value, bypassing the `user_status` enum.

**Fix:** Validate against the allowed enum values (`online`, `idle`, `dnd`, `offline`) in the Zod schema.

### MEDIUM: Stripe tier not re-verified on WS gateway operations

**File:** `apps/server/src/ws/gateway.ts` lines 229-247

The FILE_SHARE handler checks `user.subscriptionTier` from the DB on every file share. This is correct but expensive (DB query per file share). However, if a user's subscription is cancelled via webhook while they're connected, their cached WsContext doesn't update -- they can continue sharing files until they reconnect.

**Fix:** When the webhook updates a user's tier, broadcast a tier change event to the user's connections, or add the tier to WsContext and update it via WS message.

### LOW: Health endpoint accessible without auth

**File:** `apps/server/src/index.ts` line 44

`GET /health` returns `{ status: "ok" }`. This is standard and acceptable, but ensure it doesn't leak version information or internal details in production.

## Logic Bugs

### 1. Race condition in WS close handler

**File:** `apps/server/src/ws/gateway.ts` lines 333-349

When two tabs for the same user disconnect simultaneously, the close handler calls `removeConnection` then checks `getConnections` to see if the user has no remaining connections. Because these are not atomic, both close handlers could see the set as empty after their own removal, causing `removeUserFromAllServers` and the offline DB update to execute twice.

**Impact:** Double offline broadcast, double DB update (harmless but wasteful). The `removeConnection` function itself is safe (Set.delete is idempotent) but `getConnections` returning undefined after both removes means `removeUserFromAllServers` runs twice -- the second call is a no-op since the first already cleared the maps.

**Verdict:** Functionally harmless but indicates a general lack of concurrency guards.

### 2. `ensureDmChannel` doesn't return the created channel ID

**File:** `apps/server/src/routes/friend.ts` lines 27-87

`ensureDmChannel` returns `void` (via early return or falling through). The callers (friend accept, auto-accept) don't use the return value, but the DM channel is created as a side effect with WS broadcasts. If the broadcast fails, the DM exists in DB but the clients don't know about it until they refresh.

### 3. Message list query excludes messages with deleted authors

**File:** `apps/server/src/routes/message.ts` lines 161-179

The message list uses `innerJoin(user, eq(user.id, messages.authorId))`. When an author is deleted (authorId set to null via onDelete: "set null"), those messages are excluded from the query entirely. The schema allows null authorId for "[deleted user]" messages, but the query never returns them.

**Fix:** Use `leftJoin` instead of `innerJoin` and handle null author fields.

### 4. `fetchMessageWithAuthor` also excludes deleted-author messages

**File:** `apps/server/src/routes/message.ts` lines 37-64

Same innerJoin issue. A message edit or create response for a message whose author was concurrently deleted would fail silently (return null, then the WS broadcast sends null).

### 5. Friend list query builds OR conditions from an array

**File:** `apps/server/src/routes/friend.ts` lines 440

`or(...peerIds.map((id) => eq(user.id, id)))` -- if `peerIds` is empty (which is guarded against earlier), `or()` with zero arguments returns `undefined`, which Drizzle treats as no condition, returning ALL users. The guard at line 429 prevents this, but the pattern is fragile.

### 6. Invite accept doesn't check if server still exists

**File:** `apps/server/src/routes/invite.ts` lines 103-201

The invite accept flow inserts the member row, then queries the server for the broadcast payload. If the server was deleted between these operations (race condition), the server query returns empty and the response has `server: undefined` -- the client receives broken data.

### 7. DM GET endpoint builds OR chain from channelIds array

**File:** `apps/server/src/routes/dm.ts` lines 154-165

`or(...channelIds.map((cid) => eq(dmMembers.channelId, cid)))` -- same pattern issue. If `channelIds` is empty (guarded at line 149), `or()` with no args would match all rows. But more importantly, for a user with 100+ DMs, this builds a query with 100+ OR conditions instead of using `inArray`.

**Fix:** Use `inArray(dmMembers.channelId, channelIds)` instead of chaining OR conditions.

## Scalability Blockers

### 1. All real-time state is in-memory (single process only)

**What:** `connections.ts` (Map<userId, Set<ws>>), `server-members.ts` (dual Map<serverId, Set<userId>> / Map<userId, Set<serverId>>)

**Breaks at:** Second server instance. You cannot run two instances behind a load balancer because WS connections on instance A don't know about connections on instance B.

**Fix:** Redis pub/sub for cross-instance message routing. Store connection registry per-instance but use Redis to discover which instance a user is on.

### 2. Missing database indexes

**Critical missing indexes:**

- `subscriptions.user_id` -- queried on every checkout and webhook event, no index
- `subscriptions.stripe_subscription_id` -- queried on every webhook update/delete, no index
- `friendships(user_id, friend_id)` -- has composite PK but queries often filter by just one column
- `dm_members.user_id` -- queried to find all DMs for a user, no single-column index
- `file_receipts.channel_id` -- will be queried when loading file receipts for a channel
- `invites.server_id` -- queried when creating invites

**Breaks at:** A few thousand rows in each table. Neon is PostgreSQL, so unindexed queries on growing tables will slow linearly.

### 3. READY payload loads everything eagerly

**File:** `apps/server/src/ws/handlers.ts` lines 46-268

On every WS connection (and every reconnect), the IDENTIFY handler loads: user profile, all servers + all channels for those servers, all DM channels + all DM peer profiles, all friendships + all friend profiles. For a user in 50 servers with 20 channels each, this is 1000+ channels loaded eagerly.

**Breaks at:** ~50 servers per user, or ~100 DM channels. The READY payload becomes large enough to cause noticeable connection delay.

**Fix:** Lazy-load channels per server (only load channels when a server is selected). Send a lightweight server list in READY, then fetch channels on demand.

### 4. No pagination on member list, friend list, or DM list

**Files:** `member.ts` GET, `friend.ts` GET/GET pending, `dm.ts` GET

All list endpoints return all rows with no pagination. A server with 10,000 members would return all of them in one response.

**Fix:** Add cursor-based pagination (like messages already have).

### 5. broadcastToServer iterates all members

**File:** `apps/server/src/ws/connections.ts` lines 48-70

For a server with 1000 members, every message/typing/file event iterates all 1000 member IDs, looks up their connection sets, and sends to each. This is O(members * tabs_per_member) per broadcast.

**Breaks at:** ~500 concurrent members in a single server. The broadcast loop becomes the bottleneck, especially since `Buffer.from(encode(frame))` is called once (good), but iterating 1000 members with 2 tabs each = 2000 `ws.send()` calls per message.

**Fix:** For the current single-instance architecture, this is acceptable. For multi-instance, Redis pub/sub.

### 6. `resolveChannelMembership` does 2 sequential DB queries

**File:** `apps/server/src/helpers/resolve-channel.ts`

First queries `channels` table, then `members` table. These could be combined into a single JOIN query. More importantly, this is called on every WS message handler, making it the hottest path.

**Fix:** Single query with JOIN, or use in-memory cache.

## Code Quality Issues

### 1. Duplicated auth resolve across every route file

Every route file has the same `.resolve()` block:
```typescript
.resolve(async ({ status, request }) => {
  const session = await getSession(request.headers);
  if (!session) return status(401, ...);
  return { user: session.user, session: session.session };
})
```

This is duplicated 9 times across route files. The lessons.md explains why (Elysia doesn't propagate resolved types across `.use()` boundaries), but a factory function that returns the resolve config would reduce duplication while maintaining type safety.

### 2. Inconsistent error handling in webhook handlers

**File:** `apps/server/src/routes/webhook.ts`

The webhook event handlers (`handleCheckoutCompleted`, `handleSubscriptionUpdated`, `handleSubscriptionDeleted`) silently return on missing data (`if (!userId || !tier) return`). If Stripe sends malformed data or the metadata is missing, there's no logging. The `tierFromPriceId` returning null is also silent.

Production debugging will be painful without logs here.

### 3. `Object.assign` mutation of DB query results

**Files:** `server.ts` line 100, `channel.ts` line 69, `message.ts` line 184, `member.ts` line 40

Several routes use `Object.assign(dbRow, { id: branded(...) })` to mutate DB result objects in-place. While this works (Drizzle doesn't cache result objects), it's an anti-pattern that will cause bugs if result caching is ever added. Some routes use spread (`{ ...row, id: branded(...) }`), creating inconsistency.

### 4. `as const` on object literals with dynamic values

**File:** `apps/server/src/ws/gateway.ts` and others

Several frame construction sites use `as const` on objects containing dynamic values. This doesn't meaningfully narrow the type since `as const` on a non-literal-only object just makes properties readonly. Not harmful, but misleading.

### 5. No test coverage

There are zero test files in the entire codebase. The standards document specifies Vitest, test strategies, and viewport testing matrices, but none of it exists. For a project handling real money (Stripe) and real-time communication, this is a significant gap.

### 6. Zod schemas duplicated between server and client

The server gateway has its own Zod schemas for WS payloads (in `gateway.ts`), and the client has separate Zod schemas for the same payloads (in `message-store.ts`, `file-store.ts`, etc.). These should live in `@uncorded/protocol` or `@uncorded/shared` as the single source of truth.

### 7. Store modules with side effects on import

**Files:** `message-store.ts`, `file-store.ts`, `server-store.ts`, `friend-store.ts`

These modules register WS event listeners at the module level (on import). This means importing the module has side effects. The HMR cleanup handles dev mode, but in production, the order and timing of these imports matters. If a store module is imported before the gateway connects, listeners will miss events that arrive before the module loads. This currently works because READY is the first event, but it's fragile.

## What I Would Restructure

### 1. Extract a gateway message router

Instead of a giant switch statement in `gateway.ts`, create a handler registry pattern:
```
registerHandler(Opcode.TYPING_START, typingHandler)
registerHandler(Opcode.FILE_SHARE, fileShareHandler)
```
Each handler in its own file with its own Zod schema. The router handles common concerns (auth check, rate limiting, error wrapping).

### 2. Shared WS schemas in protocol package

Move all WS payload Zod schemas to `@uncorded/protocol`. Both server and client import from the same source. No more duplicate schemas that can drift.

### 3. Redis from day one

The in-memory caches (connections, server members, DM members, channel-to-server mapping) should be backed by Redis even in single-instance mode. This gives you:
- Persistence across restarts
- Foundation for horizontal scaling
- Pub/sub for cross-concern notifications (webhook -> WS)

### 4. Connection-scoped context

Store user profile (username, subscriptionTier, serverIds) in the WS context on IDENTIFY. This eliminates repeated DB queries for username (TYPING_START) and tier checks (FILE_SHARE). Update via targeted WS messages when the profile changes.

### 5. Auth middleware as an Elysia guard plugin pattern

Create a type-safe wrapper that handles the Elysia type propagation issue cleanly:
```typescript
function authed(fn: (ctx: AuthedContext) => ...) {
  return new Elysia().resolve(...).handler(fn);
}
```
This eliminates the 9x copied resolve block.

### 6. Lazy-load READY payload

Send a minimal READY (user + server IDs + names). Fetch channels, members, DMs, and friends on demand when the user navigates. This dramatically reduces connection time and scales better.

## What Is Actually Good

### 1. Branded ID types

The branded type system (`UserId`, `ServerId`, etc.) with cast constructors at boundaries is well-implemented. This prevents a whole class of ID confusion bugs at compile time while keeping the runtime cost zero.

### 2. Typed error hierarchy

The `AppError` subclass hierarchy with `_tag`, `statusCode`, and `code` is clean. The central `.onError()` handler maps these to HTTP responses consistently. Routes throw typed errors instead of manually setting status codes.

### 3. WebSocket protocol design

The opcode-based binary MessagePack protocol is efficient and well-structured. The HELLO/IDENTIFY/READY handshake is standard. The heartbeat mechanism is correct. Close codes are meaningful and documented.

### 4. Zod validation at WS boundaries

Both server and client validate WS payloads with Zod before processing. This prevents malformed data from propagating. The `safeParse` + early return pattern is consistently applied.

### 5. WeakMap for WS context

Using `WeakMap<ws.raw, WsContext>` to survive Elysia's wrapper recreation is the correct pattern, well-documented in lessons.md.

### 6. HMR cleanup in frontend stores

Every store module that registers event listeners or timers properly cleans up via `import.meta.hot.dispose()`. This prevents listener accumulation during development.

### 7. Environment validation

The `env.ts` Zod schema with transforms (empty string -> undefined) and production guards is well-done. Optional services (Stripe, Redis, OAuth) gracefully degrade when unconfigured.

### 8. In-memory server membership dual-map

The dual `Map<serverId, Set<userId>>` + `Map<userId, Set<serverId>>` design gives O(1) broadcast lookups and O(1) disconnect cleanup. This is the right data structure for the problem.

### 9. Documentation discipline

The docs/ folder is comprehensive and maintained. The lessons.md is particularly valuable -- it captures every mistake and the root cause. The progress.md accurately reflects the codebase state.

### 10. Cursor-based pagination on messages

The message pagination uses composite cursor (createdAt + id) with tiebreaking, which handles timestamp collisions correctly. This is production-grade pagination.

## Priority Order

1. **[CRITICAL]** No rate limiting on WebSocket messages -- effort: 2-4 hours -- A single malicious client can DoS the database. This is the highest-risk issue because it requires no special access (any authenticated user can exploit it) and causes cascading failure.

2. **[CRITICAL]** Server creation not transactional -- effort: 30 minutes -- Orphan servers with no channels or members. Quick fix, high impact on data integrity.

3. **[HIGH]** Missing database indexes on subscriptions, friendships, dm_members, file_receipts -- effort: 1-2 hours -- Performance degrades linearly with data growth. Simple migration to add indexes.

4. **[HIGH]** `resolveChannelMembership` and `broadcastToDm` hitting DB on every WS message -- effort: 4-6 hours -- These are the hottest code paths. Caching them in-memory (like server members already are) eliminates the majority of gateway DB queries.

5. **[HIGH]** Message queries exclude deleted-author messages (innerJoin bug) -- effort: 1 hour -- Users will see messages disappear when another user deletes their account. Switch to leftJoin.

6. **[HIGH]** No test coverage -- effort: ongoing -- The project handles real money via Stripe and has complex real-time state. At minimum, integration tests for webhook handlers and auth flows.

7. **[MEDIUM]** DM channel and friend accept flows not transactional -- effort: 1 hour -- Orphan records on partial failure.

8. **[MEDIUM]** Webhook handlers silently swallow errors -- effort: 1 hour -- Add logging for all early returns in webhook handlers. Essential for production debugging.

9. **[MEDIUM]** Friend request leaks user existence -- effort: 30 minutes -- Return consistent response regardless of whether username exists.

10. **[MEDIUM]** DM endpoint uses OR chain instead of `inArray` -- effort: 30 minutes -- Performance issue that gets worse with more DMs. Simple fix.
