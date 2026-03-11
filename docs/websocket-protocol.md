# WebSocket Protocol

Binary MessagePack frames only. Each frame: { op: number, d: unknown }
Reference: C:\Nexis\packages\protocol\src\opcodes.ts for implementation.

## Opcodes

| Op  | Event                        | Direction                            |
| --- | ---------------------------- | ------------------------------------ |
| 0   | HELLO (heartbeat interval)   | Server -> Client                     |
| 1   | HEARTBEAT                    | Client -> Server                     |
| 2   | IDENTIFY (session token)     | Client -> Server                     |
| 3   | READY (user, servers, chans) | Server -> Client                     |
| 10  | MESSAGE_CREATE               | Both                                 |
| 11  | MESSAGE_UPDATE               | Both                                 |
| 12  | MESSAGE_DELETE               | Both                                 |
| 13  | TYPING_START                 | Both                                 |
| 20  | PRESENCE_UPDATE              | Both                                 |
| 30  | WEBRTC_OFFER                 | Client -> Server (forwarded to peer) |
| 31  | WEBRTC_ANSWER                | Client -> Server (forwarded to peer) |
| 32  | WEBRTC_ICE_CANDIDATE         | Client -> Server (forwarded to peer) |
| 33  | FILE_SHARE                   | Both                                 |
| 34  | FILE_AVAILABILITY_UPDATE     | Both                                 |
| 40  | CHANNEL_CREATE               | Server -> Client                     |
| 41  | CHANNEL_UPDATE               | Server -> Client                     |
| 42  | CHANNEL_DELETE               | Server -> Client                     |
| 50  | MEMBER_ADD                   | Server -> Client                     |
| 51  | MEMBER_REMOVE                | Server -> Client                     |
| 60  | SERVER_CREATE                | Server -> Client                     |
| 61  | SERVER_DELETE                | Server -> Client                     |
| 70  | FRIEND_REQUEST               | Server -> Client                     |
| 71  | FRIEND_ACCEPT                | Server -> Client                     |
| 72  | FRIEND_REMOVE                | Server -> Client                     |
| 80  | DM_CHANNEL_CREATE            | Server -> Client                     |
| 99  | ERROR                        | Server -> Client                     |

## Lifecycle

1. Client connects to /gateway
2. Server sends HELLO with heartbeat interval (30000ms)
3. Client sends IDENTIFY with session token
4. Server validates session, sends READY with full user payload
5. Client sends HEARTBEAT every 30s
6. Server drops connection after 45s with no heartbeat

## WebRTC Signaling (ops 30-32)

The WS gateway acts as a signaling relay for WebRTC peer connections (used by WebTorrent).
These opcodes forward SDP offers/answers and ICE candidates between peers.
The server NEVER inspects the content — it just routes by target userId.

Payload for all three:

- { targetUserId: string, channelId: string, data: unknown }
- Server looks up targetUserId in the connection registry and forwards the frame
- If target is offline, the frame is dropped (P2P requires both peers online)

## FILE_SHARE (op 33)

Sent when a user shares a file in a channel or DM.
Payload: { channelId: string, fileReceiptId: string, fileName: string, fileSize: number, magnetUri: string, infoHash: string }
Server stores the file_receipt record and broadcasts to channel members.
The magnetUri allows any peer to join the torrent swarm and download.

## FILE_AVAILABILITY_UPDATE (op 34)

Sent by clients to indicate seeding status for a file.
Payload: { fileReceiptId: string, channelId: string, available: boolean }
Server broadcasts to channel members so UI can show "X seeders" or "No seeders online."

## MEMBER_ADD (op 50)

Sent to all server members (except the joiner) when a new member joins.
Payload: { serverId: string, user: { id: string, username: string | null, displayName: string | null, avatarUrl: string | null } }
Triggered by invite accept (REST POST /api/invites/:code/accept).

## MEMBER_REMOVE (op 51)

Sent to remaining server members when a member leaves or is kicked.
Payload: { serverId: string, userId: string }
Triggered by REST DELETE /api/servers/:serverId/members/@me (leave) or DELETE /api/servers/:serverId/members/:userId (kick).

## SERVER_CREATE (op 60)

Sent to the joining user when they accept an invite.
Payload: { server: { id, name, iconUrl, ownerId }, channels: [{ id, serverId, name, type, position, topic, fileSharingEnabled }] }
Triggered by invite accept. The client uses this to add the server to the sidebar without re-fetching.

## SERVER_DELETE (op 61)

Sent when a server is deleted (to all members), or when a user leaves/is kicked (to that user only).
Payload: { id: string }
On delete: broadcast to all members before DB delete. On leave/kick: sent to the departing user so their client removes the server.

## FRIEND_REQUEST (op 70)

Sent to target user when someone sends a friend request.
Payload: { userId: string, username: string | null, displayName: string | null, avatarUrl: string | null, status: string }
Triggered by REST POST /api/friends/request.

## FRIEND_ACCEPT (op 71)

Sent to both users when a friend request is accepted.
Payload: { userId: string, username: string | null, displayName: string | null, avatarUrl: string | null, status: string }
The userId is the OTHER user (the peer whose friendship was accepted).
Triggered by REST POST /api/friends/:userId/accept or auto-accept on mutual request.

## FRIEND_REMOVE (op 72)

Sent to the other user when a friend is removed or blocked.
Payload: { userId: string }
Triggered by REST DELETE /api/friends/:userId or POST /api/friends/:userId/block.

## DM_CHANNEL_CREATE (op 80)

Sent to both users when a new DM channel is created.
Payload: { id: string, otherUser: { id: string, username: string | null, displayName: string | null, avatarUrl: string | null, status: string } }
Each user receives a different payload — otherUser is the PEER, not self.
Triggered by REST POST /api/dms.
