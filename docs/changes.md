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

## Open

### 9. User B doesn't receive live updates after joining server — NEEDS VERIFICATION
- User B joins via invite → channels appear → but messages and typing indicators don't arrive in real-time
- The message-store reactivity fix (#6, commit 9bbc941) may have resolved this since incoming MESSAGE_CREATE events now properly update the store
- However, the server-side subscription concern remains: if B's WS connection was established before joining, broadcastToServer queries the members table (which SHOULD include B post-join), but delivery may still fail if the client-side message-store hasn't initialized a channel entry for B's new channels
- **Action needed:** manual test with fresh DB to confirm
