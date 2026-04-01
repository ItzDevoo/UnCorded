-- Backfill non-HTTPS tunnel URLs to NULL
UPDATE server_plugins SET tunnel_url = NULL WHERE tunnel_url IS NOT NULL AND tunnel_url NOT LIKE 'https://%';--> statement-breakpoint
-- Enforce HTTPS-only tunnel URLs at DB level
ALTER TABLE server_plugins ADD CONSTRAINT server_plugins_tunnel_url_https_chk CHECK (tunnel_url IS NULL OR tunnel_url LIKE 'https://%');
