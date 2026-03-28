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
const SAFE_ID_REGEX = /^[a-zA-Z0-9._-]+$/;

function parseStringArray(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  if (value.every((v) => typeof v === "string")) return value as string[];
  return undefined;
}

function parseResources(value: unknown): ResourceLimits | undefined {
  if (typeof value !== "object" || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  const result: ResourceLimits = {};
  if (typeof obj["cpus"] === "number" && obj["cpus"] > 0) result.cpus = obj["cpus"];
  if (typeof obj["memoryMb"] === "number" && obj["memoryMb"] > 0) result.memoryMb = obj["memoryMb"];
  return result;
}

function parseUi(value: unknown): PluginManifest["ui"] {
  if (typeof value !== "object" || value === null) return undefined;
  const obj = value as Record<string, unknown>;
  const type = obj["type"];
  if (type !== "panel" && type !== "page" && type !== "both") return undefined;
  return {
    type,
    panelWidth: typeof obj["panelWidth"] === "number" ? obj["panelWidth"] : undefined,
  };
}

export function parseManifest(raw: unknown): { manifest: PluginManifest; errors: string[] } {
  const errors: string[] = [];

  if (typeof raw !== "object" || raw === null) {
    return { manifest: {} as PluginManifest, errors: ["Manifest must be a JSON object"] };
  }

  const data = raw as Record<string, unknown>;

  // Required fields
  if (typeof data["id"] !== "string" || !data["id"]) {
    errors.push("Missing required field: id");
  } else if (!SAFE_ID_REGEX.test(data["id"])) {
    errors.push("Plugin id contains invalid characters (only alphanumeric, '.', '-', '_' allowed)");
  }
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
      command: parseStringArray((data["runtime"] as Record<string, unknown>)?.["command"]),
    },
    permissions: parseStringArray(data["permissions"]) ?? [],
    resources: parseResources(data["resources"]),
    ui: parseUi(data["ui"]),
  };

  return { manifest, errors };
}
