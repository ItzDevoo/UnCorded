-- Create server_plugin_state enum
DO $$ BEGIN
  CREATE TYPE "server_plugin_state" AS ENUM ('active', 'stopped', 'error');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;--> statement-breakpoint

-- Create server_plugins table
CREATE TABLE "server_plugins" (
  "id" text PRIMARY KEY NOT NULL,
  "server_id" text NOT NULL REFERENCES "servers"("id") ON DELETE CASCADE,
  "plugin_id" text NOT NULL,
  "installed_by" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "installed_at" timestamp DEFAULT now() NOT NULL,
  "config" text,
  "tunnel_url" text,
  "state" "server_plugin_state" DEFAULT 'stopped' NOT NULL,
  CONSTRAINT "server_plugins_server_plugin" UNIQUE("server_id", "plugin_id")
);--> statement-breakpoint

CREATE INDEX "server_plugins_server_id_idx" ON "server_plugins" ("server_id");
