# Frontend — apps/web

SolidJS + Vite + Tailwind CSS v4.
Read C:\UnCorded\Docs\CLAUDE.md and Project/CLAUDE.md first.

## Structure
- src/components/ — reusable UI components
- src/pages/ — route-level components
- src/stores/ — SolidJS stores (auth, messages, servers)
- src/lib/ — WebSocket client, API client, utilities

## Routes
- /login
- /register
- /channels/me — DMs + friend list
- /channels/:serverId/:channelId — server chat view

## Rules
- SolidJS is NOT React — use createSignal, createStore, createEffect
- No virtual DOM patterns, no useEffect thinking
- Tailwind v4 utility classes only — no custom CSS unless unavoidable
- Dark theme default via CSS variables on :root
- Lazy-load all route-level pages
- Message lists require virtual scrolling — never render all messages in DOM
- Auth is session-based — use credentials: 'include' on all API calls

## UnCorded-Specific UI Rules
- Storage policy badge visible on every channel in the sidebar
- Show storage policy BEFORE user joins a server (on invite/join screen)
- Show storage policy confirmation BEFORE user sends a file
- Show TTL countdown on every attachment ("Expires in 1h 45m")
- Show "File expired" placeholder when expired = true
- Show "Ask to Reshare" button on expired files
- Transparency receipt shown at Stripe checkout (cost, our margin, why)
