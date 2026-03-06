export enum Opcode {
  /** Server -> Client: heartbeat interval */
  HELLO = 0,
  /** Client -> Server: heartbeat acknowledgement */
  HEARTBEAT = 1,
  /** Client -> Server: session token */
  IDENTIFY = 2,
  /** Server -> Client: user, servers, channels */
  READY = 3,

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

  /** Server -> Client: file expired */
  FILE_EXPIRED = 30,

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

  /** Server -> Client: friend request received */
  FRIEND_REQUEST = 70,
  /** Server -> Client: friend request accepted */
  FRIEND_ACCEPT = 71,
  /** Server -> Client: friend removed */
  FRIEND_REMOVE = 72,

  /** Server -> Client: DM channel created */
  DM_CHANNEL_CREATE = 80,
}
