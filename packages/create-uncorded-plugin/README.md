# create-uncorded-plugin

Scaffold a new UnCorded plugin project with one command.

## Usage

```bash
bun create uncorded-plugin my-plugin
```

Interactive prompts will ask for:
- Plugin name, description, author
- Scope (server, personal, or both)
- Permissions needed
- Port and UI type
- Plugin type (standard or bundled service)

## What's Generated

```
my-plugin/
├── uncorded-plugin.json   # Plugin manifest
├── package.json
├── tsconfig.json
├── Dockerfile
├── src/
│   ├── server.ts          # Bun HTTP server with bridge
│   └── index.html         # Plugin UI (if UI enabled)
└── .gitignore
```

## Next Steps

```bash
cd my-plugin
bun install
bun run dev              # Start with hot reload
# In another terminal:
bunx @uncorded/mock-bridge  # Start mock bridge
```

## Docs

[uncorded.app/create-plugin/docs](https://uncorded.app/create-plugin/docs)
