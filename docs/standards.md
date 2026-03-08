# UnCorded — Project Standards

Enforced conventions for monorepo structure, tooling, quality gates, and development workflow.
Reference: C:\t3Code for proven patterns. Adapt to our stack (SolidJS, Electron, ElysiaJS).

---

## Monorepo Structure

```
C:\UnCorded\Project\
├── apps/
│   ├── web/              # SolidJS + Vite frontend (web-only features)
│   ├── server/           # ElysiaJS backend (WS gateway, REST API)
│   └── desktop/          # Electron desktop app (wraps web, adds native features)
├── packages/
│   ├── shared/           # Runtime utilities, createId, validation helpers
│   │                     # Explicit subpath exports: @uncorded/shared/id, @uncorded/shared/validation
│   └── protocol/         # WS opcodes, MessagePack codec, frame types, branded ID types
│                         # Schema-only where possible, minimal runtime
├── scripts/
│   └── dev-runner.ts     # Single-command dev orchestrator (all apps + TUI process viewer)
├── .plans/               # Architectural refactor roadmaps (numbered: 01-*.md, 02-*.md)
├── turbo.json            # Task orchestration
├── tsconfig.base.json    # Shared TypeScript config
├── .oxlintrc.json        # Linter config
├── .oxfmtrc.json         # Formatter config
└── package.json          # Bun workspaces + root scripts
```

### Package Roles (Strict)

| Package | Purpose | Rules |
|---------|---------|-------|
| `@uncorded/shared` | Runtime utilities | Explicit subpath exports only. No star exports. |
| `@uncorded/protocol` | WS protocol definitions | Types + codec. Minimal runtime code. |
| `apps/web` | SolidJS frontend | No Node.js APIs. Must work in browser. |
| `apps/server` | ElysiaJS backend | All DB access, auth, WS gateway. |
| `apps/desktop` | Electron wrapper | Native features only. Embeds server + loads web app. |

---

## Tooling

### Package Manager
- **Bun** — required everywhere. Never use node, npm, or yarn.
- Pin Bun version in `package.json` engines field.

### Linter: Oxlint (not ESLint)
- Config: `.oxlintrc.json` at monorepo root
- Plugins: eslint, oxc, typescript, unicorn
- Ignores: dist, node_modules, bun.lock, *.tsbuildinfo
- Run: `bun run lint`

Why oxlint: 50-100x faster than ESLint. No plugin compatibility issues. Single binary.

### Formatter: Oxfmt (not Prettier)
- Config: `.oxfmtrc.json` at monorepo root
- Ignores: dist, node_modules, bun.lock, *.tsbuildinfo
- Run: `bun run fmt`

### Build Orchestration: Turborepo
- Config: `turbo.json` at monorepo root
- Task dependency graph:

```json
{
  "build": { "dependsOn": ["^build"], "outputs": ["dist/**"] },
  "dev": { "dependsOn": ["@uncorded/protocol#build"], "cache": false, "persistent": true },
  "typecheck": { "dependsOn": ["^typecheck"], "cache": false },
  "test": { "dependsOn": ["^build"], "cache": false }
}
```

Key: `dev` depends on `protocol#build` because runtime code imports compiled protocol types.

---

## Branded Types (Type Safety)

Prevent accidental ID confusion across the codebase. A `ServerId` should never be passed where a `ChannelId` is expected.

### Definition (in `@uncorded/protocol`)
```typescript
// Branded type factory
type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type ServerId = Brand<string, "ServerId">;
export type ChannelId = Brand<string, "ChannelId">;
export type MessageId = Brand<string, "MessageId">;
export type InviteCode = Brand<string, "InviteCode">;
export type FileReceiptId = Brand<string, "FileReceiptId">;
export type DmChannelId = Brand<string, "DmChannelId">;

// Constructor (validates + brands)
export function createUserId(id: string): UserId { return id as UserId; }
// ... same pattern for each type
```

### Rules
- All IDs in function signatures, route params, WS payloads, and store types use branded types
- Raw `string` for IDs is banned in any public interface
- `createId()` from `@uncorded/shared` returns the appropriate branded type
- Drizzle schema stays as `text()` — branding happens at the application boundary

Reference: t3Code's `packages/contracts/src/baseSchemas.ts` for pattern.

---

## Typed Error Hierarchy

Every error is a tagged class with context. No raw `throw new Error("something broke")`.

### Pattern
```typescript
// Base error with tag discrimination
export class UnCordedError extends Error {
  readonly _tag: string;
  constructor(tag: string, message: string, options?: { cause?: unknown }) {
    super(message, options);
    this._tag = tag;
  }
}

// Specific errors
export class AuthError extends UnCordedError {
  constructor(
    public readonly operation: string,
    public readonly detail: string,
    options?: { cause?: unknown }
  ) {
    super("AuthError", `${operation}: ${detail}`, options);
  }
}

export class GatewayError extends UnCordedError { ... }
export class ValidationError extends UnCordedError { ... }
export class PermissionError extends UnCordedError { ... }
export class NotFoundError extends UnCordedError { ... }
```

### Error Composition
```typescript
// Union types for error boundaries
type ChannelOperationError = PermissionError | NotFoundError | ValidationError;
type FileShareError = GatewayError | PermissionError | WebRTCError;
```

### Rules
- Every thrown error includes: operation name, detail message, and optional cause chain
- Route handlers catch typed errors and map to HTTP status codes
- WS handlers catch typed errors and send appropriate close codes
- Never catch `unknown` and silently swallow — always log or re-throw

Reference: t3Code's tagged error classes with operation context.

---

## `.plans/` Directory

Track architectural evolution formally. Each plan is a numbered markdown file.

### Format
```
.plans/
├── 01-tooling-migration.md      # ESLint→Oxlint, Prettier→Oxfmt
├── 02-branded-types.md          # Add branded IDs across codebase
├── 03-typed-errors.md           # Replace raw Error throws
├── 04-dev-runner-tui.md         # Single-command dev orchestrator
└── ...
```

### Plan Template
```markdown
# Plan XX: Title

## Motivation
Why this change matters.

## Scope
What files/packages are affected.

## Steps
1. Step one
2. Step two
...

## Risks
What could go wrong.

## Validation
How to verify the change worked.

## Status
- [ ] Not started / In progress / Complete
```

### Rules
- Create a plan before starting any cross-cutting refactor
- Plans are living documents — update status as work progresses
- Plans survive completion — they're documentation of decisions made
- Number plans sequentially, never reuse numbers

---

## Dev Runner

### Single Command: `bun run dev`

Launches all services through `scripts/dev-runner.ts`:
- Builds `@uncorded/protocol` first
- Starts ElysiaJS server (API + WS gateway)
- Starts Vite dev server (SolidJS frontend)
- Shows interactive TUI with process status, logs, and port info
- Ctrl+C cleanly kills all child processes (process group isolation)

### TUI Features (modeled after t3Code's dev-runner)
- Real-time process status (running / crashed / restarting)
- Interleaved log output with color-coded process labels
- Port assignments displayed on startup
- Error highlighting in log output

### Modes
```bash
bun run dev              # Full stack (server + web)
bun run dev:server       # Server only
bun run dev:web          # Web only
bun run dev:desktop      # Desktop + web (Electron dev)
```

### Port Allocation
- Server: 3000 (base)
- Web: 5173 (Vite default)
- Support port offset via `UNCORDED_PORT_OFFSET` env var for multiple instances
- Hash-based offset from `UNCORDED_DEV_INSTANCE` for deterministic multi-instance support
- Port availability check before spawning (fail fast, don't collide)

---

## TypeScript Configuration

### Base Config (`tsconfig.base.json`)
```json
{
  "compilerOptions": {
    "target": "ES2023",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "noImplicitOverride": true,
    "skipLibCheck": true,
    "allowSyntheticDefaultImports": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  }
}
```

### Critical Flags
- `noUncheckedIndexedAccess` — array/object indexing returns `T | undefined`, forces null checks
- `exactOptionalPropertyTypes` — `{ x?: string }` means `string | undefined`, NOT `string | undefined | null`
- `strict` — enables all strict checks (noImplicitAny, strictNullChecks, etc.)

---

## Quality Gates

### Before Every Commit (enforced by chat bot agent)
1. `bun run typecheck` — zero errors
2. `bun run lint` — zero errors
3. `bun run fmt` — no formatting drift (check mode)

### CI Pipeline
1. Lint (oxlint)
2. Typecheck (tsc --noEmit per package)
3. Unit tests (Vitest)
4. Build (turbo build)

### Test Framework: Vitest
- Run: `bun run test`
- Never use `bun test` directly (bypasses Vitest config)
- Browser tests via Playwright when needed

### Testing Strategy
| Type | What | Where |
|------|------|-------|
| Unit tests | Pure functions, utilities, stores | `*.test.ts` next to source |
| Integration tests | API routes, WS handlers, DB queries | `__tests__/` in apps/server |
| Browser tests | UI components, viewport matrix | Playwright + Vitest browser mode |
| Smoke tests | App starts without crashing | `scripts/smoke-test.ts` |

### Browser Viewport Testing
Test responsive behavior across device sizes:
```typescript
const VIEWPORTS = {
  mobile: { width: 360, height: 800 },
  tablet: { width: 768, height: 1024 },
  desktop: { width: 1280, height: 720 },
  narrow: { width: 320, height: 568 },
};
```

### CI/CD Pipeline
```yaml
# .github/workflows/ci.yml
jobs:
  quality:
    steps:
      - bun install
      - bun run lint          # Oxlint
      - bun run typecheck     # tsc --noEmit per package
      - bun run test          # Unit tests
      - bun run test:browser  # Playwright browser tests
      - bun run build         # Full turbo build

  release:  # (Phase 2 — when desktop app ships)
    steps:
      - Build desktop artifacts (Windows NSIS, macOS DMG, Linux AppImage)
      - Code signing (Windows + macOS)
      - Publish to GitHub Releases
```

### Rules
- Every PR must pass all quality gates before merge
- Test files live next to the code they test (`foo.ts` → `foo.test.ts`)
- Use MSW (Mock Service Worker) for mocking HTTP/WS in browser tests
- Integration tests use a test database (not production Neon)

---

## File & Folder Conventions

### Naming
- **Files**: kebab-case (`message-store.ts`, `chat-area.tsx`)
- **Components**: PascalCase export, kebab-case file (`chat-area.tsx` → `export function ChatArea()`)
- **Types/Interfaces**: PascalCase (`ReadyData`, `GatewayFrame`)
- **Constants**: UPPER_SNAKE_CASE (`MAX_MESSAGE_LENGTH`, `HEARTBEAT_INTERVAL`)
- **Enums**: PascalCase name, PascalCase values (in protocol: numeric values)

### Exports
- Named exports only. No default exports.
- Packages use explicit subpath exports in package.json — no barrel re-exports of everything.

### Imports
- Absolute imports within each app via path aliases (`~/components/ChatArea`)
- Cross-package imports via workspace names (`@uncorded/shared/id`, `@uncorded/protocol`)

---

## Desktop App Standards (Electron — Phase 2)

### Architecture (follows t3Code patterns)
- Electron embeds the ElysiaJS server as a child process
- Main process spawns server with `ELECTRON_RUN_AS_NODE=1` on a dynamic loopback port
- Renderer loads the SolidJS app (static files in production, Vite dev server in dev)
- IPC via `contextBridge` + `ipcRenderer` — never expose Node.js APIs to the renderer
- Context isolation enabled, node integration disabled, sandbox enabled

### IPC Patterns
- Preload script exposes `window.desktopBridge` with typed methods
- `ipcMain.handle()` for request-response (file dialogs, confirmations)
- `ipcMain.on()` + `webContents.send()` for broadcasts (update status, menu actions)
- All IPC channels explicitly defined — no dynamic channel names

### Native Features (Desktop Only)
- Persistent seed folder selection (native file dialog via IPC)
- Background seeding (app stays connected when minimized)
- Client-side CSAM hashing (PhotoDNA/PDQ)
- Auto-updates via `electron-updater` with state machine (idle → checking → available → downloading → downloaded)
- System tray with seeding status
- Custom protocol handler (`uncorded://`)

### Web App Detection
```typescript
// apps/web/src/lib/env.ts
export const isDesktop = window.desktopBridge !== undefined;
export const isWeb = !isDesktop;
```

Gate desktop-only features behind `isDesktop` checks. The web app must function fully without Electron APIs.

### Build Pipeline
- Bundler: tsdown (main.ts + preload.ts → dist-electron/)
- Format: CommonJS for Electron main process
- Workspace packages (@uncorded/*) bundled into output, not external
- Sourcemaps enabled for debugging

### Dev Workflow
- `bun run dev:desktop` starts Vite + Electron together
- Dev script waits for Vite dev server + compiled main.js before spawning Electron
- Hot reload works in Electron (renderer points to Vite dev server)
- File watcher restarts Electron on main process changes (debounced)

### Process Management
- Server spawned as child process with auth token for WS connection
- Dynamic port allocation (reserve ephemeral loopback port)
- Automatic restart with exponential backoff on crash
- Graceful shutdown: SIGTERM → wait → SIGKILL
- Rotating log files for both main and server processes

---

## Root Scripts Summary

```bash
# Development
bun run dev              # Full stack via dev-runner TUI
bun run dev:server       # Server only
bun run dev:web          # Web only
bun run dev:desktop      # Electron desktop dev

# Quality
bun run lint             # Oxlint
bun run fmt              # Oxfmt
bun run typecheck        # TypeScript check (all packages)
bun run test             # Vitest (all packages)

# Build
bun run build            # Turbo build (all packages)
bun run build:desktop    # Electron desktop build

# Utility
bun run clean            # Wipe node_modules + dist + build artifacts
```

---

_This file is the source of truth for project tooling and structure. Update when conventions change._
