# UnCorded — Auto-Update System

Desktop app auto-update architecture.

This must be implemented early in the Electron desktop app phase — not bolted on later.

---

## Overview

- **Library**: electron-updater (^6.x)
- **Feed**: GitHub Releases (electron-updater reads the release atom feed automatically)
- **User Control**: No auto-download, no auto-install — user explicitly triggers both
- **State**: Reducer-based state machine, broadcasted to renderer via IPC
- **Signing**: Platform-specific (macOS: Apple notarization, Windows: Azure Trusted Signing, Linux: none)

---

## State Machine

### State Shape

```typescript
// In @uncorded/protocol (shared between main + renderer)
type UpdateStatus =
  | "disabled" // Dev build or unsupported platform
  | "idle" // Enabled, waiting for check
  | "checking" // Checking GitHub for updates
  | "up-to-date" // No update available
  | "available" // Update found, waiting for user to download
  | "downloading" // Download in progress
  | "downloaded" // Ready to install
  | "error"; // Something failed

interface UpdateState {
  enabled: boolean;
  status: UpdateStatus;
  currentVersion: string;
  availableVersion: string | null;
  downloadedVersion: string | null;
  downloadPercent: number | null;
  checkedAt: string | null; // ISO timestamp
  message: string | null; // Error message for UI
  errorContext: "check" | "download" | "install" | null;
  canRetry: boolean;
}
```

### State Transitions

```
                    ┌─────────────┐
                    │  disabled   │ (dev build / unsupported)
                    └─────────────┘

┌──────┐  app start   ┌──────────┐  check   ┌──────────┐
│ idle │──────────────▶│ checking │─────────▶│up-to-date│
└──────┘               └──────────┘          └──────────┘
                            │
                            │ update found
                            ▼
                       ┌───────────┐  download  ┌─────────────┐
                       │ available │───────────▶│ downloading  │
                       └───────────┘            └─────────────┘
                            ▲                        │
                            │ download fail          │ download complete
                            │ (retry available)      ▼
                       ┌─────────┐           ┌────────────┐
                       │  error  │◀──────────│ downloaded  │
                       └─────────┘  install  └────────────┘
                                    fail          │
                                                  │ install
                                                  ▼
                                            App restarts
                                            with new version
```

### Transition Functions (Pure Reducers)

Each transition is a pure function: `(state, event) → newState`

```typescript
// Check started (button click or poll)
reduceOnCheckStart(state): → { status: "checking", canRetry: false, message: null }

// Check failed (network error, etc.)
reduceOnCheckFailure(state, error): → { status: "error", errorContext: "check", canRetry: true, message: error }

// Update available
reduceOnUpdateAvailable(state, version): → { status: "available", availableVersion: version }

// No update
reduceOnNoUpdate(state): → { status: "up-to-date", availableVersion: null, downloadedVersion: null }

// Download started
reduceOnDownloadStart(state): → { status: "downloading", downloadPercent: 0 }

// Download progress (throttled — see below)
reduceOnDownloadProgress(state, percent): → { status: "downloading", downloadPercent: percent }

// Download failed
reduceOnDownloadFailure(state, error): → {
  status: state.availableVersion ? "available" : "error",
  errorContext: "download",
  canRetry: state.availableVersion !== null,
  message: error
}

// Download complete
reduceOnDownloadComplete(state, version): → {
  status: "downloaded",
  downloadedVersion: version,
  downloadPercent: 100,
  canRetry: true  // can retry install
}

// Install failed
reduceOnInstallFailure(state, error): → {
  status: "downloaded",  // keep file, user can retry
  errorContext: "install",
  canRetry: true,
  message: error
}
```

---

## Download Progress Throttling

Only broadcast progress to UI when it crosses a **10% bucket boundary** or reaches 100%.
This prevents UI thrashing from rapid progress events.

```typescript
function shouldBroadcastProgress(oldPercent: number | null, newPercent: number): boolean {
  if (newPercent >= 100) return true;
  const oldBucket = oldPercent === null ? -1 : Math.floor(oldPercent / 10);
  const newBucket = Math.floor(newPercent / 10);
  return newBucket > oldBucket;
}
```

Result: UI sees updates at 0%, 10%, 20%, ..., 90%, 100% — not every 0.1%.

---

## electron-updater Configuration

```typescript
// In main process setup
import { autoUpdater } from "electron-updater";

function configureAutoUpdater() {
  autoUpdater.autoDownload = false; // User triggers download
  autoUpdater.autoInstallOnAppQuit = false; // User triggers install
  autoUpdater.channel = "latest"; // Stable only
  autoUpdater.allowPrerelease = false;
  autoUpdater.allowDowngrade = false;

  // GitHub as update feed provider
  autoUpdater.setFeedURL({
    provider: "github",
    owner: "ItzDevoo", // GitHub org/user
    repo: "UnCorded", // GitHub repo
    releaseType: "release",
  });
}
```

### Event Handlers

```typescript
autoUpdater.on("checking-for-update", () => {
  // Log only — state already set to "checking" before calling checkForUpdates()
});

autoUpdater.on("update-available", (info) => {
  state = reduceOnUpdateAvailable(state, info.version);
  broadcastState();
});

autoUpdater.on("update-not-available", () => {
  state = reduceOnNoUpdate(state);
  broadcastState();
});

autoUpdater.on("download-progress", (progress) => {
  if (shouldBroadcastProgress(state.downloadPercent, progress.percent)) {
    state = reduceOnDownloadProgress(state, progress.percent);
    broadcastState();
  }
});

autoUpdater.on("update-downloaded", (info) => {
  state = reduceOnDownloadComplete(state, info.version);
  broadcastState();
});

autoUpdater.on("error", (error) => {
  // Only handle if we're in a relevant state
  if (state.status === "checking") {
    state = reduceOnCheckFailure(state, error.message);
  } else if (state.status === "downloading") {
    state = reduceOnDownloadFailure(state, error.message);
  }
  broadcastState();
});
```

---

## Check Schedule

| Event            | Timing                                  |
| ---------------- | --------------------------------------- |
| Startup check    | 15 seconds after app launch             |
| Polling interval | Every 4 hours                           |
| Manual check     | User clicks "Check for Updates" in menu |

```typescript
const AUTO_UPDATE_STARTUP_DELAY_MS = 15_000;
const AUTO_UPDATE_POLL_INTERVAL_MS = 4 * 60 * 60 * 1000;

// On app ready:
setTimeout(() => checkForUpdates("startup"), AUTO_UPDATE_STARTUP_DELAY_MS);
setInterval(() => checkForUpdates("poll"), AUTO_UPDATE_POLL_INTERVAL_MS);
```

---

## IPC Protocol

### Channels

| Channel                    | Direction       | Purpose                     |
| -------------------------- | --------------- | --------------------------- |
| `desktop:update-get-state` | renderer → main | Get current update state    |
| `desktop:update-download`  | renderer → main | Trigger download            |
| `desktop:update-install`   | renderer → main | Trigger install (quits app) |
| `desktop:update-state`     | main → renderer | Broadcast state changes     |

### Preload Bridge

```typescript
// preload.ts — exposed via contextBridge
desktopBridge: {
  getUpdateState(): Promise<UpdateState>,
  downloadUpdate(): Promise<{ accepted: boolean; completed: boolean; state: UpdateState }>,
  installUpdate(): Promise<{ accepted: boolean; completed: boolean; state: UpdateState }>,
  onUpdateState(listener: (state: UpdateState) => void): () => void,  // returns unsubscribe
}
```

### Main Process Handlers

```typescript
ipcMain.handle("desktop:update-get-state", () => {
  return updateState;
});

ipcMain.handle("desktop:update-download", async () => {
  if (updateState.status !== "available")
    return { accepted: false, completed: false, state: updateState };
  // ... trigger download, return result
});

ipcMain.handle("desktop:update-install", async () => {
  if (updateState.status !== "downloaded")
    return { accepted: false, completed: false, state: updateState };
  // ... stop backend server, quit and install
});
```

### Broadcasting

```typescript
function broadcastState() {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send("desktop:update-state", updateState);
    }
  }
}
```

---

## Install Flow

Install is destructive (quits the app), so handle carefully:

1. Verify state is `"downloaded"`
2. Set `isQuitting = true` (prevents restart loops)
3. Stop the embedded ElysiaJS server gracefully (5s timeout)
4. Call `autoUpdater.quitAndInstall()`
5. Electron handles: quit → replace binary → relaunch

```typescript
async function installUpdate() {
  if (updateState.status !== "downloaded" || isQuitting) return false;
  isQuitting = true;

  try {
    await stopBackendServer(5000); // 5s grace period
    autoUpdater.quitAndInstall();
  } catch (error) {
    isQuitting = false;
    updateState = reduceOnInstallFailure(updateState, error.message);
    broadcastState();
  }
}
```

---

## Disabled Conditions

Auto-update is automatically disabled when:

| Condition              | Reason                                 |
| ---------------------- | -------------------------------------- |
| Development build      | `app.isPackaged === false`             |
| Linux without AppImage | AppImage is required for delta updates |
| Env override           | `UNCORDED_DISABLE_AUTO_UPDATE=1`       |

When disabled, state stays `"disabled"` permanently. UI should show why:

```typescript
function getDisabledReason(context: {
  isDevelopment: boolean;
  isPackaged: boolean;
  platform: string;
  appImage: string | undefined;
  disabledByEnv: boolean;
}): string | null {
  if (context.disabledByEnv) return "Disabled by environment variable";
  if (context.isDevelopment || !context.isPackaged)
    return "Auto-update not available in development";
  if (context.platform === "linux" && !context.appImage)
    return "Auto-update requires AppImage format";
  return null; // enabled
}
```

---

## App Menu Integration

```
Help
├── Check for Updates...    (triggers manual check)
└── About UnCorded          (shows current version)
```

The menu item text updates based on state:

- `"Check for Updates..."` — idle/up-to-date/error
- `"Checking for Updates..."` — checking (disabled)
- `"Download Update (vX.Y.Z)"` — available
- `"Downloading Update..."` — downloading (disabled)
- `"Restart to Update"` — downloaded

---

## Renderer UI Component

The web app needs an update banner/toast. Only shown when `isDesktop` is true.

### States to Display

| Status                           | UI                                                  |
| -------------------------------- | --------------------------------------------------- |
| `up-to-date`                     | Nothing (or subtle "Up to date" in settings)        |
| `available`                      | Banner: "Update vX.Y.Z available" + Download button |
| `downloading`                    | Progress bar with percentage                        |
| `downloaded`                     | Banner: "Update ready" + "Restart Now" button       |
| `error`                          | Error message + Retry button (if `canRetry`)        |
| `disabled` / `idle` / `checking` | Nothing visible                                     |

### SolidJS Store Integration

```typescript
// stores/update-store.ts
import { createSignal } from "solid-js";
import type { UpdateState } from "@uncorded/protocol";

const [updateState, setUpdateState] = createSignal<UpdateState | null>(null);

// On desktop, subscribe to state changes
if (isDesktop) {
  window.desktopBridge.getUpdateState().then(setUpdateState);
  window.desktopBridge.onUpdateState(setUpdateState);
}

export { updateState };
```

---

## Release Pipeline (CI/CD)

### Trigger

- Push tag matching `v*.*.*`
- Manual dispatch with version input

### Jobs

#### 1. Preflight (ubuntu)

- Validate semver format
- Run lint + typecheck + tests
- Determine: version, tag, is_prerelease, make_latest

#### 2. Build (parallel matrix)

| Platform    | Runner       | Target    | Signing               |
| ----------- | ------------ | --------- | --------------------- |
| macOS arm64 | macos-14     | DMG + ZIP | Apple notarization    |
| macOS x64   | macos-latest | DMG + ZIP | Apple notarization    |
| Linux x64   | ubuntu-24.04 | AppImage  | None                  |
| Windows x64 | windows-2022 | NSIS      | Azure Trusted Signing |

Each build:

1. Stage app (dist-electron + server dist + web dist)
2. Install production deps
3. Run electron-builder with `--publish never`
4. Upload artifacts

#### 3. Release (ubuntu)

- Download all build artifacts
- Create GitHub Release with tag + release notes
- Upload all artifacts to release
- Mark as latest (or prerelease)

#### 4. Finalize (ubuntu)

- Bump version in all package.json files
- Commit and push to main

### Signing Secrets Required

| Secret                       | Platform | Purpose                           |
| ---------------------------- | -------- | --------------------------------- |
| `CSC_LINK`                   | macOS    | Code signing certificate (base64) |
| `CSC_KEY_PASSWORD`           | macOS    | Certificate password              |
| `APPLE_API_KEY`              | macOS    | Notarization API key              |
| `APPLE_API_KEY_ID`           | macOS    | Notarization key ID               |
| `APPLE_API_ISSUER`           | macOS    | Notarization issuer ID            |
| `AZURE_TENANT_ID`            | Windows  | Azure AD tenant                   |
| `AZURE_CLIENT_ID`            | Windows  | Azure AD client                   |
| `AZURE_CLIENT_SECRET`        | Windows  | Azure AD secret                   |
| `AZURE_CODE_SIGNING_ACCOUNT` | Windows  | Trusted Signing account           |
| `AZURE_CERT_PROFILE`         | Windows  | Certificate profile name          |

---

## Electron-Builder Config

Generated programmatically in `scripts/build-desktop-artifact.ts`:

```typescript
{
  appId: "com.uncorded.app",
  productName: "UnCorded",
  artifactName: "UnCorded-${version}-${arch}.${ext}",
  directories: {
    buildResources: "apps/desktop/resources"
  },
  publish: [{
    provider: "github",
    owner: "ItzDevoo",
    repo: "UnCorded",
    releaseType: "release"
  }],
  mac: {
    target: ["dmg", "zip"],
    icon: "icon.icns",
    category: "public.app-category.social-networking"
  },
  linux: {
    target: ["AppImage"],
    icon: "icon.png",
    category: "Network"
  },
  win: {
    target: ["nsis"],
    icon: "icon.ico"
    // azureSignOptions added when --signed flag is present
  }
}
```

### Resources Directory

```
apps/desktop/resources/
├── icon.icns      # macOS (1024x1024)
├── icon.ico       # Windows (256x256 multi-res)
└── icon.png       # Linux (512x512)
```

---

## Implementation Checklist

Phase 2 (Desktop App) — implement in this order:

1. [ ] Define `UpdateState` and `UpdateStatus` types in `@uncorded/protocol`
2. [ ] Write pure reducer functions (all `reduceOn*` transitions)
3. [ ] Write `shouldBroadcastProgress()` throttle helper
4. [ ] Write `getDisabledReason()` check
5. [ ] Configure electron-updater in main process
6. [ ] Wire event handlers (update-available, download-progress, etc.)
7. [ ] Set up check schedule (15s startup + 4hr poll)
8. [ ] Implement IPC handlers (get-state, download, install)
9. [ ] Add to preload bridge (desktopBridge.getUpdateState, etc.)
10. [ ] Create SolidJS update store (signal + desktop bridge subscription)
11. [ ] Build update banner component (available → downloading → downloaded)
12. [ ] Add "Check for Updates" to Help menu
13. [ ] Write `scripts/build-desktop-artifact.ts` (programmatic electron-builder)
14. [ ] Set up `.github/workflows/release.yml` (preflight → build matrix → publish)
15. [ ] Configure signing secrets in GitHub repo settings
16. [ ] Test full cycle: build → publish → app detects → download → install → restart

---

_This file documents the complete auto-update architecture. Follow it exactly when implementing the desktop app._
