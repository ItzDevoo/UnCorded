// Map of Bridge API endpoint patterns to required permissions
const PERMISSION_MAP: Record<string, string> = {
  "GET /bridge/server": "server.read",
  "GET /bridge/members": "members.read",
  "GET /bridge/channels": "channels.read",
  "GET /bridge/channels/:id/messages": "messages.read",
  "POST /bridge/channels/:id/messages": "messages.send",
  "GET /bridge/users/:id": "users.read",
  "GET /bridge/presence": "presence.read",
  "POST /bridge/notify": "notifications.send",
  "GET /bridge/config": "config.read",
  "PUT /bridge/storage/:key": "storage.write",
  "GET /bridge/storage/:key": "storage.read",
  "DELETE /bridge/storage/:key": "storage.write",
};

export function checkPermission(
  method: string,
  path: string,
  permissions: string[],
): { allowed: boolean; requiredPermission?: string } {
  // Normalize path — replace dynamic segments with :param
  const normalizedPath = path
    .replace(/\/bridge\/channels\/[^/]+\/messages/, "/bridge/channels/:id/messages")
    .replace(/\/bridge\/users\/[^/]+/, "/bridge/users/:id")
    .replace(/\/bridge\/storage\/[^/]+/, "/bridge/storage/:key");

  const key = `${method} ${normalizedPath}`;
  const required = PERMISSION_MAP[key];

  if (!required) {
    // Fail closed — unmapped routes are denied by default
    return { allowed: false, requiredPermission: "unknown (no permission mapping)" };
  }

  if (permissions.includes(required) || permissions.includes("*")) {
    return { allowed: true };
  }

  return { allowed: false, requiredPermission: required };
}
