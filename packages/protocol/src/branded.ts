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
export type PluginId = Brand<string, "PluginId">;

// Cast constructors (brand raw strings at application boundaries)
function assertNonEmpty(raw: string, label: string): void {
  if (!raw) throw new Error(`${label} must not be empty`);
}

export function userId(raw: string): UserId {
  assertNonEmpty(raw, "UserId");
  return raw as UserId;
}
export function serverId(raw: string): ServerId {
  assertNonEmpty(raw, "ServerId");
  return raw as ServerId;
}
export function channelId(raw: string): ChannelId {
  assertNonEmpty(raw, "ChannelId");
  return raw as ChannelId;
}
export function messageId(raw: string): MessageId {
  assertNonEmpty(raw, "MessageId");
  return raw as MessageId;
}
export function inviteCode(raw: string): InviteCode {
  assertNonEmpty(raw, "InviteCode");
  return raw as InviteCode;
}
export function fileReceiptId(raw: string): FileReceiptId {
  assertNonEmpty(raw, "FileReceiptId");
  return raw as FileReceiptId;
}
export function dmChannelId(raw: string): DmChannelId {
  assertNonEmpty(raw, "DmChannelId");
  return raw as DmChannelId;
}
export function subscriptionId(raw: string): SubscriptionId {
  assertNonEmpty(raw, "SubscriptionId");
  return raw as SubscriptionId;
}
export function reportId(raw: string): ReportId {
  assertNonEmpty(raw, "ReportId");
  return raw as ReportId;
}
export function roleId(raw: string): RoleId {
  assertNonEmpty(raw, "RoleId");
  return raw as RoleId;
}
export function pluginId(raw: string): PluginId {
  assertNonEmpty(raw, "PluginId");
  return raw as PluginId;
}
