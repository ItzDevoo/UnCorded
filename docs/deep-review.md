# UnCorded Deep Review

Date: 2026-03-14
Reviewer: Deep Review Agent

---

## Executive Summary

The foundation is **solid for a pre-launch product** — the WebSocket gateway, auth system, and SolidJS architecture are well-designed and will hold up under moderate load. The single biggest risk right now is **the complete absence of REST API rate limiting on critical endpoints** (message creation, friend requests, server creation), which means a single authenticated user can trivially DoS the system or spam other users. The second-biggest risk is the MessagePack decoder accepting unbounded payloads, enabling OOM denial-of-service via a single malicious WebSocket frame.

---

## Architecture Concerns

### AC-1: All real-time state is in-memory — zero horizontal scalability

**What:** Connection registry (`connections.ts`), server membership maps (`server-members.ts`), channel cache (`channel-cache.ts`), presence timers (`presence.ts`), and gateway tickets (`gateway.ts` in-memory Map) are all in-process memory.

**Why it's a problem:** You cannot run two server instances behind a load balancer. A WebSocket connected to instance A will never receive broadcasts from instance B. This is a hard blocker for any HA or scaling story. The code has `publishCacheInvalidation()` stubs in `server-members.ts` that publish to Redis, but there are no subscribers consuming those events.

**Right approach:** Redis pub/sub for cross-instance broadcast (the stubs are there, just need subscriber logic). Redis-backed connection registry with instance-ID tagging. Gateway tickets already use Redis with fallback — good.

### AC-2: Channel CRUD events not handled on the frontend

**What:** The WebSocket protocol defines opcodes `CHANNEL_CREATE` (40), `CHANNEL_UPDATE` (41), `CHANNEL_DELETE` (42), but **no store handler** on the frontend listens for them. The `channelCache` in `app-store.ts` is fetched once per server selection and never updated.

**Why it's a problem:** If any user creates, renames, reorders, or deletes a channel while another user is connected, the other user sees stale channel data until they disconnect and reconnect. This is a **visible production bug** — not a scalability concern, a correctness issue.

**Right approach:** Add WS event handlers in the frontend stores for ops 40-42 that update the channel cache reactively.

### AC-3: READY payload does too much work in one shot

**What:** `handleIdentify()` in `handlers.ts` executes 5-6 sequential DB queries (user, servers, channels, DM memberships, DM members + user joins, friendships + user joins), seeds two caches, registers server memberships, and broadcasts presence — all before sending READY.

**Why it's a problem:** At 1000 concurrent users, a server restart triggers 1000 simultaneous IDENTIFY flows, each doing 5-6 queries. That's 5000-6000 queries hitting Neon in a burst. IDENTIFY latency directly impacts perceived reconnect speed.

**Right approach:** Lazy-load DMs and friends (paginate in READY, fetch more on demand — partially done with `hasMoreDmChannels`/`hasMoreFriends`). Consider caching READY payloads in Redis with short TTL. Batch the DB queries where possible (the current sequential pattern is correct but could use `Promise.all` for independent queries like servers + DMs + friends).

### AC-4: Server deletion broadcasts before DB delete

**What:** `server.ts` L186-194 broadcasts `SERVER_DELETE` to all members, calls `removeServer()` on in-memory registry, then does the DB delete. If the DB delete fails, clients have already removed the server from their UI but it still exists.

**Right approach:** DB delete first (cascades handle channels/members/invites), then broadcast + registry cleanup.

### AC-5: Webhook handlers lack transactions

**What:** `handleCheckoutCompleted` in `webhook.ts` does a select, then upsert on subscriptions, then update on users — 2-3 separate queries. `handleSubscriptionUpdated` and `handleSubscriptionDeleted` do the same pattern.

**Why it's a problem:** If the server crashes between updating the subscription and updating the user tier, the subscription record says "active" but the user record says "free" (or vice versa). Stripe will not retry because we already returned 200.

**Right approach:** Wrap each webhook handler's DB operations in `db.transaction()`.

---

## Security Issues

### SEC-1: MessagePack decode has no size limits — OOM DoS [CRITICAL]

**File:** `packages/protocol/src/codec.ts` — `decode()`

**Vulnerability:** `msgpackDecode()` is called with no `maxStrLength`, `maxBinLength`, `maxArrayLength`, or `maxMapLength` options. A malicious client can craft a MessagePack payload with a header claiming a 2GB string, causing the server to attempt allocation and crash with OOM.

**Exploitation:** Any authenticated WebSocket client sends a ~50 byte binary frame that declares a massive string. Server allocates, crashes. Trivial to exploit.

**Fix:** Pass decode options: `{ maxStrLength: 65536, maxBinLength: 65536, maxArrayLength: 1000, maxMapLength: 100 }`. Adjust limits to match your largest legitimate payload (READY event).

### SEC-2: No REST API rate limiting on message creation [CRITICAL]

**File:** `apps/server/src/routes/message.ts` — `POST /channels/:channelId/messages`

**Vulnerability:** No rate limit. An authenticated user can send thousands of messages per second, flooding channels and consuming DB write capacity.

**Exploitation:** Simple loop sending POST requests. Affects all users in the channel.

**Fix:** Add per-user rate limit (e.g., 5 messages per 5 seconds). The global `rateLimit()` middleware in `index.ts` IS wired up but uses generic per-IP limits — needs per-user, per-endpoint limits on sensitive routes.

### SEC-3: No rate limiting on friend requests [HIGH]

**File:** `apps/server/src/routes/friend.ts` — `POST /friends/request`

**Vulnerability:** No rate limit. A user can spam friend requests to every username, harassing users and potentially enumerating valid usernames via timing differences.

**Fix:** Per-user rate limit (e.g., 10 requests per minute).

### SEC-4: Password fields have no max length — hash DoS [HIGH]

**Files:** `packages/shared/src/schemas/user.ts` — `changePasswordSchema`, `deleteAccountSchema`

**Vulnerability:** Password fields use `z.string().min(8)` with no `.max()`. A client can send a 10MB password string. Better Auth will attempt to hash it with bcrypt/argon2, consuming CPU for potentially minutes per request.

**Exploitation:** Send a few concurrent requests with 10MB passwords to exhaust the server's CPU.

**Fix:** Add `.max(128)` to all password schema fields.

### SEC-5: Empty messages can be created [HIGH]

**File:** `packages/shared/src/schemas/message.ts` — `createMessageSchema`

**Vulnerability:** `content` is `z.string().max(4000).optional()`. A client can create a message with `content: undefined` or `content: ""` — a blank message that takes up space, confuses UI, and bypasses any content moderation.

**Fix:** Either require content with `.min(1)` or explicitly handle file-only messages (content null + file receipt present).

### SEC-6: Friend block allows phantom users [MEDIUM]

**File:** `apps/server/src/routes/friend.ts` — `POST /:userId/block`

**Vulnerability:** Doesn't verify the target user exists before inserting a block row. Creates `friendships` rows pointing to non-existent users.

**Fix:** Verify target user exists before insert.

### SEC-7: No self-interaction checks on friend endpoints [MEDIUM]

**File:** `apps/server/src/routes/friend.ts`

**Vulnerability:** No check preventing a user from sending a friend request to themselves, blocking themselves, etc. Could cause weird state.

**Fix:** Add `if (targetUserId === sessionUserId) throw new ValidationError(...)` to friend request, block, and accept endpoints.

### SEC-8: Subscription tier checked from cached WS context, not DB [MEDIUM]

**File:** `apps/server/src/ws/gateway.ts` L262-263

**Vulnerability:** `ctx.subscriptionTier` is set during IDENTIFY and never refreshed. If a user downgrades mid-session, they retain paid features until they reconnect. The code has a comment acknowledging this tradeoff.

**Impact:** Low monetary impact (TURN relay usage, server file sharing) but technically a tier enforcement gap.

**Mitigation:** The `CloseCode.SESSION_UPDATED` force-reconnect on webhook tier change covers the main path. Edge case: if the webhook fires but the WS disconnect fails, the user keeps the old tier.

### SEC-9: Unbounded invite list query [MEDIUM]

**File:** `apps/server/src/routes/invite.ts` — `GET /api/invites`

**Vulnerability:** Returns all invites for a server with no pagination. A server with thousands of invites causes a large response and heavy DB load.

**Fix:** Add cursor-based pagination.

### SEC-10: No resource creation limits [MEDIUM]

**Files:** Multiple route files

**Vulnerability:** No limits on servers per user, channels per server, invites per server, or members per server. A single user could create hundreds of servers, each with hundreds of channels, exhausting DB resources.

**Fix:** Define constants in `@uncorded/shared/constants` (e.g., `MAX_SERVERS_PER_USER: 100`, `MAX_CHANNELS_PER_SERVER: 500`) and enforce in route handlers.

### SEC-11: Channel position race condition [MEDIUM]

**File:** `apps/server/src/routes/channel.ts` L27-44

**Vulnerability:** Reads `max(position)` then inserts with `position + 1` without a transaction. Two concurrent channel creates could get the same position.

**Fix:** Wrap in `db.transaction()`.

---

## Logic Bugs

### LB-1: broadcastToDm DB fallback doesn't populate cache

**File:** `apps/server/src/ws/connections.ts` L121-143

**What:** When the DM channel cache misses, `broadcastToDm` falls back to a DB query to find DM members. But it doesn't populate the cache with the result. Every subsequent broadcast to the same uncached DM channel hits the DB again.

**Trigger:** Any DM channel that wasn't in the READY payload (e.g., created after IDENTIFY) will miss the cache on every broadcast.

### LB-2: Member list online status is snapshot, not live

**File:** `apps/web/src/stores/member-store.ts`

**What:** The member store fetches members with an `online` boolean set from `clients.has(m.userId)` at fetch time. The presence store updates friends and DM channels on `PRESENCE_UPDATE` but does NOT update the member store. The member list sidebar shows stale online/offline indicators.

**Trigger:** Any user going online/offline/idle after the member list is rendered.

### LB-3: Downloaded torrents never destroyed — connection leak

**File:** `apps/web/src/lib/torrent-client.ts` L132-166

**What:** `downloadFromMagnet` resolves the promise with the files but never calls `torrent.destroy()`. The torrent stays alive, maintaining WebSocket tracker connections and WebRTC peer connections indefinitely. Over a session with many downloads, this accumulates connections and memory.

**Trigger:** Every file download.

### LB-4: File preview cache grows unbounded

**File:** `apps/web/src/stores/file-store.ts` L49

**What:** `previews: Record<string, File[]>` stores downloaded file blobs in memory with no eviction. A user previewing many files accumulates hundreds of MB in memory.

**Trigger:** Previewing files over an extended session.

### LB-5: saveFile object URL revocation too aggressive

**File:** `apps/web/src/stores/file-store.ts` L213-220

**What:** `URL.revokeObjectURL(url)` fires after 1 second. For large files, the browser may not have started the download within that window, causing the download to fail silently.

**Fix:** Use a longer timeout (30s) or revoke in a `setTimeout` after `click()` with `requestAnimationFrame`.

### LB-6: Presence updates trigger full friend/DM list re-renders

**File:** `apps/web/src/lib/gateway-store.ts` L162-172

**What:** `updatePresence` uses `.map()` to create entirely new arrays for both `friends` and `dmChannels` on every single presence update. This triggers re-renders of every component depending on those arrays, even for entries unrelated to the updated user.

**Fix:** Use SolidJS `produce()` for targeted in-place mutation, or path-based store updates.

---

## Scalability Blockers

### SB-1: In-memory connection registry — single instance only

**What:** `connections.ts` `clients` Map lives in process memory.
**Breaks at:** 2 server instances. No workaround without Redis.
**Fix:** Redis-backed connection registry with instance ID, or Redis pub/sub for cross-instance message forwarding (the `publishCacheInvalidation` stubs exist but have no subscribers).

### SB-2: In-memory server membership maps — single instance only

**What:** `server-members.ts` `serverMembers` and `userServers` Maps.
**Breaks at:** 2 server instances. Broadcasts only reach members connected to the same instance.
**Fix:** Redis pub/sub subscriber that applies `add`/`remove` events to local maps. The publish side is already implemented.

### SB-3: In-memory presence timers — single instance only

**What:** `presence.ts` idle timers, DND flags, all in-memory.
**Breaks at:** 2 server instances. User connected to instance A won't have presence tracked by instance B.
**Fix:** Redis-backed presence with TTL-based idle detection.

### SB-4: In-memory channel cache — single instance only

**What:** `channel-cache.ts` caches channel→server mappings and DM memberships in memory.
**Breaks at:** 2 server instances. Channel created on instance A won't be in instance B's cache.
**Fix:** Redis hash or shared cache with pub/sub invalidation.

### SB-5: READY payload queries scale linearly with user data

**What:** IDENTIFY does 5-6 sequential DB queries.
**Breaks at:** ~500 concurrent reconnects (server restart). 3000+ queries in a burst against Neon.
**Fix:** `Promise.all` for independent queries. Redis-cached READY payloads with short TTL. Consider lazy-loading friends and DMs.

### SB-6: broadcastToServer iterates all members

**What:** `broadcastToServer()` iterates every member in the server's Set and sends individually.
**Breaks at:** Servers with 10,000+ members. A single message triggers 10,000 WS sends.
**Fix:** For large servers, use Redis pub/sub with per-server channels. Batch sends. Consider fan-out limits.

### SB-7: Gateway tickets in-memory with Redis fallback

**What:** `gateway.ts` stores tickets in a `Map<string, { userId, expiresAt }>` with Redis as fallback.
**Breaks at:** 2 server instances — ticket created on instance A can't be consumed on instance B (unless Redis fallback catches it). The Redis path works but adds latency.
**Fix:** Use Redis-only for tickets (remove in-memory primary).

---

## Code Quality Issues

### CQ-1: Branded type constructors are identity casts

The branded type system (`packages/protocol/src/branded.ts`) provides compile-time safety but zero runtime validation. Every constructor is just `return raw as BrandedType`. This means corrupted or malicious strings pass through the branding boundary without any checks. At minimum, constructors should validate non-empty strings.

### CQ-2: Inconsistent error response patterns

Most routes throw typed `AppError` subclasses caught by the global `.onError()` handler. But `turn.ts` uses `set.status = 503; return { code, message }` (ad-hoc), and `webhook.ts` uses `set.status = 400; return { error: "..." }` (different shape). These inconsistencies make client-side error handling harder.

### CQ-3: `or()` chain in friend queries instead of `inArray()`

**File:** `apps/server/src/routes/friend.ts` L450-459

Friends queries build `or(...peerIds.map(id => eq(user.id, id)))` chains. For 50+ friends, this generates a SQL query with 50+ OR clauses. `inArray(user.id, peerIds)` is semantically identical, cleaner, and lets the DB optimizer use an IN-list scan.

### CQ-4: `ensureDmChannel` duplicated between `friend.ts` and `dm.ts`

Both files have independent implementations of "find or create DM channel between two users." If one is updated, the other can drift. Should be extracted to a shared helper.

### CQ-5: Missing `.strip()` / `.strict()` on Zod schemas

All Zod schemas use default `z.object()` which passes through unknown keys silently. Extra fields in API requests leak into business logic. Using `.strict()` (reject) or `.strip()` (remove) would improve security.

### CQ-6: No input sanitization (whitespace, control characters)

No `.trim()` on usernames, server names, channel names, or message content. A username of `"  "` (spaces) passes `min(2)`. Zero-width characters and Unicode control characters pass through all schemas.

### CQ-7: Stale eslint-disable comments

The codebase migrated from ESLint to Oxlint but still has `eslint-disable` comments scattered through files. Oxlint doesn't read these — they're dead code.

### CQ-8: No HMR dispose in gateway.ts

**File:** `apps/web/src/lib/gateway.ts`

The most critical frontend module has no `import.meta.hot.dispose()` handler. During development, HMR creates duplicate WebSocket connections — the old connection stays alive with stale handlers. Dev-only issue but causes confusing double-message behavior.

---

## What I Would Restructure

### 1. Rate limiting architecture

Currently: global `elysia-rate-limit` with generic per-IP limits, plus ad-hoc per-endpoint IP rate limits on a few sensitive routes.

What I'd do: Three-tier rate limiting:

- **Global per-IP** (existing): 100 req/min, catches automated abuse
- **Per-user per-endpoint**: Redis-backed, configurable per route (5 msg/5s, 10 friend-req/min, etc.)
- **WS per-opcode** (existing, well-implemented): keep as-is

### 2. READY payload restructuring

Currently: one massive IDENTIFY handler that loads everything.

What I'd do: READY sends only user + servers + channels. Friends and DMs are lazy-loaded via separate WS opcodes (`REQUEST_FRIENDS`, `REQUEST_DMS`) or REST endpoints. This cuts IDENTIFY queries from 6 to 3 and makes reconnect faster.

### 3. Broadcast architecture for multi-instance

Currently: all broadcasts are in-memory, single-instance.

What I'd do: Complete the Redis pub/sub pattern that's already stubbed. Each server instance subscribes to channels for its connected users. Broadcasts go through Redis, which fans out to all instances. This is the standard pattern (Discord, Slack, etc.).

### 4. Channel cache invalidation

Currently: channel data fetched once, cached forever until reconnect.

What I'd do: Implement frontend handlers for ops 40-42 (CHANNEL_CREATE/UPDATE/DELETE). Server already sends these events — the frontend just ignores them.

### 5. Torrent lifecycle management

Currently: torrents created on seed/download, never destroyed.

What I'd do: Destroy download torrents after file is saved. Track seeding torrents in a managed registry with configurable limits (max 10 concurrent seeds in browser). Auto-destroy oldest seed when limit is hit.

---

## What Is Actually Good

### Gateway lifecycle — well-designed

The HELLO → IDENTIFY → READY → HEARTBEAT flow is clean. The ticket-based auth (replace session token with one-time ticket) is a smart security pattern that prevents token replay on WS. Heartbeat with bidirectional timeout (server 45s, client 10s ACK) is correct. The WeakMap-based WsContext avoids Elysia's wrapper recreation issue. The try/catch around the entire switch dispatch is good — prevents single handler errors from crashing the connection.

### In-memory dual-map for server membership — excellent

The `server-members.ts` dual-map (`serverId→Set<userId>` + `userId→Set<serverId>`) is O(1) for both broadcast lookups and disconnect cleanup. Clean, efficient, well-encapsulated. When Redis pub/sub is added, this pattern will work as a local cache.

### Typed error hierarchy — solid

The `AppError` base class with `_tag`, `statusCode`, `code`, and optional `cause` chaining is a good pattern. Every route uses it consistently (with minor exceptions). The global `.onError()` handler maps it cleanly.

### Permission helpers — clean

`requireMember()`, `requireOwner()`, `isMember()` are well-factored. The inverse-check pattern (`isMember` for "already a member" on invite accept) shows good API design.

### Channel resolution with cache — smart

The `resolveChannelMembership()` helper with its three-tier cache (server channel map → DM membership set → DB fallback) is well-designed and eliminates per-message DB queries on the hot path.

### Cursor-based message pagination — correct

The composite cursor with tiebreaking (`created_at DESC, id DESC`) is the right approach. Handles edge cases (first page, subsequent pages) properly. No off-by-one.

### Stripe integration — battle-tested

Webhook signature verification via `constructEventAsync()` (correct for Bun's SubtleCrypto), metadata on subscription objects (not session), and force-reconnect on tier change are all correct patterns. The `onParse` hook for raw body access is the right solution for Elysia.

### Design system and UI primitives — thoughtful

OKLCH color system with semantic tokens, compound Dialog with focus trap, Portal rendering for z-index escape, StatusDot component, virtual scrolling — these show attention to production quality.

---

## Priority Order

Top 10 issues ranked by production risk x effort to fix:

| Rank | Severity | Issue                                                                 | Effort | Why This Rank                                                        |
| ---- | -------- | --------------------------------------------------------------------- | ------ | -------------------------------------------------------------------- |
| 1    | CRITICAL | **SEC-1: MessagePack OOM DoS** — unbounded decode allows server crash | 30 min | Single malicious frame crashes the server. One line fix.             |
| 2    | CRITICAL | **SEC-2: No message rate limiting** — message spam floods channels    | 2 hrs  | #1 abuse vector in any chat app. Per-user per-endpoint middleware.   |
| 3    | HIGH     | **SEC-4: Password hash DoS** — unbounded password length              | 15 min | CPU exhaustion with a few requests. Add `.max(128)` to 2 schemas.    |
| 4    | HIGH     | **SEC-5: Empty messages accepted** — blank messages created           | 15 min | Violates data integrity. Add `.min(1)` or explicit null handling.    |
| 5    | HIGH     | **AC-2: Channel CRUD not handled on frontend** — stale channels       | 4 hrs  | Visible production bug. Users see wrong channels. Need WS handlers.  |
| 6    | HIGH     | **SEC-3: No friend request rate limiting** — harassment vector        | 1 hr   | Enables spam harassment. Add per-user rate limit.                    |
| 7    | MEDIUM   | **LB-3: Torrent connection leak** — memory/connection exhaustion      | 2 hrs  | Grows linearly with downloads. Destroy torrents after save.          |
| 8    | MEDIUM   | **AC-5: Webhook handlers not transactional** — split-brain tier state | 1 hr   | Stripe events fail silently on partial commit. Wrap in transactions. |
| 9    | MEDIUM   | **SEC-10: No resource creation limits** — DB exhaustion               | 2 hrs  | Single user can create unlimited servers/channels. Add cap checks.   |
| 10   | MEDIUM   | **AC-4: Server delete order reversed** — ghost servers                | 30 min | Broadcast before delete means UI desyncs on DB failure. Swap order.  |

---

_Review complete. Run `/process-deep-review` for the Chat Bot Agent to organize findings into action items._
