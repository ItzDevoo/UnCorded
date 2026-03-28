import type { ResourceLimits } from "../docker/manager";

export interface PluginManifest {
  id: string;
  name: string;
  version: string;
  description: string;
  author: string;
  icon?: string | undefined;
  repository?: string | undefined;
  license?: string | undefined;

  // Runtime
  runtime: {
    image: string;
    port: number;
    healthCheck?: string | undefined;
    command?: string[] | undefined;
  };

  // Permissions
  permissions: string[];

  // Resources
  resources?: ResourceLimits | undefined;

  // UI
  ui?: {
    type: "panel" | "page" | "both";
    panelWidth?: number | undefined;
  } | undefined;
}

const KNOWN_PERMISSIONS = new Set([
  "server.read",
  "members.read",
  "channels.read",
  "messages.read",
  "messages.send",
  "users.read",
  "presence.read",
  "notifications.send",
  "config.read",
  "storage.read",
  "storage.write",
  "*",
]);

const SEMVER_REGEX = /^\d+\.\d+\.\d+(-[a-zA-Z0-9.]+)?$/;

export function parseManifest(raw: unknown): { manifest: PluginManifest; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { manifest: {} as PluginManifest, errors: ["Manifest must be a JSON object"] };
  }

  const data = raw as Record<string, unknown>;

  // Required fields
  if (typeof data["id"] !== "string" || !data["id"]) errors.push("Missing required field: id");
  if (typeof data["name"] !== "string" || !data["name"]) errors.push("Missing required field: name");
  if (typeof data["version"] !== "string" || !data["version"]) errors.push("Missing required field: version");
  if (typeof data["description"] !== "string") errors.push("Missing required field: description");
  if (typeof data["author"] !== "string") errors.push("Missing required field: author");

  // Validate version is semver
  if (typeof data["version"] === "string" && !SEMVER_REGEX.test(data["version"])) {
    errors.push(`Invalid version format: ${data["version"]} (must be semver)`);
  }

  // Validate runtime
  if (typeof data["runtime"] !== "object" || data["runtime"] === null) {
    errors.push("Missing required field: runtime");
  } else {
    const runtime = data["runtime"] as Record<string, unknown>;
    if (typeof runtime["image"] !== "string") errors.push("runtime.image must be a string");
    if (typeof runtime["port"] !== "number") errors.push("runtime.port must be a number");
  }

  // Validate permissions
  if (!Array.isArray(data["permissions"])) {
    errors.push("permissions must be an array");
  } else {
    for (const perm of data["permissions"]) {
      if (typeof perm !== "string" || !KNOWN_PERMISSIONS.has(perm)) {
        errors.push(`Unknown permission: ${perm}`);
      }
    }
  }

  // Validate resources if present
  if (data["resources"] !== undefined) {
    const res = data["resources"] as Record<string, unknown>;
    if (typeof res["cpus"] !== "undefined" && (typeof res["cpus"] !== "number" || res["cpus"] <= 0)) {
      errors.push("resources.cpus must be a positive number");
    }
    if (typeof res["memoryMb"] !== "undefined" && (typeof res["memoryMb"] !== "number" || res["memoryMb"] <= 0)) {
      errors.push("resources.memoryMb must be a positive number");
    }
  }

  const manifest: PluginManifest = {
    id: String(data["id"] ?? ""),
    name: String(data["name"] ?? ""),
    version: String(data["version"] ?? "0.0.0"),
    description: String(data["description"] ?? ""),
    author: String(data["author"] ?? ""),
    icon: typeof data["icon"] === "string" ? data["icon"] : undefined,
    repository: typeof data["repository"] === "string" ? data["repository"] : undefined,
    license: typeof data["license"] === "string" ? data["license"] : undefined,
    runtime: {
      image: String((data["runtime"] as Record<string, unknown>)?.["image"] ?? ""),
      port: Number((data["runtime"] as Record<string, unknown>)?.["port"] ?? 3000),
      healthCheck: typeof (data["runtime"] as Record<string, unknown>)?.["healthCheck"] === "string"
        ? String((data["runtime"] as Record<string, unknown>)["healthCheck"])
        : "/health",
      command: Array.isArray((data["runtime"] as Record<string, unknown>)?.["command"])
        ? (data["runtime"] as Record<string, unknown>)["command"] as string[]
        : undefined,
    },
    permissions: Array.isArray(data["permissions"]) ? data["permissions"] as string[] : [],
    resources: data["resources"] as ResourceLimits | undefined,
    ui: data["ui"] as PluginManifest["ui"],
  };

  return { manifest, errors };
}
