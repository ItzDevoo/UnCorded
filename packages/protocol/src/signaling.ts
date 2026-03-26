import type { UserId, ChannelId, FileReceiptId } from "./branded.js";

export interface WebRtcSignalPayload {
  targetUserId: UserId;
  channelId: ChannelId;
  /** SDP offer/answer or ICE candidate — opaque to server */
  data: unknown;
}

/** What the client sends when sharing a file */
export interface FileShareRequest {
  channelId: ChannelId;
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string;
  infoHash: string;
}

/** What the server broadcasts to channel members */
export interface FileShareBroadcast {
  senderId: UserId;
  fileReceiptId: FileReceiptId;
  channelId: ChannelId;
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string;
  infoHash: string;
}

export interface FileAvailabilityPayload {
  fileReceiptId: FileReceiptId;
  channelId: ChannelId;
  available: boolean;
}

// ── File Share Session Payloads ─────────────────────────────────────────────

/** Sender -> Server: create a share session */
export interface FileSessionCreatePayload {
  sessionId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string;
  infoHash: string;
  invitees: UserId[];
}

/** Server -> Recipients: invitation to a share session */
export interface FileSessionInvitePayload {
  sessionId: string;
  senderId: UserId;
  senderUsername: string;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
}

/** Recipient -> Server: joining a session */
export interface FileSessionJoinPayload {
  sessionId: string;
}

/** Server -> Recipient: magnetUri to start downloading */
export interface FileSessionJoinAcceptPayload {
  sessionId: string;
  magnetUri: string;
}

/** Server -> Sender: a user joined the session */
export interface FileSessionJoinedPayload {
  sessionId: string;
  userId: UserId;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
}

/** Recipient -> Server -> Sender: download progress */
export interface FileSessionProgressPayload {
  sessionId: string;
  userId: UserId;
  progress: number;
  speed: number;
}

/** Recipient -> Server -> Sender: download complete */
export interface FileSessionCompletePayload {
  sessionId: string;
  userId: UserId;
}

/** Sender -> Server -> All: session ended */
export interface FileSessionClosePayload {
  sessionId: string;
}

/** Recipient -> Server -> Sender: user left the session */
export interface FileSessionLeavePayload {
  sessionId: string;
  userId: UserId;
}
