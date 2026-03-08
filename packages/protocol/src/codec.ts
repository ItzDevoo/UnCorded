import { encode as msgpackEncode, decode as msgpackDecode } from "@msgpack/msgpack";
import type { Opcode } from "./opcodes.js";

export interface GatewayFrame {
  op: Opcode;
  d: unknown;
}

export function encode(frame: GatewayFrame): Uint8Array {
  return msgpackEncode(frame);
}

export function decode(data: ArrayLike<number> | BufferSource): GatewayFrame {
  return msgpackDecode(data as Uint8Array) as GatewayFrame;
}
