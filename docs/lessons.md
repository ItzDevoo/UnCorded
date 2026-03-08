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
