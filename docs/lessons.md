# UnCorded — Lessons Log

Running log of mistakes made and decisions taken during the build.
Updated by the coding agent at the end of every session.

Reference: C:\Nexis\docs\lessons.md for patterns learned during Nexis build.

## Format

**[Week X Day Y]** — What went wrong or what was decided and why.

---

**[W1 D3-4]** — drizzle-kit runs in CJS/Node mode and cannot resolve `.js` extension imports from ESM workspace packages. Importing `createId()` from `@uncorded/shared` in schema.ts causes `MODULE_NOT_FOUND`. Fix: import `nanoid` directly in schema.ts (same pattern Nexis uses). The schema file is read by drizzle-kit at generation time, not just by Bun at runtime.

**[W1 D3-4]** — CORRECTED in D5-7: Better Auth's `.mount(auth.handler)` does NOT actually catch all routes — the 404 issue was caused by stale bun.exe processes on Windows. The `.mount()` approach is correct and necessary because `.all('/api/auth/*', handler)` causes Elysia to pre-parse the request body, leading to "Body already used" errors when Better Auth tries to read POST bodies (registration, login). Always use `.mount(auth.handler)` for Better Auth in Elysia.

**[W1 D3-4]** — Elysia macros with `.use()` across separate Elysia instances don't propagate resolved context types through TypeScript. Using `.macro({ auth: { resolve: ... } })` in a plugin and then `.use(plugin)` in routes causes `Property 'user' does not exist on type`. Fix: use inline `.resolve()` on the route chain instead of macros. Export a `getSession()` helper function and call it from the resolve.

**[W1 D3-4]** — Zod `.optional()` with `.url()` still validates when the value is an empty string `""` (present in process.env). Fix: use `.transform(s => s === '' ? undefined : s).pipe(z.string().url().optional())` to coerce empty strings to undefined before validation.

**[W1 D3-4]** — On Windows with Bun, background `&` processes from bash testing don't always get killed by `kill %1`. Multiple stale bun.exe processes can accumulate on the same port, causing confusing test results (old server responds instead of new one). Fix: use `taskkill //F //IM bun.exe` to clean up all bun processes between test runs. This was the root cause of the `.mount()` vs `.all()` confusion — stale processes were responding to requests.

**[W1 D5-7]** — Tailwind v4 uses CSS-based config with `@import "tailwindcss"` and `@theme` block, NOT a `tailwind.config.js` file. Use `@tailwindcss/vite` plugin instead of PostCSS.

**[W1 D5-7]** — SolidJS components must not use early returns for conditional rendering — the `solid/components-return-once` lint rule catches this. Use `<Show>` with `when` and `fallback` instead of `if/return` patterns.

**[W1 D5-7]** — Better Auth's `better-auth/solid` package provides `createAuthClient` with SolidJS-specific `useSession()` hook. This returns a reactive accessor `session()` with `{ isPending, data, error }` — no need to build a custom auth store from scratch.

**[W2 D1-2]** — Elysia `.use(authGuard)` with a separate Elysia plugin that has `.resolve()` does NOT propagate the resolved context types (e.g. `user`) to route handlers in the consuming instance. The `user` property is invisible to TypeScript. Fix: inline `.resolve()` directly on each Elysia instance chain, same as the W1 D3-4 macro lesson. This applies to any Elysia plugin that uses `.resolve()` — types don't cross `.use()` boundaries.

**[W2 D1-2]** — Elysia route parameter names must be consistent across all routes that share the same URL segment position. `/api/servers/:id` conflicts with `/api/servers/:serverId/channels` because `:id` and `:serverId` occupy the same slot. Always use `:serverId` for server routes since child routes (channels, members, invites) need it.

**[W2 D2-3]** — Elysia's `ws.raw` is typed as `ServerWebSocket<{id?, validator?}>` from `elysia/ws/bun`, which is NOT assignable to Bun's `ServerWebSocket<unknown>` due to conflicting `BufferSource` re-exports between Elysia and Bun globals. Fix: use a structural type `{ send(data: string | Buffer): number }` instead of importing `ServerWebSocket` from either package. Note: return type must be `number` not `number | void` — the `@typescript-eslint/no-invalid-void-type` rule disallows `void` in union types, and Bun's `send` returns `number` anyway.

**[W2 D4-5]** — Drizzle's `or()` returns `SQL | undefined` (undefined when called with 0 args). Even when always passing 2+ args, the `!` non-null assertion triggers `@typescript-eslint/no-non-null-assertion`. Fix: assign to a variable and guard with `if (cursorCondition) conditions.push(cursorCondition)` instead of `conditions.push(or(...)!)`.

**[W2 D2-3]** — Elysia recreates the `ws` wrapper object on every event callback (open, message, close), so mutable state stored on it is lost. Use a `WeakMap<object, WsContext>` keyed on `ws.raw` (the stable Bun `ServerWebSocket` instance) to persist per-connection state like `userId` and `heartbeatTimeout`.

**[W2 D2-3]** — ESLint `@typescript-eslint/no-non-null-assertion` fires on closure-captured `let` variables even when they're guaranteed non-null by the surrounding scope. In `onGatewayEvent`, the `set` variable was assigned before the closure but TypeScript narrows it as possibly-null inside the closure. Fix: don't use `!` assertion — restructure so the variable is `const` or re-check inside the closure.

**[W2 D6-7]** — SolidJS `solid/reactivity` lint rule: passing `props.onClose` directly as an `onClick` handler on a native element triggers a warning because native event bindings aren't reactive. Fix: wrap in arrow function `() => props.onClose()`. This only applies to native elements (button, div) — component props are fine.

**[W2 D6-7]** — SolidJS `solid/prefer-for` lint rule: `Array#map()` in JSX recreates DOM elements on every update. Always use `<For each={...}>` for rendering lists, even small static-ish ones like storage policy badges.

**[W2 D6-7]** — JSX `src` attribute accepts `string | undefined` but not `string | null`. When a value is `string | null`, TypeScript narrowing via truthiness check doesn't help inside ternary JSX expressions. Fix: use `value ?? undefined` to convert null to undefined.

**[W2 PIVOT]** — Architectural pivot from server-side ephemeral file storage (R2 + TTL + cron) to P2P file sharing via WebTorrent (BitTorrent over WebRTC). Motivation: eliminates server storage costs, stronger privacy story ("files never touch our servers"), pricing tied to real infrastructure costs (TURN relay) instead of artificial limits. Timing was ideal — Week 2 complete (chat/messaging/servers all carry forward), Week 3 (file system) hadn't started. Old architecture preserved on GitHub at commit 4ca9500.

**[W2 PIVOT]** — Pricing model changed from a-la-carte items ($0.50 avatar, $1.00 extended expiry) to subscription tiers (Free web-only / $5 Supporter / $10+ Server Owner). Key monetization lever: TURN relay restricted to paid users. Free users get P2P-only — ~80-85% success rate, with clear messaging when NAT blocks them. Server Owner pricing scales with free-user traffic (TURN + signaling load).

**[W2 PIVOT]** — CSAM compliance in P2P model: client-side perceptual hashing (PhotoDNA/PDQ) before any file enters the torrent. This runs in the desktop app (Tauri) before sharing. For web-only DM sharing, hash checking happens in-browser before torrent creation. Register with NCMEC CyberTipline (free) and DMCA agent ($6).

**[W2 D4-5]** — SolidJS `solid/reactivity` lint rule: `onGatewayEvent` callbacks that call store mutation functions (e.g. `addMessage`) trigger the warning because the linter sees reactive store access inside a non-tracked scope. These are event handlers, not reactive computations — suppress with `/* eslint-disable solid/reactivity -- event handlers */`.

**[W2 D4-5]** — Module-level side effects (setInterval, event listeners) accumulate on Vite HMR reloads. Fix: store return values (interval IDs, unsubscribe functions) and clean them up in `import.meta.hot.dispose()`. Pattern:

```
const intervalId = setInterval(...);
const unsub = onGatewayEvent(...);
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    clearInterval(intervalId);
    unsub();
  });
}
```

This applies to any module that registers global listeners or timers at the top level.

**[W2 D4-5]** — Solid `produce()` on a store path that doesn't exist yet gets `undefined` as the draft. The `if (!ch) return` guard inside produce silently does nothing, and the fallback code after may race with it. Fix: check existence before calling produce and initialize first if missing. Cleaner than a two-phase produce-then-check pattern.

**[W2 D1-2]** — CORRECTED: The `as never` pattern (`set.status = 401; return { code, message } as never`) does NOT short-circuit Elysia's resolve at runtime. Elysia merges the returned object into context, replacing user/session with undefined, crashing all downstream handlers. The correct pattern is `return status(401, { code, message })` using the `status` function from resolve context. This both short-circuits AND sends a JSON body. The original `return status(401)` worked for short-circuiting but sent an empty body — adding the second argument fixes both issues.

**[W2.5 D1]** — `drizzle-kit generate` uses a TUI with interactive prompts (arrow keys, Enter) for rename/create/drop decisions during schema migrations. This cannot be automated via piped input on Windows. Workaround: write the migration SQL manually and update `drizzle/meta/_journal.json` by hand, then run `db:migrate`. The SQL migration file with `statement-breakpoint` comments works correctly with drizzle-orm's migrator.

**[W2.5 D1]** — Oxlint warns on SolidJS `let ref!: HTMLElement` declarations as "no-unassigned-vars" because it doesn't know about SolidJS's `ref={el => ref = el}` JSX pattern. Fix: suppress with `// oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern`.

**[W2.5 D1]** — Oxfmt changes single quotes to double quotes by default (different from Prettier's `singleQuote: true`). This is fine — the entire codebase was reformatted in one pass. No need to configure around it.

**[W2.5 D1]** — Oxlint's `unicorn/no-array-sort` and `unicorn/no-array-reverse` prefer non-mutating alternatives: use `.toSorted()` and `.toReversed()` instead of `.sort()` and `.reverse()`. These are ES2023 methods, safe with our `target: ES2023` tsconfig.

**[W2.5 D2]** — `exactOptionalPropertyTypes` means `{ x?: string }` does NOT accept explicit `undefined` assignment. Patterns like `foo({ maxUses: maybeUndefined })` break — instead build the object conditionally: `const opts = {}; if (val !== undefined) opts.maxUses = val;`.

**[W2.5 D2]** — When importing branded type constructor functions (e.g., `userId()` from protocol), watch for name collisions with local variables. In handlers.ts, `const userId = sessionRow.userId` shadowed the imported `userId()` function. Rename the local variable (e.g., `identifiedUserId`) to avoid the shadow.

**[W2.5 D2]** — Oxlint's `oxc/no-map-spread` warns against `arr.map(x => ({ ...x, id: brand(x.id) }))` because spread in map creates unnecessary allocations. Use `Object.assign(x, { id: brand(x.id) })` instead — mutates in-place, which is fine for data from DB queries that aren't reused.

**[W2.5 D3]** — Elysia's `.onError()` DOES catch errors thrown from route handler bodies. The pattern `throw new AppError(...)` in route handlers is caught by the global `.onError()` and converted to `{ code, message }` with the correct status code. This means routes no longer need `set` for error responses — just throw. However, `.resolve()` blocks must still use `return status(401, ...)` because throwing inside resolve doesn't short-circuit the same way.

**[W2.5 D3]** — When refactoring permission helpers from `requireMember(userId, serverId, set)` (returns null + mutates set) to `requireMember(userId, serverId)` (throws), the invite accept route needs special handling. It used requireMember inversely — checked if user IS already a member, then returned 409. After refactoring, use a separate non-throwing `isMember()` helper for this inverse check pattern.

**[W2.5 D3]** — Branded type signals in SolidJS: `createSignal<ServerId | null>(null)` requires all callers to pass branded types. Raw strings from API responses must be branded at the call site — e.g., `setSelectedServerId(serverId(data.server.id))`, not `setSelectedServerId(data.server.id)`. This caught two bugs in CreateServerModal and JoinServerModal where raw strings were being passed.

**[W2.5 D4]** — SolidJS store `Record<string, T>` paths require plain strings, not branded types. When using branded IDs as store keys, cast to `string` at the store boundary: `const key = channelId as string`. Keep branded types in function signatures for type safety, but store internals use strings.

**[W2.5 D4]** — Zod validation at WS event boundaries catches malformed payloads early and prevents branded type contamination. Pattern: `safeParse(data)` → on failure `console.warn` + early return → on success brand the validated strings via constructor functions. This moves the branding to the parse boundary rather than trusting `data as T` casts.

**[W2.5 D4]** — `bun add zod` in a workspace package installs the latest (v4), but if `@uncorded/shared` depends on `zod@^3`, you get version conflicts. Always pin to the same major: `bun add zod@3`.

**[W2.5 D4]** — Railway-style brand-tinted dark palettes: use OKLCH for perceptually uniform color mixing. Keep brand hue consistent across all background/border/muted tokens at low chroma (0.008–0.02), full chroma only for primary/ring/success. Shadows stay neutral — tinted shadows look artificial.

**[W2.5 D5]** — Focus trap in SolidJS dialogs: use `onMount` to auto-focus first focusable element, `onKeyDown` with Tab/Shift+Tab to cycle between first and last focusable elements. The `FOCUSABLE_SELECTOR` should include `a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])`. Guard against empty focusable lists.

**[W2.5 D5]** — Z-index in Tailwind v4: `@theme inline` naming for z-index is uncertain (`--z-index-modal` could become `z-index-modal` or `z-modal`). Safer approach: define CSS custom properties in `:root` (e.g., `--z-modal: 50`) and reference them via `z-[--z-modal]` arbitrary value syntax, which is guaranteed to work.

**[W2.5 D5]** — When migrating from a custom Modal wrapper to a compound Dialog component, keep `open={true}` on Dialog since the parent component controls visibility (only renders the modal when needed). Use `onOpenChange={() => props.onClose()}` for backdrop click and Escape key dismiss.

**[W2.5 D5]** — TypeScript index signatures can't use branded types. `Record<ChannelId, number>` won't work because branded types aren't valid index types. Use `Record<string, number>` with a documenting comment instead.

**[W3 D1-2]** — When adding multiple switch cases in gateway.ts that all do membership checks, use unique variable prefixes (e.g., `sigCh`, `fsCh`, `faCh`) to avoid redeclaration errors within the same switch scope. Each case block shares the function scope for `const`/`let` declarations.

**[W3 D1-2]** — On Windows, `netstat -ano | findstr :<port>` output includes LISTENING/ESTABLISHED/TIME_WAIT rows. Only parse LISTENING rows to find the process that owns the port. The PID is always the last whitespace-separated token.

**[W3 D1-2]** — After killing a process on a port, add a brief delay (~500ms) before rechecking port availability. The OS needs time to release the socket, especially on Windows where TIME_WAIT can linger.

**[W3 D3-4]** — WebTorrent's constructor does NOT accept `rtcConfig` directly. STUN/TURN config must be set via `@thaunknown/simple-peer`'s static `Peer.config` property before creating the WebTorrent instance. This is because WebTorrent creates simple-peer instances internally for all WebRTC connections.

**[W3 D3-4]** — WebTorrent's `TorrentFile.getBlob()` is callback-based, not Promise-based: `file.getBlob((err, blob) => ...)`. Wrap in a Promise for async/await usage. Same applies to `getBuffer()` and `getBlobURL()`.

**[W3 D3-4]** — When splitting a shared payload type into request/broadcast variants (e.g., `FileSharePayload` → `FileShareRequest` + `FileShareBroadcast`), the request type contains what the client sends (no server-generated fields), and the broadcast type adds server-enriched fields (senderId, fileReceiptId). The server gateway handler bridges the two by inserting the DB record and adding the extra fields before broadcasting.

**[W3 D3-4]** — WebRTC signaling handlers should validate target user membership, not just sender membership. Without this check, any authenticated user in a server could send signaling frames to users who aren't members of the same server, which is a security gap.

**[W3 D5-6]** — `decode()` in the protocol codec should validate the shape of the decoded MessagePack data (must have `op` as number and `d` field). Without this, any malformed binary frame would be silently cast to `GatewayFrame`, potentially causing downstream crashes. Throw on invalid shape since callers already wrap in try/catch.

**[W3 D5-6]** — Zod schemas for WS payloads should have bounds (`.min(1)`, `.max(255)`, `.positive()`, `.startsWith("magnet:")`) to prevent empty strings and oversized payloads from being accepted. Defense in depth — even though the client constructs valid payloads, the server should enforce constraints.

**[W3 D5-6]** — Elysia's `ws.message(ws, raw)` callback receives `raw` that may be `Uint8Array` or `ArrayBuffer` depending on the runtime path. Using `raw as Uint8Array` directly can fail. Safe pattern: `raw instanceof Uint8Array ? raw : new Uint8Array(raw as ArrayBuffer)`.

**[W3 D5-6]** — Browser `MessageEvent.data` should be checked with `instanceof ArrayBuffer` before casting, even when `ws.binaryType = "arraybuffer"` is set. Text frames or edge cases could produce non-ArrayBuffer data.

**[W3 D5-6]** — SolidJS drag-and-drop: use a `dragCounter` (increment on dragenter, decrement on dragleave) instead of a simple boolean to handle nested child elements that fire their own drag events. Without this, the overlay flickers as the cursor moves over child elements.

**[W3 D5-6]** — `downloadFile()` in file-store should return `File[]` (not `void`) so callers can use the downloaded files for thumbnail generation or other processing. Re-throw errors after updating store state so callers can handle them too.

**[W3 D7]** — When both seed and download use WebTorrent, attach a client-level error handler BEFORE calling `c.seed()` or `c.add()`, then remove it after the torrent-specific handler is attached. This prevents seed errors from being silently swallowed when the callback hasn't fired yet (race condition between error and success).

**[W3 D7]** — `z.unknown()` in server-side Zod schemas is an unbounded security hole. WebRTC signaling data should be bounded: SDP strings ≤16KB (typical SDP is ~2KB), ICE candidates as `z.record(z.string(), z.unknown())`. Always bound string fields with `.max()`.

**[W3 D7]** — When implementing DM message support alongside server channel messages, use a `resolveChannel()` function that tries server channels first, then DM channels. This avoids duplicating auth/membership checks across every route handler. Use a discriminated union return type (`{ type: "server"; serverId } | { type: "dm" }`) to branch on broadcast behavior.

**[W3 D7]** — Drizzle intersection query for "find DM where both users are members": use a subquery to find all channelIds for user A, then query dm_members where userId=B AND channelId IN (subquery). This avoids a self-join and is simpler to read.

**[W3 D7]** — Console output in production: gate ALL `console.warn` and `console.error` calls in client-side code behind `if (import.meta.env.DEV)`. Server-side console.error stays (useful for production monitoring). This prevents information leakage in production browser consoles.

**[W3 D7]** — Zod `.default([])` on optional array fields in READY schema provides backwards compatibility during development. Old server versions that don't send `dmChannels` or `friends` will parse successfully with empty arrays instead of failing validation.

**[W3 Post-Review]** — When importing branded type constructor functions that share names with function parameters (e.g., `channelId` function vs `channelId: ChannelId` parameter), use aliased imports (`import { channelId as toChannelId }`) to avoid Oxlint's no-shadow warnings.

**[W3 Post-Review]** — Constants shared between server and client (like MAX_FILE_SIZE_BYTES) belong in `packages/shared/src/constants.ts`, not duplicated in both codebases. Create a constants barrel file and export from the shared package index.

**[W3 Post-Review]** — When a server READY payload omits a field that the client needs (e.g., subscriptionTier), the client must cast to access it, which always returns undefined. Fix both ends: add the field to the server select AND the client ReadyUser interface + Zod schema simultaneously.

**[Pre-W4 Review]** — Elysia route params (e.g., `:userId`) arrive as raw strings with no validation. Always add Zod validation at the top of handlers that use params — even though Elysia's router won't match empty segments, edge cases (URL encoding, proxies) can produce unexpected values. Pattern: `const parsedParams = schema.safeParse(params); if (!parsedParams.success) throw new ValidationError(...)`.

**[Pre-W4 Review]** — When a review flags "route params not validated" on a file that has no route params (like dm.ts), verify the code first. Body validation via Zod schemas counts as validation. Don't add unnecessary changes for false positives.

**[Pre-W4 Review]** — Branded types (e.g., `UserId`) are subtypes of their base type (`string`) and can be passed to parameters typed as `string` without casting. The `as string` pattern on branded values is unnecessary and defeats the purpose of branding. Only cast at store boundaries where string keys are required.

**[Pre-W4 Review]** — For inline type literals on local variables (like `let readyDmChannels: { id: string; ... }[]`), use `ReturnType<typeof brandFn>` to reference branded types without importing the type separately. This keeps the type aligned with the branding function.
