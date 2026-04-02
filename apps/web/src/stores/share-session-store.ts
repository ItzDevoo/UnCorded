import { createSignal } from "solid-js";
import { createStore, produce } from "solid-js/store";
import { Opcode } from "@uncorded/protocol";
import { createId } from "@uncorded/shared";
import { onGatewayEvent, sendFrame } from "../lib/gateway.js";
import { readyData } from "../lib/gateway-store.js";
import { seedFile, downloadFromMagnet, stopSeeding } from "../lib/torrent-client.js";
import { computePdqHash } from "../lib/pdq-hash.js";
import { api, ApiRequestError } from "../lib/api.js";
import { showToast } from "../components/ui/toast.js";
import { ensureP2pAcknowledged } from "./file-store.js";
import {
  fileSessionInviteEventSchema,
  fileSessionJoinAcceptEventSchema,
  fileSessionJoinedEventSchema,
  fileSessionProgressEventSchema,
  fileSessionCompleteEventSchema,
  fileSessionCloseEventSchema,
  fileSessionLeaveEventSchema,
} from "@uncorded/protocol";

// ── Types ───────────────────────────────────────────────────────────────────

export interface ParticipantInfo {
  userId: string;
  username: string;
  displayName: string | null;
  avatarUrl: string | null;
  progress: number;
  speed: number;
  status: "invited" | "joined" | "downloading" | "complete" | "error";
}

export interface ShareSession {
  id: string;
  role: "sender" | "receiver";
  fileName: string;
  fileSize: number;
  contentType: string;
  magnetUri: string | null;
  infoHash: string | null;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
  invitees: string[];
  participants: Record<string, ParticipantInfo>;
  status: "selecting" | "sharing" | "complete" | "closed";
  downloadedFile: File | null;
  receiverProgress: number;
  receiverSpeed: number;
}

interface ShareSessionStoreState {
  sessions: Record<string, ShareSession>;
}

// ── Store ───────────────────────────────────────────────────────────────────

const [store, setStore] = createStore<ShareSessionStoreState>({
  sessions: {},
});

// Track download versions to ignore stale callbacks after leave/close
const downloadVersions = new Map<string, number>();

function nextDownloadVersion(sessionId: string): number {
  const v = (downloadVersions.get(sessionId) ?? 0) + 1;
  downloadVersions.set(sessionId, v);
  return v;
}

function isCurrentDownload(sessionId: string, version: number): boolean {
  return downloadVersions.get(sessionId) === version;
}

// Active sender session signal (only one at a time)
const [activeSenderSessionId, setActiveSenderSessionId] = createSignal<string | null>(null);
// Active receiver session signal
const [activeReceiverSessionId, setActiveReceiverSessionId] = createSignal<string | null>(null);
// Pending invite for toast interaction
const [pendingInvite, setPendingInvite] = createSignal<{
  sessionId: string;
  senderId: string;
  senderUsername: string;
  senderDisplayName: string | null;
  senderAvatarUrl: string | null;
  fileName: string;
  fileSize: number;
  contentType: string;
} | null>(null);

export { activeSenderSessionId, activeReceiverSessionId, pendingInvite };

export function getSession(sessionId: string): ShareSession | undefined {
  return store.sessions[sessionId];
}

export function clearReceiverSession(): void {
  setActiveReceiverSessionId(null);
}

// ── Sender Actions ──────────────────────────────────────────────────────────

export async function createSession(file: File, inviteeIds: string[]): Promise<string> {
  await ensureP2pAcknowledged();

  // CSAM hash check for images
  const hash = await computePdqHash(file);
  if (hash !== null) {
    try {
      const res = await api<{ blocked: boolean }>("/api/safety/check-hash", {
        method: "POST",
        body: JSON.stringify({ hash }),
      });
      if (res.blocked) {
        showToast("This file cannot be shared", "error");
        throw new Error("File blocked by safety check");
      }
    } catch (err) {
      if (err instanceof ApiRequestError) {
        showToast("Safety check failed", "error");
        throw err;
      }
      if (err instanceof Error && err.message === "File blocked by safety check") {
        throw err;
      }
    }
  }

  // Seed via WebTorrent
  const seedResult = await seedFile(file);

  const sessionId = createId();
  const currentUser = readyData.data?.user;

  const session: ShareSession = {
    id: sessionId,
    role: "sender",
    fileName: file.name,
    fileSize: file.size,
    contentType: file.type || "application/octet-stream",
    magnetUri: seedResult.magnetUri,
    infoHash: seedResult.infoHash,
    senderId: currentUser?.id ?? "",
    senderUsername: currentUser?.username ?? "",
    senderDisplayName: currentUser?.displayName ?? null,
    senderAvatarUrl: currentUser?.avatarUrl ?? null,
    invitees: inviteeIds,
    participants: {},
    status: "sharing",
    downloadedFile: null,
    receiverProgress: 0,
    receiverSpeed: 0,
  };

  // Pre-populate invitees as "invited" participants so they show in visualization
  const friends = readyData.data?.friends ?? [];
  for (const inviteeId of inviteeIds) {
    const friend = friends.find((f) => f.userId === inviteeId);
    session.participants[inviteeId] = {
      userId: inviteeId,
      username: friend?.username ?? "",
      displayName: friend?.displayName ?? null,
      avatarUrl: friend?.avatarUrl ?? null,
      progress: 0,
      speed: 0,
      status: "invited",
    };
  }

  setStore("sessions", sessionId, session);
  setActiveSenderSessionId(sessionId);

  // Send to server
  sendFrame({
    op: Opcode.FILE_SESSION_CREATE,
    d: {
      sessionId,
      fileName: file.name,
      fileSize: file.size,
      contentType: file.type || "application/octet-stream",
      magnetUri: seedResult.magnetUri,
      infoHash: seedResult.infoHash,
      invitees: inviteeIds,
    },
  });

  return sessionId;
}

export function closeSession(sessionId: string): void {
  const session = store.sessions[sessionId];
  if (!session) return;

  // Stop seeding
  if (session.infoHash) {
    stopSeeding(session.infoHash);
  }

  sendFrame({
    op: Opcode.FILE_SESSION_CLOSE,
    d: { sessionId },
  });

  setStore("sessions", sessionId, "status", "closed");
  if (activeSenderSessionId() === sessionId) {
    setActiveSenderSessionId(null);
  }
}

// ── Receiver Actions ────────────────────────────────────────────────────────

export function joinSession(sessionId: string): void {
  const session = store.sessions[sessionId];
  if (!session) return;

  sendFrame({
    op: Opcode.FILE_SESSION_JOIN,
    d: { sessionId },
  });

  setActiveReceiverSessionId(sessionId);
  setPendingInvite(null);
}

export function dismissInvite(): void {
  setPendingInvite(null);
}

export function leaveSession(sessionId: string): void {
  const session = store.sessions[sessionId];
  if (!session) return;

  // Invalidate any in-flight download callbacks
  nextDownloadVersion(sessionId);

  sendFrame({
    op: Opcode.FILE_SESSION_LEAVE,
    d: { sessionId },
  });

  setStore("sessions", sessionId, "status", "closed");
  if (activeReceiverSessionId() === sessionId) {
    setActiveReceiverSessionId(null);
  }
}

// ── Progress Throttling ─────────────────────────────────────────────────────

let lastProgressSent = 0;
const PROGRESS_THROTTLE_MS = 500;

function sendProgressThrottled(sessionId: string, progress: number, speed: number): void {
  const now = Date.now();
  if (now - lastProgressSent < PROGRESS_THROTTLE_MS) return;
  lastProgressSent = now;

  sendFrame({
    op: Opcode.FILE_SESSION_PROGRESS,
    d: { sessionId, progress, speed },
  });
}

// ── Save Downloaded File ────────────────────────────────────────────────────

export function saveReceivedFile(sessionId: string): void {
  const session = store.sessions[sessionId];
  if (!session?.downloadedFile) return;

  const url = URL.createObjectURL(session.downloadedFile);
  const a = document.createElement("a");
  a.href = url;
  a.download = session.downloadedFile.name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ── WS Listener Setup ──────────────────────────────────────────────────────

let unsubs: Array<() => void> = [];

function teardown() {
  for (const unsub of unsubs) unsub();
  unsubs = [];
}

export function setupShareSessionStore(): void {
  teardown();

  // Incoming invite (we're a recipient)
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_INVITE, (data) => {
      const parsed = fileSessionInviteEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      // Create a receiver session entry
      setStore("sessions", d.sessionId, {
        id: d.sessionId,
        role: "receiver",
        fileName: d.fileName,
        fileSize: d.fileSize,
        contentType: d.contentType,
        magnetUri: null,
        infoHash: null,
        senderId: d.senderId,
        senderUsername: d.senderUsername,
        senderDisplayName: d.senderDisplayName,
        senderAvatarUrl: d.senderAvatarUrl,
        invitees: [],
        participants: {},
        status: "sharing",
        downloadedFile: null,
        receiverProgress: 0,
        receiverSpeed: 0,
      });

      // Set pending invite for the toast
      setPendingInvite({
        sessionId: d.sessionId,
        senderId: d.senderId,
        senderUsername: d.senderUsername,
        senderDisplayName: d.senderDisplayName,
        senderAvatarUrl: d.senderAvatarUrl,
        fileName: d.fileName,
        fileSize: d.fileSize,
        contentType: d.contentType,
      });
    }),
  );

  // Join accepted — server sends us the magnetUri to start downloading
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_JOIN, (data) => {
      const parsed = fileSessionJoinAcceptEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      const session = store.sessions[d.sessionId];
      if (!session || session.role !== "receiver") return;

      setStore("sessions", d.sessionId, "magnetUri", d.magnetUri);

      // Track version so stale callbacks after leave/close are ignored
      const version = nextDownloadVersion(d.sessionId);

      // Start downloading via WebTorrent
      downloadFromMagnet(d.magnetUri, (progress, speed) => {
        if (!isCurrentDownload(d.sessionId, version)) return;
        setStore("sessions", d.sessionId, "receiverProgress", progress);
        setStore("sessions", d.sessionId, "receiverSpeed", speed);
        sendProgressThrottled(d.sessionId, progress, speed);
      })
        .then((files) => {
          if (!isCurrentDownload(d.sessionId, version)) return;
          const file = files[0];
          if (file) {
            setStore("sessions", d.sessionId, "downloadedFile", file);
          }
          setStore("sessions", d.sessionId, "receiverProgress", 1);
          setStore("sessions", d.sessionId, "status", "complete");

          // Report complete to server
          sendFrame({
            op: Opcode.FILE_SESSION_COMPLETE,
            d: { sessionId: d.sessionId },
          });
        })
        .catch((err) => {
          if (!isCurrentDownload(d.sessionId, version)) return;
          if (import.meta.env.DEV) console.error("[share-session] Download error:", err);
          setStore("sessions", d.sessionId, "status", "closed");
        });
    }),
  );

  // Sender receives: someone joined
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_JOINED, (data) => {
      const parsed = fileSessionJoinedEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      const session = store.sessions[d.sessionId];
      if (!session || session.role !== "sender") return;

      setStore("sessions", d.sessionId, "participants", d.userId, {
        userId: d.userId,
        username: d.username,
        displayName: d.displayName,
        avatarUrl: d.avatarUrl,
        progress: 0,
        speed: 0,
        status: "downloading",
      });
    }),
  );

  // Sender receives: progress from a participant
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_PROGRESS, (data) => {
      const parsed = fileSessionProgressEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      const session = store.sessions[d.sessionId];
      if (!session || session.role !== "sender") return;
      if (!session.participants[d.userId]) return;

      setStore("sessions", d.sessionId, "participants", d.userId, "progress", d.progress);
      setStore("sessions", d.sessionId, "participants", d.userId, "speed", d.speed);
    }),
  );

  // Sender receives: participant completed download
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_COMPLETE, (data) => {
      const parsed = fileSessionCompleteEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      const session = store.sessions[d.sessionId];
      if (!session || session.role !== "sender") return;
      if (!session.participants[d.userId]) return;

      setStore("sessions", d.sessionId, "participants", d.userId, "status", "complete");
      setStore("sessions", d.sessionId, "participants", d.userId, "progress", 1);

      // Check if all participants are complete
      const allDone = Object.values(store.sessions[d.sessionId]?.participants ?? {}).every(
        (p) => p.status === "complete" || p.status === "invited",
      );
      if (allDone) {
        setStore("sessions", d.sessionId, "status", "complete");
      }
    }),
  );

  // Session closed (by sender or sender disconnect)
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_CLOSE, (data) => {
      const parsed = fileSessionCloseEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      const session = store.sessions[d.sessionId];
      if (!session) return;

      // Invalidate in-flight download callbacks
      nextDownloadVersion(d.sessionId);

      setStore("sessions", d.sessionId, "status", "closed");

      // Clear invite if it was still pending
      if (pendingInvite()?.sessionId === d.sessionId) {
        setPendingInvite(null);
      }
    }),
  );

  // Sender receives: participant left
  unsubs.push(
    onGatewayEvent(Opcode.FILE_SESSION_LEAVE, (data) => {
      const parsed = fileSessionLeaveEventSchema.safeParse(data);
      if (!parsed.success) return;
      const d = parsed.data;

      const session = store.sessions[d.sessionId];
      if (!session || session.role !== "sender") return;

      setStore(
        "sessions",
        d.sessionId,
        "participants",
        produce((participants) => {
          delete participants[d.userId];
        }),
      );
    }),
  );
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
