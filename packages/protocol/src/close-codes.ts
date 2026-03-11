export enum CloseCode {
  /** Frame was a string, expected binary MessagePack */
  NOT_BINARY = 4001,
  /** Failed to decode MessagePack frame */
  INVALID_FRAME = 4002,
  /** Client sent IDENTIFY twice */
  ALREADY_IDENTIFIED = 4003,
  /** IDENTIFY payload missing token */
  MISSING_TOKEN = 4004,
  /** Session token invalid or expired */
  INVALID_SESSION = 4005,
  /** Client sent opcode before IDENTIFY */
  NOT_IDENTIFIED = 4006,
  /** Server-side session/context changed — client should reconnect to refresh */
  SESSION_UPDATED = 4010,
}
