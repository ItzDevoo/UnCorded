# WebSocket Protocol

Binary MessagePack frames only. Each frame: { op: number, d: unknown }
Reference: C:\Nexis\packages\protocol\src\opcodes.ts for implementation.

## Opcodes

| Op | Event                        | Direction       |
|----|------------------------------|-----------------|
| 0  | HELLO (heartbeat interval)   | Server -> Client |
| 1  | HEARTBEAT                    | Client -> Server |
| 2  | IDENTIFY (session token)     | Client -> Server |
| 3  | READY (user, servers, chans) | Server -> Client |
| 10 | MESSAGE_CREATE               | Both            |
| 11 | MESSAGE_UPDATE               | Both            |
| 12 | MESSAGE_DELETE               | Both            |
| 13 | TYPING_START                 | Both            |
| 20 | PRESENCE_UPDATE              | Both            |
| 30 | WEBRTC_OFFER                 | Client -> Server (forwarded to peer) |
| 31 | WEBRTC_ANSWER                | Client -> Server (forwarded to peer) |
| 32 | WEBRTC_ICE_CANDIDATE         | Client -> Server (forwarded to peer) |
| 33 | FILE_SHARE                   | Both            |
| 34 | FILE_AVAILABILITY_UPDATE     | Both            |
| 40 | CHANNEL_CREATE/UPDATE/DELETE | Server -> Client |
| 50 | MEMBER_ADD/REMOVE            | Server -> Client |
| 60 | SERVER_CREATE/DELETE          | Server -> Client |
| 70 | FRIEND_REQUEST/ACCEPT/REMOVE | Server -> Client |
| 80 | DM_CHANNEL_CREATE            | Server -> Client |

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
