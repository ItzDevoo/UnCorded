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
