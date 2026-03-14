import {
  encode as msgpackEncode,
  decode as msgpackDecode,
  type DecoderOptions,
} from "@msgpack/msgpack";
import type { Opcode } from "./opcodes.js";

/** Prevent OOM DoS — reject payloads with oversized strings/arrays/maps. */
const DECODE_OPTIONS: DecoderOptions = {
  maxStrLength: 65_536,
  maxBinLength: 65_536,
  maxArrayLength: 10_000, // READY sends all channels across all servers; 100×50=5000, 2× headroom
  maxMapLength: 500, // largest map is READY d object with nested server/channel/friend objects
};

export interface GatewayFrame {
  op: Opcode;
  d: unknown;
}

export function encode(frame: GatewayFrame): Uint8Array {
  return msgpackEncode(frame);
}

export function decode(data: ArrayLike<number> | BufferSource): GatewayFrame {
  const result = msgpackDecode(data as Uint8Array, DECODE_OPTIONS);
  if (
    typeof result !== "object" ||
    result === null ||
    !("op" in result) ||
    typeof (result as Record<string, unknown>).op !== "number" ||
    !("d" in result)
  ) {
    throw new Error("Invalid GatewayFrame: missing op or d");
  }
  return result as GatewayFrame;
}
