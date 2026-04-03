# @uncorded/plugin-client

Client-side SDK for UnCorded plugin UIs. Provides the `UnCordedPlugin` postMessage bridge for iframe-embedded frontends to communicate with the UnCorded shell.

## Install

```bash
bun add @uncorded/plugin-client
```

## Quick Start

```typescript
import { UnCordedPlugin } from "@uncorded/plugin-client";

const plugin = new UnCordedPlugin();
const user = await plugin.getUser();
console.log(`Hello, ${user?.displayName}`);

// Show a toast notification
await plugin.showToast("Plugin loaded!", "success");

// Listen for events
plugin.on("message", (data) => console.log("New message:", data));
```

## API

- `plugin.getUser()` — Current user
- `plugin.getServer()` — Current server
- `plugin.getChannels()` — Channel list
- `plugin.getMembers()` — Member list
- `plugin.sendMessage(channelId, content)` — Send a message
- `plugin.showToast(message, type)` — Display notification
- `plugin.navigate("channel", channelId)` — Navigate to channel
- `plugin.on(event, handler)` / `.off(event, handler)` — Event subscriptions
- `plugin.destroy()` — Cleanup

## Docs

[uncorded.app/create-plugin/docs](https://uncorded.app/create-plugin/docs)
