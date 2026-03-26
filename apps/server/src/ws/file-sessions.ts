import { Opcode } from "@uncorded/protocol";
import type {
  fileSessionCreateRequestSchema,
  fileSessionJoinRequestSchema,
  fileSessionProgressRequestSchema,
  fileSessionCompleteRequestSchema,
  fileSessionCloseRequestSchema,
  fileSessionLeaveRequestSchema,
} from "@uncorded/protocol";
import type { z } from "zod";
import { eq, and, or } from "drizzle-orm";
import { createId } from "@uncorded/shared";
import { db } from "../db/index.js";
import { user, friendships, fileReceipts } from "../db/schema.js";
import { sendToUser } from "./connections.js";

// ── Types ───────────────────────────────────────────────────────────────────

interface FileSession {
  id: string;
  senderId: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string;
  infoHash: string;
  invitees: Set<string>;
  participants: Set<string>;
  completedParticipants: Set<string>;
  createdAt: Date;
}

// ── In-Memory Store ─────────────────────────────────────────────────────────

const activeSessions = new Map<string, FileSession>();

// ── Handlers ────────────────────────────────────────────────────────────────

export async function handleFileSessionCreate(
  senderId: string,
  data: z.infer<typeof fileSessionCreateRequestSchema>,
): Promise<void> {
  // Validate all invitees are accepted friends of sender
  const friendRows = await db
    .select({ usrId: friendships.userId, frdId: friendships.friendId })
    .from(friendships)
    .where(
      and(
        or(eq(friendships.userId, senderId), eq(friendships.friendId, senderId)),
        eq(friendships.status, "accepted"),
      ),
    );

  const friendIds = new Set(
    friendRows.map((r) => (r.usrId === senderId ? r.frdId : r.usrId)),
  );

  const validInvitees = data.invitees.filter((id) => friendIds.has(id));
  if (validInvitees.length === 0) {
    sendToUser(senderId, {
      op: Opcode.ERROR,
      d: { code: "NO_VALID_INVITEES", message: "None of the selected users are your friends" },
    });
    return;
  }

  // Reject if session ID already exists (prevent overwriting another session)
  if (activeSessions.has(data.sessionId)) {
    sendToUser(senderId, {
      op: Opcode.ERROR,
      d: { code: "SESSION_EXISTS", message: "Session ID already in use" },
    });
    return;
  }

  // Store session
  const session: FileSession = {
    id: data.sessionId,
    senderId,
    fileName: data.fileName,
    fileSize: data.fileSize,
    contentType: data.contentType,
    magnetUri: data.magnetUri,
    infoHash: data.infoHash,
    invitees: new Set(validInvitees),
    participants: new Set(),
    completedParticipants: new Set(),
    createdAt: new Date(),
  };
  activeSessions.set(session.id, session);

  // Fetch sender profile for the invite payload
  const [sender] = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    })
    .from(user)
    .where(eq(user.id, senderId))
    .limit(1);

  const invitePayload = {
    sessionId: session.id,
    senderId,
    senderUsername: sender?.username ?? "",
    senderDisplayName: sender?.displayName ?? null,
    senderAvatarUrl: sender?.avatarUrl ?? null,
    fileName: data.fileName,
    fileSize: data.fileSize,
    contentType: data.contentType,
  };

  // Send invite to each online invitee (offline ones are silently skipped)
  for (const inviteeId of validInvitees) {
    sendToUser(inviteeId, { op: Opcode.FILE_SESSION_INVITE, d: invitePayload });
  }
}

export async function handleFileSessionJoin(
  joiningUserId: string,
  data: z.infer<typeof fileSessionJoinRequestSchema>,
): Promise<void> {
  const session = activeSessions.get(data.sessionId);
  if (!session || !session.invitees.has(joiningUserId)) return;

  session.participants.add(joiningUserId);

  // Send magnetUri to the joining recipient so they can start downloading
  sendToUser(joiningUserId, {
    op: Opcode.FILE_SESSION_JOIN,
    d: { sessionId: session.id, magnetUri: session.magnetUri },
  });

  // Fetch joining user's profile for the sender notification
  const [joiner] = await db
    .select({
      id: user.id,
      username: user.username,
      displayName: user.displayName,
      avatarUrl: user.avatarUrl,
    })
    .from(user)
    .where(eq(user.id, joiningUserId))
    .limit(1);

  // Notify sender that a user joined
  sendToUser(session.senderId, {
    op: Opcode.FILE_SESSION_JOINED,
    d: {
      sessionId: session.id,
      userId: joiningUserId,
      username: joiner?.username ?? "",
      displayName: joiner?.displayName ?? null,
      avatarUrl: joiner?.avatarUrl ?? null,
    },
  });
}

export function handleFileSessionProgress(
  reportingUserId: string,
  data: z.infer<typeof fileSessionProgressRequestSchema>,
): void {
  const session = activeSessions.get(data.sessionId);
  if (!session || !session.participants.has(reportingUserId)) return;

  sendToUser(session.senderId, {
    op: Opcode.FILE_SESSION_PROGRESS,
    d: {
      sessionId: session.id,
      userId: reportingUserId,
      progress: data.progress,
      speed: data.speed,
    },
  });
}

export async function handleFileSessionComplete(
  reportingUserId: string,
  data: z.infer<typeof fileSessionCompleteRequestSchema>,
): Promise<void> {
  const session = activeSessions.get(data.sessionId);
  if (!session || !session.participants.has(reportingUserId)) return;

  // Dedupe: skip if already completed
  if (session.completedParticipants.has(reportingUserId)) return;
  session.completedParticipants.add(reportingUserId);

  // Create file receipt before notifying sender (so receipt exists if notification succeeds)
  try {
    await db.insert(fileReceipts).values({
      id: createId(),
      channelId: null,
      senderId: session.senderId,
      receiverId: reportingUserId,
      fileName: session.fileName,
      fileSize: session.fileSize,
      contentType: session.contentType,
      magnetUri: session.magnetUri,
      infoHash: session.infoHash,
      messageId: null,
    });
  } catch (err) {
    console.error(
      `[file-sessions] Failed to insert receipt: session=${session.id} sender=${session.senderId} receiver=${reportingUserId} file=${session.fileName}`,
      err instanceof Error ? err.message : err,
    );
    // Still notify sender — the transfer succeeded even if the receipt failed
  }

  // Forward to sender
  sendToUser(session.senderId, {
    op: Opcode.FILE_SESSION_COMPLETE,
    d: { sessionId: session.id, userId: reportingUserId },
  });
}

export function handleFileSessionClose(
  senderId: string,
  data: z.infer<typeof fileSessionCloseRequestSchema>,
): void {
  const session = activeSessions.get(data.sessionId);
  if (!session || session.senderId !== senderId) return;

  // Notify all participants
  for (const participantId of session.participants) {
    sendToUser(participantId, {
      op: Opcode.FILE_SESSION_CLOSE,
      d: { sessionId: session.id },
    });
  }

  // Also notify invited-but-not-joined users
  for (const inviteeId of session.invitees) {
    if (!session.participants.has(inviteeId)) {
      sendToUser(inviteeId, {
        op: Opcode.FILE_SESSION_CLOSE,
        d: { sessionId: session.id },
      });
    }
  }

  activeSessions.delete(session.id);
}

export function handleFileSessionLeave(
  leavingUserId: string,
  data: z.infer<typeof fileSessionLeaveRequestSchema>,
): void {
  const session = activeSessions.get(data.sessionId);
  if (!session || !session.participants.has(leavingUserId)) return;

  session.participants.delete(leavingUserId);

  sendToUser(session.senderId, {
    op: Opcode.FILE_SESSION_LEAVE,
    d: { sessionId: session.id, userId: leavingUserId },
  });
}

/** Called on WebSocket close — cleanup all sessions involving the disconnecting user. */
export function cleanupSessionsForUser(disconnectedUserId: string): void {
  for (const [sessionId, session] of activeSessions) {
    if (session.senderId === disconnectedUserId) {
      // Sender disconnected — close session for everyone
      for (const participantId of session.participants) {
        sendToUser(participantId, {
          op: Opcode.FILE_SESSION_CLOSE,
          d: { sessionId },
        });
      }
      for (const inviteeId of session.invitees) {
        if (!session.participants.has(inviteeId)) {
          sendToUser(inviteeId, {
            op: Opcode.FILE_SESSION_CLOSE,
            d: { sessionId },
          });
        }
      }
      activeSessions.delete(sessionId);
    } else {
      // Recipient disconnected — notify sender, remove from participants
      // but keep in invitees so they can rejoin if they reconnect
      if (session.participants.has(disconnectedUserId)) {
        session.participants.delete(disconnectedUserId);
        sendToUser(session.senderId, {
          op: Opcode.FILE_SESSION_LEAVE,
          d: { sessionId, userId: disconnectedUserId },
        });
      }
    }
  }
}
