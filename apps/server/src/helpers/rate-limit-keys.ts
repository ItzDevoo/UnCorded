/** Centralized rate-limit endpoint keys — no more magic strings in routes. */
export const RL = {
  // IP-based (used with checkIpRateLimit)
  AVATAR_UPLOAD: "avatar-up",
  AVATAR_DELETE: "avatar-del",
  PASSWORD: "pwd",
  ACCOUNT_DELETE: "acct-del",
  ACCOUNT_DELETE_CANCEL: "acct-del-cancel",
  PLUGIN_MANIFEST: "plugin-manifest",
  PLUGIN_INSTALL: "plugin-install",
  SERVER_PLUGIN_INSTALL: "server-plugin-install",
  SERVER_PLUGIN_UNINSTALL: "server-plugin-uninstall",
  SERVER_PLUGIN_UPDATE: "server-plugin-update",
  SERVER_PLUGIN_TUNNEL_READ: "server-plugin-tunnel-read",
  INVITE_LOOKUP: "invite-lookup",
  PLUGIN_CHECK_UPDATES: "plugin-check-updates",

  // User-based (used with checkUserRateLimit)
  MESSAGE_CREATE: "messages:create",
  MESSAGE_EDIT: "messages:edit",
  FRIEND_REQUEST: "friends:request",
  FEEDBACK_CREATE: "feedback:create",
  FEEDBACK_VOTE: "feedback:vote",
  POLL_ACTIVE: "poll:active",
  POLL_VOTE: "poll:vote",
  REPORT_CREATE: "report:create",
  SAFETY_CHECK_HASH: "safety:check-hash",
  USER_SEARCH: "users:search",
  DEVELOPER_PLUGIN_SUBMIT: "developer:plugin-submit",
  DEVELOPER_PLUGIN_UPDATE: "developer:plugin-update",
  DEVELOPER_PLUGIN_VERSION_PUSH: "developer:plugin-version-push",
} as const;
