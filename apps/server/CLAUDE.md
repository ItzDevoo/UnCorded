# Backend — apps/server

ElysiaJS on Bun. REST API + WebSocket gateway + WebRTC signaling.
Read C:\UnCorded\Docs\CLAUDE.md and Project/CLAUDE.md first.

## Structure
- src/routes/ — auth, servers, channels, messages, subscriptions, webhooks
- src/ws/ — WebSocket gateway (lifecycle, opcodes, pub/sub, WebRTC signaling)
- src/db/ — Drizzle schema + migrations
- src/middleware/ — auth guard, rate limiter

## Rules
- Auth middleware required on every protected route — never skip
- The server NEVER stores user files — all file transfers are P2P via WebTorrent
- WebRTC signaling frames (OFFER, ANSWER, ICE_CANDIDATE) are forwarded between peers, never inspected
- FILE_SHARE events store a lightweight file_receipt (magnet URI, hash, metadata) — not the file itself
- TURN relay credentials only issued to Supporter+ tier users
- Verify Stripe webhook signature on every webhook request
- Rate limit all public-facing endpoints
- WebSocket frames: MessagePack binary only, never JSON

## Subscription Tiers
- Free: chat, join servers, DM file sharing (P2P only, no TURN)
- Supporter ($5/mo): desktop app access, server file sharing, TURN relay
- Server Owner ($10+/mo): create/manage servers, traffic-based scaling

## Stripe Integration
- Three subscription tiers (free handled client-side, supporter + server_owner via Stripe)
- Webhook events: checkout.session.completed, customer.subscription.updated, customer.subscription.deleted
- On subscribe: set users.subscription_tier
- On cancel: revert to free tier
- Customer Portal enabled for self-serve management
