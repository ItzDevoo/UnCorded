# UnCorded — Fresh Test Changes

Issues and customizations found during systematic testing with a fresh DB.
Fix all items before moving to Week 4.

---

## Resolved

### ~~1. Landing page before auth~~ ✅ (commit 66f7279)
- Added public landing page at `/` with hero, features, pricing, CTA buttons

### ~~2. Route restructure~~ ✅ (commit 66f7279)
- `/app` prefix removed, auth routes now under `/home`, post-login redirects to `/home`

### ~~3. Always open to /home, not last server~~ ✅ (commit 66f7279)
- Removed auto-select-first-server effect, app always opens to `/home`

### ~~4. Login requires two clicks on first attempt~~ ✅ (commit 9bbc941)
- Fixed: hard navigation on logout clears stale session state

### ~~5. Channels not visible after joining server via invite~~ ✅ (commit 9bbc941)
- Fixed: invite accept response now includes server channels, JoinServerModal hydrates store

### ~~6. Messages not delivering in real-time to other users~~ ✅ (commit 9bbc941)
- Fixed: message-store replaced `produce+push` with array replacement for SolidJS reactivity

### ~~7. Delete message shows false "failed to delete" toast~~ ✅ (commit 9bbc941)
- Fixed: api.ts handles 204 No Content without attempting JSON parse

### ~~8. DM channel not auto-created on friend accept~~ ✅ (commit 9bbc941)
- Fixed: ensureDmChannel helper auto-creates DM on friend accept, broadcasts to both users

### ~~10. Friend request no longer instant (regression)~~ ✅ (commit 031a824)
- Fixed: DM_CHANNEL_CREATE listener added to friend-store for real-time updates

### ~~11. File sharing — WebTorrent browser compatibility errors~~ ✅ (commit 2a2c097)
- DHT/LSD disabled (browser can't do UDP), explicit tracker URLs, WebTorrent 2.x async API

---

### ~~9. User B doesn't receive live updates after joining server~~ ✅ (fixed by #5 + #6)
- Was a symptom of #6 (message-store reactivity) + #5 (channel hydration on join)
- broadcastToServer() queries members table fresh every call (not cached) — B is included immediately after invite accept
- addMessage() auto-initializes channel entries for incoming MESSAGE_CREATE events on unloaded channels
