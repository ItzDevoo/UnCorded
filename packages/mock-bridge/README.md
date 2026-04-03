# @uncorded/mock-bridge

Local development mock server for testing UnCorded plugins without a running server. Simulates the sidecar bridge API with mock data.

## Install

```bash
bun add -d @uncorded/mock-bridge
```

## Usage

```bash
bunx @uncorded/mock-bridge --port 7070
```

Then point your plugin at it:

```bash
UNCORDED_BRIDGE_URL=http://localhost:7070 UNCORDED_BRIDGE_TOKEN=dev bun run src/server.ts
```

The mock bridge provides:
- 3 sample users, 2 channels, sample messages
- Full storage API (in-memory)
- Accepts any Bearer token

## Docs

[uncorded.app/create-plugin/docs](https://uncorded.app/create-plugin/docs)
