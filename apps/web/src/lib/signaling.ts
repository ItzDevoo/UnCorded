import { Opcode, userId, channelId as toChannelId, signalingEventSchema } from "@uncorded/protocol";
import type { UserId, ChannelId } from "@uncorded/protocol";
import { sendFrame, onGatewayEvent } from "./gateway.js";

// ── Outbound signaling ──────────────────────────────────────────────────────

export function sendOffer(targetUserId: UserId, channelId: ChannelId, sdp: unknown): void {
  sendFrame({ op: Opcode.WEBRTC_OFFER, d: { targetUserId, channelId, data: sdp } });
}

export function sendAnswer(targetUserId: UserId, channelId: ChannelId, sdp: unknown): void {
  sendFrame({ op: Opcode.WEBRTC_ANSWER, d: { targetUserId, channelId, data: sdp } });
}

export function sendIceCandidate(
  targetUserId: UserId,
  channelId: ChannelId,
  candidate: unknown,
): void {
  sendFrame({
    op: Opcode.WEBRTC_ICE_CANDIDATE,
    d: { targetUserId, channelId, data: candidate },
  });
}

// ── Inbound signaling ───────────────────────────────────────────────────────

export type SignalingEventType = "offer" | "answer" | "ice-candidate";

interface SignalingEvent {
  fromUserId: UserId;
  channelId: ChannelId;
  data: unknown;
}

const opcodeByType: Record<SignalingEventType, Opcode> = {
  offer: Opcode.WEBRTC_OFFER,
  answer: Opcode.WEBRTC_ANSWER,
  "ice-candidate": Opcode.WEBRTC_ICE_CANDIDATE,
};

/** Subscribe to incoming signaling events. Returns an unsubscribe function. */
export function onSignalingEvent(
  type: SignalingEventType,
  callback: (event: SignalingEvent) => void,
): () => void {
  return onGatewayEvent(opcodeByType[type], (data) => {
    const parsed = signalingEventSchema.safeParse(data);
    if (!parsed.success) {
      if (import.meta.env.DEV)
        console.warn(`Invalid ${type} signaling event:`, parsed.error.issues);
      return;
    }
    const raw = parsed.data;
    callback({
      fromUserId: userId(raw.fromUserId),
      channelId: toChannelId(raw.channelId),
      data: raw.data,
    });
  });
}
