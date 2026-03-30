import {
  serverId,
  userId,
  channelId,
  inviteCode,
  type ServerId,
  type UserId,
  type ChannelId,
  type InviteCode,
} from "@uncorded/protocol";

/** Brand a server row's `id` and `ownerId` fields. */
export function brandServer<T extends { id: string; ownerId: string }>(
  row: T,
): Omit<T, "id" | "ownerId"> & { id: ServerId; ownerId: UserId } {
  return { ...row, id: serverId(row.id), ownerId: userId(row.ownerId) };
}

/** Brand a channel row's `id` and `serverId` fields. */
export function brandChannel<T extends { id: string; serverId: string }>(
  row: T,
): Omit<T, "id" | "serverId"> & { id: ChannelId; serverId: ServerId } {
  return { ...row, id: channelId(row.id), serverId: serverId(row.serverId) };
}

/** Brand an invite row's `code`, `serverId`, and optional `creatorId` fields. */
export function brandInvite<T extends { code: string; serverId: string; creatorId: string | null }>(
  row: T,
): Omit<T, "code" | "serverId" | "creatorId"> & {
  code: InviteCode;
  serverId: ServerId;
  creatorId: UserId | null;
} {
  return {
    ...row,
    code: inviteCode(row.code),
    serverId: serverId(row.serverId),
    creatorId: row.creatorId ? userId(row.creatorId) : null,
  };
}
