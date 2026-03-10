type Brand<T, B extends string> = T & { readonly __brand: B };

export type UserId = Brand<string, "UserId">;
export type ServerId = Brand<string, "ServerId">;
export type ChannelId = Brand<string, "ChannelId">;
export type MessageId = Brand<string, "MessageId">;
export type InviteCode = Brand<string, "InviteCode">;
export type FileReceiptId = Brand<string, "FileReceiptId">;
export type DmChannelId = Brand<string, "DmChannelId">;
/** Union type for any channel ID (server channel or DM channel) */
export type AnyChannelId = ChannelId | DmChannelId;
export type SubscriptionId = Brand<string, "SubscriptionId">;
export type ReportId = Brand<string, "ReportId">;
export type RoleId = Brand<string, "RoleId">;

// Cast constructors (brand raw strings at application boundaries)
export function userId(raw: string): UserId {
  return raw as UserId;
}
export function serverId(raw: string): ServerId {
  return raw as ServerId;
}
export function channelId(raw: string): ChannelId {
  return raw as ChannelId;
}
export function messageId(raw: string): MessageId {
  return raw as MessageId;
}
export function inviteCode(raw: string): InviteCode {
  return raw as InviteCode;
}
export function fileReceiptId(raw: string): FileReceiptId {
  return raw as FileReceiptId;
}
export function dmChannelId(raw: string): DmChannelId {
  return raw as DmChannelId;
}
export function subscriptionId(raw: string): SubscriptionId {
  return raw as SubscriptionId;
}
export function reportId(raw: string): ReportId {
  return raw as ReportId;
}
export function roleId(raw: string): RoleId {
  return raw as RoleId;
}
