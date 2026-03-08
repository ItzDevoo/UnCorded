# UnCorded — Project Vision

## Identity

"You know exactly where your files go."

UnCorded is a real-time chat app built on radical transparency. Files transfer directly between users — they never touch our servers. Every charge is explained. No dark patterns. No hidden fees. No surprises.

- Discord = hang out and archive everything forever
- Slack = work communication with searchable history
- UnCorded = collaborate live, share freely, trust completely. Your files stay yours.

## Core Philosophy

### Radical Transparency
- Users always know where their files go — the answer is always "directly to the other person"
- Every charge explains WHY it costs money
- Profit margins shown on subscriptions — "Our cost: $X / Our profit: $Y"
- No auto-renewal traps, no dark patterns
- Cancel anytime

### P2P-First File Sharing
- Files transfer directly between users via WebTorrent (BitTorrent over WebRTC)
- Our server handles signaling only — never stores, sees, or processes user files
- Magnet URIs persist in chat as lightweight text — the file is available as long as any seeder is online
- Desktop app users can seed files persistently from a local folder
- When no seeders are online, the magnet link remains but the file is unavailable until someone comes back

### Privacy Stance
- "We don't sell your data. We make money from subscriptions. That's it."
- Files never touch our servers — there's nothing to hand over if requested. That's a feature.
- DMs are always P2P. No server involvement beyond signaling.
- CSAM scanning happens client-side via perceptual hashing (PhotoDNA/PDQ) before any file is shared

---

## Target Users (Priority Order)

1. **Developers** — share builds, screenshots, debug recordings. Found on HN, r/webdev, Twitter/X
2. **Content Creators** — send large video drafts, get visual feedback. Community file sharing via seeding.
3. **Business / Teams** — law firms, healthcare, finance sharing sensitive files that never leave the P2P connection
4. **Friend Groups** — send memes and clips without size limits

---

## File Sharing Model — WebTorrent P2P

### How It Works
- User shares a file in a channel or DM
- Desktop app: creates a torrent, generates a magnet URI, stores the URI as a message, begins seeding from local seed folder
- Web app (DMs only): creates torrent in-memory, seeds while tab is open, both users must be online
- Other users click the magnet link to download via WebRTC DataChannel (direct P2P)
- Users who download also become seeders — the swarm grows within the channel
- File availability depends on at least one seeder being online

### NAT Traversal
- STUN (free, public servers like Google's) — helps users discover their public IP for direct connections
- TURN (self-hosted relay) — fallback when direct P2P fails (~15-20% of connections, higher on mobile)
- TURN access is restricted to paid users (Supporter+). Free users get P2P-only — if NAT blocks them, they see a clear message explaining why and how to upgrade

### CSAM Compliance
- Client-side perceptual hashing (PhotoDNA or Meta's PDQ) runs before any file enters the torrent
- Match against NCMEC hash database → block share, report to NCMEC, flag account
- Register with NCMEC CyberTipline (free)
- Register DMCA agent with Copyright Office ($6)
- Desktop app integrity enforced via Electron's signed build pipeline

---

## Pricing Model — Subscription Tiers

### Free (Web Only)
- Chat in any server, join servers, send/receive messages
- File sharing in DMs only (P2P, both users must be online)
- Can download files from server channels they're in (P2P only, no TURN fallback)
- No desktop app, no seeding, no file sharing in server channels

### Supporter — $5/mo
- Everything in Free
- Desktop app with persistent seed folder
- Can share and seed files in server channels
- TURN relay fallback when P2P fails
- Transparency receipt: "You're paying for: desktop app updates, TURN relay infrastructure, signaling server capacity. Our cost: ~$X. Our margin: ~$Y."

### Server Owner — $10/mo base (scales with traffic)
- Everything in Supporter
- Can create and manage servers
- Channel policies, moderation tools, invite management
- Base price covers small communities (~100 members)
- Scales based on free-user traffic (TURN relay + signaling load from non-paying members)
- Transparency dashboard: real-time view of server costs, what's driving them, and the breakdown
- Pricing formula TBD after real infrastructure cost data is collected

### Transparency Receipt (shown at every checkout)

```
Your Monthly Subscription — Supporter

Why this costs money:
- Desktop app: built, signed, and auto-updated for your OS
- TURN relay: guaranteed file delivery when your network blocks P2P
- Signaling infrastructure: WebRTC negotiation for every file transfer

Our cost: ~$3.00 | Our margin: ~$2.00

Cancel anytime. No tricks.
```

### Payment Stack
- Stripe — subscription management, customer portal, webhooks
- Stripe Tax — global tax compliance

---

## V1 Scope (What We Are Building Now)

### Phase 1 — Web App (current)
- Text channels + DMs
- Real-time messaging (WebSocket + MessagePack)
- WebRTC signaling through existing WebSocket gateway
- P2P file sharing in DMs (web-to-web, both users online)
- WebTorrent integration for browser-based torrent creation and seeding
- Subscription billing (Free + Supporter + Server Owner)
- Transparency receipts at checkout
- Friend system + DMs
- Presence (online/idle/dnd/offline via Redis)
- Report button (CSAM, harassment, spam, copyright, other)
- Terms of Service, Privacy Policy, DMCA policy pages

### Phase 2 — Desktop App
- Electron-based desktop application (follows t3Code patterns)
- Embeds ElysiaJS server as child process
- Persistent seed folder for file sharing
- Background seeding (app stays connected when minimized)
- Client-side CSAM scanning (PhotoDNA/PDQ hashing)
- File sharing in server channels (Supporter+ only)
- TURN relay integration for paid users
- Auto-updates via electron-updater
- Code signing (Windows + macOS)

## NOT in V1

- Voice / video calls — v2
- Screen sharing + annotation — v2
- Public server discovery — v2
- Plugin / bot ecosystem — v3

---

## Key Product Decisions (Do Not Revisit Without Good Reason)

1. **WebTorrent over server-side storage** — files never touch our servers. Eliminates storage costs, strengthens privacy story, and aligns with "you know exactly where your files go."
2. **Stripe for subscriptions** — tier-based billing. Stripe Tax handles global compliance.
3. **DMs always P2P** — no server storage, no server involvement beyond signaling. Privacy is non-negotiable.
4. **Show margins at checkout** — this is the differentiator. Do not hide it to look more professional.
5. **TURN only for paid users** — free users get P2P-only. This is honest monetization tied to real infrastructure cost, not artificial limits.
6. **Desktop app via Electron** — enables persistent seeding, background operation, and client-side CSAM scanning. Follows t3Code's proven patterns. Future mobile via Capacitor.
7. **Web app first** — ship the web chat + DM file sharing before building the desktop app. Get users, validate the model, then expand.
8. **Traffic-based server owner pricing** — server owners pay proportional to the infrastructure load their free users generate. Exact formula TBD after collecting real cost data.
