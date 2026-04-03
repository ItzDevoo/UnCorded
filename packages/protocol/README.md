# @uncorded/protocol

Wire protocol for UnCorded — MessagePack codec, opcodes, and branded types.

> Internal dependency. Most plugin developers should install `@uncorded/plugin-server` or `@uncorded/plugin-client` instead.

## Install

```bash
bun add @uncorded/protocol
```

## What's Included

- **MessagePack codec** — `encode()` / `decode()` for binary WebSocket frames
- **Opcodes** and close codes for the WebSocket protocol
- **Branded types** — `UserId`, `ServerId`, `ChannelId`, `MessageId`, `PluginId`
- **Zod schemas** for runtime validation of protocol messages

## Docs

[uncorded.app/create-plugin/docs](https://uncorded.app/create-plugin/docs)
