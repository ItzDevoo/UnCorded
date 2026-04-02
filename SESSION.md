# PWA Foundation — PR 1

## Branch: pwa-foundation
## Stop Boundary: PR created, typecheck + lint pass, build succeeds

## Tasks

1. [ ] Install `vite-plugin-pwa` — `cd apps/web && bun add -D vite-plugin-pwa`
2. [ ] Configure VitePWA in `apps/web/vite.config.ts` (autoUpdate, precache, font caching, manifest: false)
3. [ ] Create `apps/web/src/lib/pwa.ts` — calls `setupPwaStore()`, SW handled by plugin
4. [ ] Bootstrap `initPwa()` in `apps/web/src/index.tsx` before render
5. [ ] Refactor `apps/web/src/lib/browser-notifications.ts` — remove `registerServiceWorker()` + its call
6. [ ] Enhance `apps/web/public/manifest.json` — start_url `/`, display_override, shortcuts, categories
7. [ ] Add `apple-mobile-web-app-capable` meta tag to `apps/web/index.html`
8. [ ] Create `apps/web/src/components/InstallPrompt.tsx` — SolidJS, canInstall() check, iOS instructions
9. [ ] Create `apps/web/src/components/OfflineIndicator.tsx` — navigator.onLine reactive signal
10. [ ] Delete `apps/web/public/sw.js`
11. [ ] Run `bun run typecheck` — passes
12. [ ] Run `bun run lint` — passes
13. [ ] Run `bun run build` (with VITE_API_URL="") — succeeds, SW generated
14. [ ] Commit and create PR

## Rules
- SolidJS only (createSignal, Show, For, onMount, onCleanup) — NOT React
- Tailwind semantic tokens — no raw colors
- Bun only — never npm/node
- Strict TypeScript, no `any`
