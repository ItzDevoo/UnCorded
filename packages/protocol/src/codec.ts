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
  const result = msgpackDecode(data as Uint8Array);
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
