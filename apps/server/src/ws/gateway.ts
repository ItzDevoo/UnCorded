import { Elysia } from 'elysia';
import { Opcode, CloseCode, encode, decode } from '@uncorded/protocol';
import { eq } from 'drizzle-orm';
import { db } from '../db/index.js';
import { user } from '../db/schema.js';
import { removeConnection, getConnections } from './connections.js';
import { handleIdentify } from './handlers.js';

const HEARTBEAT_INTERVAL = 30_000;
const HEARTBEAT_TIMEOUT = 45_000;

interface WsContext {
  userId: string | null;
  heartbeatTimeout: Timer | null;
}

const wsContexts = new WeakMap<object, WsContext>();

function getCtx(ws: { raw: object }): WsContext {
  let ctx = wsContexts.get(ws.raw);
  if (!ctx) {
    ctx = { userId: null, heartbeatTimeout: null };
    wsContexts.set(ws.raw, ctx);
  }
  return ctx;
}

function resetHeartbeatTimeout(ws: { raw: object; terminate: () => void }): void {
  const ctx = getCtx(ws);
  if (ctx.heartbeatTimeout) clearTimeout(ctx.heartbeatTimeout);
  ctx.heartbeatTimeout = setTimeout(() => {
    ws.terminate();
  }, HEARTBEAT_TIMEOUT);
}

export const gateway = new Elysia().ws('/gateway', {
  open(ws) {
    ws.send(
      Buffer.from(encode({ op: Opcode.HELLO, d: { heartbeatInterval: HEARTBEAT_INTERVAL } })),
    );
    resetHeartbeatTimeout(ws);
  },

  async message(ws, raw) {
    if (typeof raw === 'string') {
      ws.close(CloseCode.NOT_BINARY, 'Expected binary MessagePack');
      return;
    }

    let frame: { op: number; d: unknown };
    try {
      frame = decode(raw as Uint8Array);
    } catch {
      ws.close(CloseCode.INVALID_FRAME, 'Invalid MessagePack frame');
      return;
    }

    const ctx = getCtx(ws);

    switch (frame.op) {
      case Opcode.IDENTIFY: {
        if (ctx.userId) {
          ws.close(CloseCode.ALREADY_IDENTIFIED, 'Already identified');
          return;
        }

        const result = await handleIdentify(ws.raw, frame.d);
        if (!result.success) {
          ws.close(result.closeCode, result.closeReason);
          return;
        }

        ctx.userId = result.userId;
        resetHeartbeatTimeout(ws);
        break;
      }

      case Opcode.HEARTBEAT: {
        if (!ctx.userId) {
          ws.close(CloseCode.NOT_IDENTIFIED, 'Not identified');
          return;
        }
        resetHeartbeatTimeout(ws);
        break;
      }

      default:
        break;
    }
  },

  async close(ws) {
    const ctx = getCtx(ws);
    if (ctx.heartbeatTimeout) clearTimeout(ctx.heartbeatTimeout);

    if (ctx.userId) {
      removeConnection(ctx.userId, ws.raw);

      // If no more connections for this user, set offline
      const remaining = getConnections(ctx.userId);
      if (!remaining) {
        await db.update(user).set({ status: 'offline' }).where(eq(user.id, ctx.userId));
      }
    }

    wsContexts.delete(ws.raw);
  },
});
