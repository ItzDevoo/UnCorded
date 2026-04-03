# @uncorded/plugin-server

Server-side SDK for building UnCorded plugins. Provides the `UnCordedBridge` HTTP client for Docker-based plugins to communicate with the UnCorded sidecar.

## Install

```bash
bun add @uncorded/plugin-server
```

## Quick Start

```typescript
import { UnCordedBridge, createReadinessCheck } from "@uncorded/plugin-server";

const bridge = new UnCordedBridge();
const server = await bridge.getServer();
console.log(`Running on ${server.name}`);

// Store plugin settings
await bridge.storage.set("config", { theme: "dark" });

// Send a message
await bridge.sendMessage(channelId, "Hello from my plugin!");
```

## API

- `bridge.getServer()` — Server metadata
- `bridge.getMembers()` — Member list
- `bridge.getChannels()` — Channel list
- `bridge.getMessages(channelId)` — Message history
- `bridge.sendMessage(channelId, content)` — Send a message
- `bridge.getUser(userId)` — User profile
- `bridge.notify({ title, body })` — Push notification
- `bridge.storage.get(key)` / `.set(key, value)` / `.delete(key)` — KV storage
- `createReadinessCheck(checks)` — Health check helper for `/ready`

## Docs

[uncorded.app/create-plugin/docs](https://uncorded.app/create-plugin/docs)
