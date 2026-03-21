# UnCorded — Lessons Log

Running log of mistakes made and decisions taken during the build.
Updated by the coding agent at the end of every session.



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

**[W4 D1]** — WebTorrent depends on Node.js built-ins (`events`, `stream`, `buffer`, etc.) that Vite externalizes for browser compatibility. This causes "Class extends value undefined is not a constructor" errors that crash the entire app (white screen). Fix: install `vite-plugin-node-polyfills` and add `nodePolyfills()` to the Vite plugins array. This is the standard approach for any npm package that depends on Node.js built-ins in a Vite browser build.

**[W4 D1]** — MessagePack preserves JavaScript `Date` objects — unlike JSON, which stringifies them to ISO-8601 strings. When the server broadcasts Drizzle query results over WebSocket (MessagePack binary frames), `createdAt` and `editedAt` arrive as `Date` instances, not strings. Client-side Zod schemas with `z.string()` reject them ("expected string, received Date"). Fix: use `z.union([z.string(), z.date().transform(d => d.toISOString())])` to accept both formats and normalize to ISO strings. This applies to any date field in any WS event schema parsed on the client.

**[W4 D1]** — Dialog overlay with `fixed inset-0` + `backdrop-blur-sm` creates a stacking context that blocks pointer events on the dialog panel, even when both share the same z-index (`z-[--z-modal]`). The `backdrop-filter` CSS property triggers GPU compositing and creates a new stacking context that interferes with event delivery. Fix: make the overlay `pointer-events-none` (it's purely visual — blur + dark background). The wrapper div handles backdrop clicks via its own `onClick`, and the panel stops propagation. Remove redundant z-index from overlay and panel — only the wrapper needs `z-[--z-modal]`.

**[W4 D1]** — Dialogs rendered inline in the component tree get trapped inside parent stacking contexts (e.g., chat area with `overflow-auto` or `transform` creates a new stacking context). Even `fixed inset-0 z-[--z-modal]` can't escape a parent stacking context — CSS z-index only competes within the same stacking context. Fix: use SolidJS `<Portal mount={document.body}>` to render the dialog at the root of the DOM, above all app content. Also add `document.body.style.overflow = "hidden"` on mount and restore on cleanup to prevent background scrolling while the dialog is open.

**[Pre-W4 Cleanup]** — Validation constants (MAX_SDP_SIZE, MAX_FILE_NAME_LENGTH, etc.) and timing constants (TYPING_THROTTLE_MS, TYPING_TIMEOUT_MS) should live in `@uncorded/shared/constants`, not duplicated in server gateway.ts and client stores. Single source of truth prevents drift.

**[Pre-W4 Cleanup]** — Stale eslint-disable comments accumulate after migrating from ESLint to Oxlint. Remove them during cleanup passes — Oxlint doesn't read eslint directives.

**[Pre-W4 Cleanup]** — Server WS gateway should wrap the switch dispatch in try/catch to prevent a single handler error from crashing the connection. Send an ERROR frame to the client (if identified) and log server-side. Never close the connection on transient errors.

**[Pre-W4 Cleanup]** — When both a parent (ChatArea) and child (VirtualMessageList) component register the same `createEffect(on(channelId, fetchMessages))`, messages get fetched twice on channel switch. Keep the effect in the parent only.

**[W3.5 P4 Review]** — SolidJS JSX `&&` pattern can leak falsy values (e.g., `""`, `0`, `null`) to the DOM. Always use `<Show when={...}>` instead of `{value && <span>...</span>}`. React swallows falsy values; SolidJS does not.

**[W3.5 P4 Review]** — Icon-only buttons need both `title` (hover tooltip) AND `aria-label` (screen reader). Adding just `title` isn't sufficient for accessibility — screen readers don't reliably announce title attributes. Add `aria-label` matching the `title` on every icon button.

**[W3.5 P4 Review]** — ARIA dialog pattern needs both `aria-labelledby` (title) and `aria-describedby` (description). When using a compound Dialog component with context, generate IDs for both and pass them through context to DialogTitle and DialogDescription.

**[W3.5 P4 Review]** — HTML labels must be associated with inputs via `for`/`id` (SolidJS uses `for`, not `htmlFor`). Without this, clicking the label doesn't focus the input, and screen readers can't associate them. Use unique prefixes per page (e.g., `login-email`, `register-email`) to avoid ID collisions.

**[W3.5 P4 Review]** — Global event listeners (Escape key, scroll, resize) for dropdowns/menus should only be active while the dropdown is open. Use `createEffect` with `onCleanup` to conditionally add/remove listeners based on open state, rather than permanent `onMount`/`onCleanup` listeners. This prevents stale handlers from firing when the dropdown is closed.

**[W3.5 P4 Review]** — Dropdown position calculated once on open becomes stale if the user scrolls or resizes the viewport. Add scroll (with `capture: true` for nested scrollables) and resize listeners while the dropdown is open, recalculating position on each event.

**[W4 D2]** — CORRECTED W3 D3-4: WebTorrent 2.x removed callback-based `getBlob()` / `getBuffer()` / `getBlobURL()` methods. The new API uses async methods: `file.blob()` → `Promise<Blob>`, `file.arrayBuffer()` → `Promise<ArrayBuffer>`, `file.stream()` → `ReadableStream`. The stale `@types/webtorrent@0.110.x` still declares the old callback methods, masking the issue at compile time. Fix: add a module augmentation `.d.ts` file declaring the new methods on `TorrentFile`, which merges cleanly with the existing type definitions.

**[W4 D2]** — WebTorrent in the browser must disable DHT (`dht: false`) and LSD (`lsd: false`). DHT requires UDP via the `dgram` module which is impossible in browsers — Vite externalizes the `bittorrent-dht` import, causing runtime crashes. Browser peer discovery relies solely on WebSocket trackers.

**[W4 D2]** — WebTorrent's default tracker list includes servers with expired/invalid SSL certs (e.g., `wss://tracker.btorrent.xyz/`). Always pass explicit `announce` URLs to `seed()` and `add()`. Known-good WebSocket trackers: `wss://tracker.openwebtorrent.com` and `wss://tracker.webtorrent.dev` (official WebTorrent project trackers).

**[W4 D2]** — `vite-plugin-node-polyfills` with zero config polyfills all Node built-ins including broken stubs for `dgram`/`net`/`dns`. Use explicit `include: [...]` to only polyfill what WebTorrent actually needs: `buffer`, `events`, `stream`, `process`, `util`, `path`, `crypto`. This prevents Vite from pulling in broken stubs for network modules.

**[W4 D3]** — `broadcastToServer()` was querying the DB `members` table on every broadcast (message, typing, file events). Replaced with an in-memory `Map<serverId, Set<userId>>` registry (`server-members.ts`) for O(1) lookups. A reverse index `Map<userId, Set<serverId>>` enables O(1) cleanup on disconnect — avoids iterating all servers. Single-instance only; multi-instance would need Redis pub/sub.

**[W4 D3]** — SERVER_CREATE/SERVER_DELETE/MEMBER_ADD/MEMBER_REMOVE WS events coexist with HTTP responses. The HTTP response returns data to the requester; the WS event notifies other connected clients. Both are necessary — the REST caller already has the data in the response, but other tabs/users need real-time sync.

**[W4 D4]** — CORRECTED: Elysia consumes the request body stream during its parse phase, making `request.text()` fail with "Body already used" and `request.clone().text()` also fail. Neither `parse: "text"` nor `parse: () => {}` reliably preserves the raw body for Stripe signature verification. The working pattern: use an `onParse` lifecycle hook (`{ as: "local" }`) to intercept the raw body via `request.text()` before Elysia's default parser runs, then access it as `body` (a string) in the handler. This is the only approach that works in Elysia for webhook signature verification.

**[W4 D4]** — Webhook routes must be mounted BEFORE rate limiting middleware. Stripe retries on 429, and excessive retries can cause webhook delivery to be disabled. Mount order: `cors → auth → webhookRoutes → rateLimit → stripeRoutes → userRoutes → ...`.

**[W4 D4]** — Tier updates flow only through webhooks, never from the checkout route. The checkout route creates a Stripe Checkout Session and returns the URL — the actual subscription creation happens asynchronously via Stripe's `checkout.session.completed` webhook event. This prevents race conditions where the user's tier is set before payment is confirmed.

**[W4 D4]** — Stripe customer creation happens on first checkout, not on user registration. The `stripeCustomerId` is persisted in the subscriptions table via the `checkout.session.completed` webhook. Subsequent checkouts reuse the existing customer ID.

**[W4 D4]** — Stripe SDK v20+ moved `current_period_end` from `Subscription` to `SubscriptionItem`. Access via `sub.items.data[0]?.current_period_end` instead of `sub.current_period_end`. The `subscriptions.retrieve()` return type is `Response<Subscription>` which auto-unwraps.

**[W4 D4]** — Stripe SDK v20+ uses `SubtleCrypto` (Web Crypto API) instead of Node's `crypto` module. In Bun's runtime, `stripe.webhooks.constructEvent()` fails with "SubtleCryptoProvider cannot be used in a synchronous context". Fix: use `await stripe.webhooks.constructEventAsync()` instead. This is async because `SubtleCrypto.verify()` returns a Promise.

**[W4 D4]** — `subscription_data.metadata` in `stripe.checkout.sessions.create()` puts the metadata on the **Subscription** object, NOT the Checkout Session. Reading `session.metadata?.userId` in the `checkout.session.completed` webhook returns undefined — the session's own metadata is empty. Fix: retrieve the full subscription via `stripe.subscriptions.retrieve(subId)` and read `sub.metadata`.

**[W4 D4]** — In dev, `APP_URL` points to the backend (`localhost:3000`) but the frontend runs on `localhost:5173`. Stripe checkout `success_url`/`cancel_url` must point to the frontend. Use `CORS_ORIGIN ?? APP_URL` for redirect URLs — `CORS_ORIGIN` is the frontend origin in dev, and in production both will be the same domain.

**[W4 D4]** — `vite-plugin-node-polyfills` include list must cover ALL Node built-ins that WebTorrent references. Missing `fs` and `os` causes "Cannot access fs.statSync/os.tmpdir in client code" warnings. Add them to the include array even though they're shimmed as no-ops.

---

**[W4 D4]** — Heartbeat watchdog must capture socket ref at assignment time to prevent stale timeouts from closing new connections after reconnect.

**[W4 D4]** — Drizzle 0.45+ supports `.for("update")` for row-level locking in transactions. Use this for any read-then-write pattern that needs atomicity.

**[W4 D4]** — Upstash Redis supports `getdel` (Redis 6.2+) — use for atomic consume-and-delete patterns instead of separate get+del calls.

**[W4 D4]** — NotFoundError class auto-appends " not found" to the resource name — don't pass full messages like "User not found", just pass "User".

**[W4 D4]** — solid-markdown is CJS-broken in Vite. Use `marked` with manual Lexer→SolidJS token rendering. Never use innerHTML for rendered markdown.

**[W4 D4]** — env.ts `optionalString` requires the key to exist in .env (even if empty) — Zod `.string()` rejects `undefined`. Use `.optional()` or transform pattern.

**[W4 D4]** — Any CodeRabbit finding we skip in PR review MUST be filed as a GitHub Issue for future tracking.

**[W4 D4]** — WebTorrent tracker warnings (wss://tracker.webtorrent.dev/) and "net" module externalization are benign browser warnings — not bugs. Don't chase them.

**[W4 D1]** — App-store auto-select effects (e.g., selecting first server on load) can fight user intent. Use flags to gate first-time-only selection so user-initiated selections aren't overridden.

**[W4 D1]** — Message toolbar must render inside message bounds (not above) to avoid scroll container clipping issues with overflow-auto parents.

**[W4 D3]** — FK onDelete policies should be explicit even when PostgreSQL defaults match intent. Makes schema self-documenting and prevents surprises during migrations.

**[W4 D5]** — DM cache backfill: when restructuring a DB fallback to also populate the cache, query ALL members (no exclude filter) and apply exclusion at send time. The cache must store the full member set, not a filtered view — otherwise the next caller with a different excludeUserId gets a stale/incomplete set.

**[W4 D5]** — `showToast()` only accepts `"info"` and `"error"` variants, not `"success"`. Use `"info"` for positive feedback.

**[W4 D5]** — Zod `.refine()` on an object schema validates cross-field constraints (e.g., "exactly one of A or B"). The arithmetic trick `(a ? 1 : 0) + (b ? 1 : 0) === 1` is cleaner than nested ternaries for "exactly one" checks.

**[W4 D6]** — `drizzle-kit generate` is interactive (prompts for enum create/rename choices) and cannot run headlessly in CLI. For simple enum additions like `ALTER TYPE ... ADD VALUE`, write the migration SQL manually and update `_journal.json`.

**[W4 D6]** — Age gate DOB field: FTC's Feb 2026 policy statement allows client-side-only DOB checks — don't send DOB to the server. Calculate age in the browser, gate registration, discard the value.

**[W4 D6]** — P2P IP disclosure dialog uses a Promise-based pattern: `shareFile()` creates a promise, the dialog resolves/rejects it. Module-level `let resolve/reject` refs avoid coupling the store to the component.

**[W4 D6]** — CSAM hash safety check in `shareFile()`: if the safety service is unreachable, allow the share to proceed (non-blocking). Only block if the API explicitly returns `blocked: true`. This prevents a broken safety endpoint from disabling all file sharing.

---

## Known Issues

All known issues are now tracked on GitHub Issues: https://github.com/ItzDevoo/UnCorded/issues

Previously resolved issues from this section (deep review batches):

- ~~broadcastToDm DB on every call~~ → cached in-memory (deep review tier 1)
- ~~Username DB lookup on TYPING_START~~ → cached in WsContext (deep review tier 1)
- ~~Server creation not transactional~~ → wrapped in db.transaction() (deep review tier 1)
- ~~Missing invoice.payment_failed~~ → handler added (deep review tier 1)
- ~~resolveChannelMembership hot path~~ → in-memory channel cache (deep review tier 1)
- ~~innerJoin drops deleted authors~~ → leftJoin (deep review tier 2)
- ~~or() chain → inArray()~~ → partially fixed (deep review tier 2) — still present in friend.ts GET /friends and GET /friends/pending
- ~~WS rate limiting~~ → per-user per-opcode token bucket (deep review tier 1)
- ~~Multi-insert transactions~~ → wrapped (deep review tier 1)
- ~~Cache user profile in WsContext~~ → username cached (deep review tier 1)

**[Deep Review 2 — 2026-03-14]** — Second full architectural review. Key new findings: (1) MessagePack decode has no size limits — OOM DoS vector, (2) REST API has no per-user rate limits on message creation or friend requests, (3) password schema fields have no max length — hash DoS, (4) frontend ignores CHANNEL_CREATE/UPDATE/DELETE WS events, (5) download torrents never destroyed — memory leak. Full findings in docs/deep-review.md.
