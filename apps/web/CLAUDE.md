# Frontend — apps/web

SolidJS + Vite + Tailwind CSS v4.
Read docs/CLAUDE.md and the root CLAUDE.md first.

## Structure

- src/components/ — reusable UI components
- src/pages/ — route-level components
- src/stores/ — SolidJS stores (auth, messages, servers)
- src/lib/ — WebSocket client, API client, WebTorrent client, utilities

## Routes

- / — public landing page (unauthenticated)
- /login — login page
- /register — registration page
- /home — authenticated home (default landing after login, friends/DMs)
- /home/friends — friends list page
- Server/DM selection is store-based via sidebar, not URL-routed

## Rules

- SolidJS is NOT React — use createSignal, createStore, createEffect
- No virtual DOM patterns, no useEffect thinking
- Tailwind v4 utility classes only — no custom CSS unless unavoidable
- Dark theme default via CSS variables on :root
- Lazy-load all route-level pages
- Auth is session-based — use credentials: 'include' on all API calls

## UnCorded-Specific UI Rules

- File sharing in DMs: drag-and-drop or paste, P2P transfer via WebTorrent
- File sharing in server channels: Supporter+ only, show upgrade prompt for free users
- Show seeder count on shared files ("X seeders" / "No seeders online")
- Download progress bar on active transfers
- When P2P fails for free users (NAT blocked): clear message explaining the limitation, not a generic error
- When no seeders online: show magnet link as "File unavailable — no seeders online"
- Transparency receipt shown at Stripe checkout (cost, our margin, why)
- Channel file_sharing_enabled badge visible in sidebar
