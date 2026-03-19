export enum Opcode {
  /** Server -> Client: heartbeat interval */
  HELLO = 0,
  /** Client -> Server: heartbeat acknowledgement */
  HEARTBEAT = 1,
  /** Client -> Server: session token */
  IDENTIFY = 2,
  /** Server -> Client: user, servers, channels */
  READY = 3,
  /** Server -> Client: heartbeat acknowledged */
  HEARTBEAT_ACK = 4,

  /** Both: new message */
  MESSAGE_CREATE = 10,
  /** Both: edited message */
  MESSAGE_UPDATE = 11,
  /** Both: deleted message */
  MESSAGE_DELETE = 12,
  /** Both: user started typing */
  TYPING_START = 13,

  /** Both: presence change */
  PRESENCE_UPDATE = 20,

  /** Client -> Server: WebRTC SDP offer for P2P connection */
  WEBRTC_OFFER = 30,
  /** Client -> Server: WebRTC SDP answer in response to offer */
  WEBRTC_ANSWER = 31,
  /** Client -> Server: WebRTC ICE candidate for NAT traversal */
  WEBRTC_ICE_CANDIDATE = 32,
  /** Client -> Server: file shared via P2P (stores receipt, broadcasts to channel) */
  FILE_SHARE = 33,
  /** Client -> Server: seeder availability changed for a file */
  FILE_AVAILABILITY_UPDATE = 34,

  /** Server -> Client: channel created */
  CHANNEL_CREATE = 40,
  /** Server -> Client: channel updated */
  CHANNEL_UPDATE = 41,
  /** Server -> Client: channel deleted */
  CHANNEL_DELETE = 42,

  /** Server -> Client: member added */
  MEMBER_ADD = 50,
  /** Server -> Client: member removed */
  MEMBER_REMOVE = 51,

  /** Server -> Client: server created */
  SERVER_CREATE = 60,
  /** Server -> Client: server deleted */
  SERVER_DELETE = 61,
  /** Server -> Client: server updated (name, icon, owner) */
  SERVER_UPDATE = 62,

  /** Server -> Client: friend request received */
  FRIEND_REQUEST = 70,
  /** Server -> Client: friend request accepted */
  FRIEND_ACCEPT = 71,
  /** Server -> Client: friend removed */
  FRIEND_REMOVE = 72,

  /** Server -> Client: DM channel created */
  DM_CHANNEL_CREATE = 80,

  /** Server -> Client: subscription tier was gifted */
  SUBSCRIPTION_GIFT = 85,

  /** Server -> Client: error notification (e.g., tier restriction) */
  ERROR = 99,
}
