# Backend — apps/server

ElysiaJS on Bun. REST API + WebSocket gateway.
Read C:\UnCorded\Docs\CLAUDE.md and Project/CLAUDE.md first.

## Structure
- src/routes/ — auth, servers, channels, messages, uploads, webhooks
- src/ws/ — WebSocket gateway (lifecycle, opcodes, pub/sub)
- src/db/ — Drizzle schema + migrations
- src/middleware/ — auth guard, rate limiter
- src/jobs/ — file expiry cron job

## Rules
- Auth middleware required on every protected route — never skip
- POST /uploads/presign is the ONLY place TTL and file size are enforced
- TTL logic at presign (checked in order, first match wins):
  1. If DM channel → always 2hr, ignore everything else
  2. If channel storage_policy = persistent → null (no expiry)
  3. If user has extended expiry purchase active → 24hr
  4. If channel storage_policy = extended → 7 days
  5. Default → 2hr
- Verify Stripe webhook signature on every webhook request
- Rate limit all public-facing endpoints
- Allowed MIME types: image/*, video/*, audio/*, application/pdf, text/plain
- Blocked extensions: .exe .bat .sh .msi .ps1 .cmd — reject entirely
- WebSocket frames: MessagePack binary only, never JSON

## File Expiry Cron
- Runs every 15 minutes
- Finds attachments where expires_at < now AND expired = false
- Deletes file from R2
- Sets attachment.expired = true
- Broadcasts FILE_EXPIRED event via in-memory WebSocket connections (Redis pub/sub deferred to multi-instance scaling)
- WS gateway fans out to all clients in the channel

## Stripe Integration
- Two products: custom_avatar ($0.50/mo) and extended_expiry ($1.00/mo)
- Webhook events: checkout.session.completed, customer.subscription.deleted
- On purchase: set users.has_custom_avatar or has_extended_expiry = true
- On cancel: revert the flag, content deleted within 24 hours
- Customer Portal enabled for self-serve cancellation
