# UnCorded — Fresh Test Changes

Issues and customizations found during Phase 2 systematic testing.
Fix all items before moving to Week 4.

---

## Items

### 1. Landing page before auth
- Currently `/` redirects straight to `/login` — no way to see what UnCorded is
- Need a public landing page at `/` (hero, tagline, features, pricing tiers, CTA to register/login)
- Unauthenticated users should land here, not be forced to login

### 2. Route restructure
- Currently auth redirects to `/app`, channels live at `/app/friends`, etc.
- `/app` prefix feels like a dev artifact — remove it
- New route structure:
  - `/` — public landing page (item #1)
  - `/login`, `/register` — auth pages
  - `/home` — authenticated home (friends list, DMs, welcome state)
  - `/channels/:serverId/:channelId` — server chat
- After login, redirect to `/home` not `/app`

### 4. Login requires two clicks on first attempt
- Logout → navigate to /login → enter credentials → click Login → page refreshes but stays on /login → click Login again → works
- No errors in console or server logs
- Possibly a race condition: session not fully cleared before new login attempt, or auth client not ready on first click

### 8. DM channel not auto-created on friend accept
- Account A sends friend request to Account B → B accepts → both see friend in list instantly
- But no DM channel is created between them
- Currently DMs require a separate POST /api/dms call — this should happen automatically when a friend request is accepted
- Blocks DM testing (items 15-16)

### 7. Delete message shows false "failed to delete" toast
- User deletes own message → message disappears on both clients (works correctly)
- But the deleting user sees a failure toast/popup saying it failed
- The delete actually succeeded — likely the API response status or shape isn't matching what the client expects, triggering the error handler even on success

### 6. Messages not delivering in real-time to other users
- Account A sends message in server channel → Account B doesn't see it until browser refresh
- No errors in console or server logs
- WebSocket connection likely established but MESSAGE_CREATE broadcast not reaching other clients, or client-side WS listener not updating the message store for the active channel

### 5. Channels not visible after joining server via invite
- Account B joins server via invite code → server appears and auto-selects → but channel list is empty
- Browser refresh fixes it — channels appear
- Likely: the join response or READY payload doesn't include the server's channels, or the store doesn't hydrate them on join

### 9. User B doesn't receive live updates after joining server
- User B joins via invite → channels appear → but messages and typing indicators don't arrive in real-time
- User A's messages/typing work fine (they were in the server before WS connected)
- Likely: User B's WS connection was established before they joined the server. The server's broadcastToServer queries members table (should include B), but something prevents delivery. Could also be client-side — message-store may not initialize a channel entry until B navigates to it, so incoming MESSAGE_CREATE events get dropped.

### 10. Friend request no longer instant (regression)
- Was working in previous test round, now requires browser refresh to see friend request
- Possibly related to the DM_CHANNEL_CREATE listener addition, or a timing issue with the fresh DB state

### ~~11. File sharing — WebTorrent browser compatibility errors~~ ✅ RESOLVED
- ~~`bittorrent-dht` module externalized by Vite — cannot access in browser~~ → Fixed: `dht: false`, `lsd: false` in constructor + explicit polyfill includes
- ~~WebSocket connection to `wss://tracker.btorrent.xyz/` fails (cert invalid)~~ → Fixed: explicit `announce` with known-good trackers (`openwebtorrent.com`, `webtorrent.dev`)
- ~~`f.getBlob is not a function` — WebTorrent API mismatch~~ → Fixed: replaced callback `getBlob()` with async `blob()` (WebTorrent 2.x API) + module augmentation for stale `@types/webtorrent`

### 3. Always open to /home, not last server
- Currently auto-selects the first server on load — user lands in a server channel
- Should always open to `/home` on fresh load
- User explicitly clicks a server to enter it
- `/home` is the default landing for authenticated users
