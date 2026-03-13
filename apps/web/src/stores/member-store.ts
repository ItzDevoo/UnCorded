import { createStore, produce } from "solid-js/store";
import { Opcode, userId, memberAddEventSchema, memberRemoveEventSchema } from "@uncorded/protocol";
import type { ServerId, UserId } from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { api } from "../lib/api.js";

// ── Types ───────────────────────────────────────────────────────────────────

export interface Member {
  userId: UserId;
  nickname: string | null;
  joinedAt: string;
  username: string | null;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  online: boolean;
}

interface MemberStoreState {
  /** serverId -> member list */
  members: Record<string, Member[]>;
  /** serverId -> loading flag */
  loading: Record<string, boolean>;
}

// ── Store ───────────────────────────────────────────────────────────────────

const [store, setStore] = createStore<MemberStoreState>({
  members: {},
  loading: {},
});

// ── Public API ──────────────────────────────────────────────────────────────

export async function fetchMembers(sId: ServerId): Promise<void> {
  const key = sId as string;
  if (store.loading[key]) return;

  setStore("loading", key, true);
  try {
    const res = await api<{ members: Member[]; hasMore: boolean }>(
      `/api/servers/${sId}/members?limit=100`,
    );
    setStore("members", key, res.members);
  } catch (err) {
    if (import.meta.env.DEV) console.error("[member-store] Failed to fetch members:", err);
  } finally {
    setStore("loading", key, false);
  }
}

export function getMembers(sId: ServerId): Member[] {
  return store.members[sId as string] ?? [];
}

export function getMembersLoading(sId: ServerId): boolean {
  return store.loading[sId as string] ?? false;
}

// ── WS listener unsub refs ──────────────────────────────────────────────────

let unsubAdd: (() => void) | null = null;
let unsubRemove: (() => void) | null = null;

function teardown() {
  unsubAdd?.();
  unsubRemove?.();
  unsubAdd = null;
  unsubRemove = null;
}

export function setupMemberStore(): void {
  teardown();

  unsubAdd = onGatewayEvent(Opcode.MEMBER_ADD, (data) => {
    const parsed = memberAddEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    const sId = d.serverId as string;

    // Only update if we have this server's members cached
    if (!store.members[sId]) return;

    setStore(
      "members",
      sId,
      produce((arr) => {
        if (arr.some((m) => m.userId === userId(d.user.id))) return;
        arr.push({
          userId: userId(d.user.id),
          nickname: null,
          joinedAt: new Date().toISOString(),
          username: d.user.username,
          displayName: d.user.displayName,
          avatarUrl: d.user.avatarUrl,
          status: "online",
          online: true,
        });
      }),
    );
  });

  unsubRemove = onGatewayEvent(Opcode.MEMBER_REMOVE, (data) => {
    const parsed = memberRemoveEventSchema.safeParse(data);
    if (!parsed.success) return;
    const d = parsed.data;
    const sId = d.serverId as string;

    if (!store.members[sId]) return;

    setStore(
      "members",
      sId,
      produce((arr) => {
        const idx = arr.findIndex((m) => m.userId === userId(d.userId));
        if (idx !== -1) arr.splice(idx, 1);
      }),
    );
  });
}

// ── HMR cleanup ─────────────────────────────────────────────────────────────

if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    teardown();
  });
}
