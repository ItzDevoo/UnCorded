CREATE TABLE plugin_registry (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT NOT NULL,
  author TEXT NOT NULL,
  icon_url TEXT,
  category TEXT NOT NULL DEFAULT 'other',
  scope TEXT NOT NULL DEFAULT 'server',
  tags TEXT[] DEFAULT '{}',
  image TEXT NOT NULL,
  version TEXT NOT NULL DEFAULT '1.0.0',
  manifest JSONB NOT NULL,
  repository TEXT,
  verified BOOLEAN DEFAULT FALSE,
  featured BOOLEAN DEFAULT FALSE,
  downloads INTEGER DEFAULT 0,
  screenshots JSONB DEFAULT '[]',
  published BOOLEAN DEFAULT TRUE,
  created_at TIMESTAMP DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP DEFAULT NOW() NOT NULL
);

CREATE INDEX plugin_registry_category_idx ON plugin_registry(category);
CREATE INDEX plugin_registry_scope_idx ON plugin_registry(scope);

-- Seed existing plugins
INSERT INTO plugin_registry (id, name, description, author, category, scope, tags, image, version, manifest, verified) VALUES
('claude-code', 'Claude Code', 'Connect your Claude Code session to UnCorded. Chat with Claude from any DM or server channel.', 'UnCorded', 'AI', 'both', ARRAY['ai', 'developer-tools', 'automation'], 'claude-code:latest', '1.0.0', '{"id":"claude-code","name":"Claude Code","version":"1.0.0","description":"Connect your Claude Code session to UnCorded.","author":"UnCorded","scope":"both","runtime":{"image":"claude-code:latest","port":3000,"healthCheck":"/health"},"permissions":["server.read","members.read","messages.read","messages.send"],"ui":{"type":"panel"}}', true),
('excalidraw-boards', 'Excalidraw Boards', 'Collaborative whiteboard — create boards and draw together in real-time.', 'UnCorded', 'Collaboration', 'server', ARRAY['whiteboard', 'collaboration', 'drawing'], 'excalidraw-boards:latest', '1.0.0', '{"id":"excalidraw-boards","name":"Excalidraw Boards","version":"1.0.0","description":"Collaborative whiteboard","author":"UnCorded","scope":"server","runtime":{"image":"excalidraw-boards:latest","port":3000,"healthCheck":"/health"},"permissions":["server.read","members.read"],"resources":{"cpus":0.5,"memoryMb":256},"ui":{"type":"page"}}', true);
