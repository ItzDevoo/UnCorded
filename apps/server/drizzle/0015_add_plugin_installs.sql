-- Create plugin_installs table
CREATE TABLE "plugin_installs" (
  "id" text PRIMARY KEY NOT NULL,
  "plugin_id" text NOT NULL,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "installed_at" timestamp DEFAULT now() NOT NULL,
  CONSTRAINT "plugin_installs_plugin_user" UNIQUE("plugin_id", "user_id")
);--> statement-breakpoint

CREATE INDEX "plugin_installs_user_id_idx" ON "plugin_installs" ("user_id");
