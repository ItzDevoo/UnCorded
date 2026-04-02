import type { PluginLifecycle } from "./lifecycle";

export interface UpdateInfo {
  pluginId: string;
  currentVersion: string;
  availableVersion: string;
  manifest: unknown;
  updateType: "major" | "minor" | "patch";
}

function coreSegments(version: string): [number, number, number] {
  const core = version.replace(/[-+].*$/, "");
  const parts = core.split(".").map(Number);
  return [(parts[0] ?? 0) || 0, (parts[1] ?? 0) || 0, (parts[2] ?? 0) || 0];
}

function classifyUpdate(current: string, available: string): "major" | "minor" | "patch" {
  const c = coreSegments(current);
  const a = coreSegments(available);
  if (a[0] !== c[0]) return "major";
  if (a[1] !== c[1]) return "minor";
  return "patch";
}

const CHECK_TIMEOUT_MS = 15_000;

export async function checkForUpdates(
  plugins: PluginLifecycle,
  apiBaseUrl: string,
  apiToken: string,
): Promise<UpdateInfo[]> {
  const installed = plugins.list();
  if (installed.length === 0) return [];

  const input = installed.map((p) => ({
    id: p.pluginId,
    version: p.manifest.version,
  }));

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

  try {
    const res = await fetch(`${apiBaseUrl}/api/plugins/check-updates`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: `__Secure-uncorded.session_token=${apiToken}`,
      },
      body: JSON.stringify({ plugins: input }),
      signal: controller.signal,
    });

    if (!res.ok) {
      console.error(`[update-checker] Server returned ${res.status}`);
      return [];
    }

    const data = (await res.json()) as {
      updates: {
        pluginId: string;
        currentVersion: string;
        latestVersion: string;
        manifest: unknown;
      }[];
    };

    return data.updates.map((u) => ({
      pluginId: u.pluginId,
      currentVersion: u.currentVersion,
      availableVersion: u.latestVersion,
      manifest: u.manifest,
      updateType: classifyUpdate(u.currentVersion, u.latestVersion),
    }));
  } catch (err) {
    if (err instanceof DOMException && err.name === "AbortError") {
      console.error("[update-checker] Request timed out");
    } else {
      console.error("[update-checker] Failed to check for updates:", err);
    }
    return [];
  } finally {
    clearTimeout(timeout);
  }
}

export async function applyAutoUpdates(
  plugins: PluginLifecycle,
  updates: UpdateInfo[],
): Promise<{ applied: string[]; skipped: string[] }> {
  const autoUpdatable = updates.filter((u) => u.updateType !== "major");
  const applied: string[] = [];
  const skipped: string[] = [];

  for (const update of autoUpdatable) {
    try {
      // eslint-disable-next-line no-await-in-loop
      const result = await plugins.update(update.pluginId, update.manifest);
      if (result.errors && result.errors.length > 0) {
        console.error(`[update-checker] Failed to update ${update.pluginId}:`, result.errors);
        skipped.push(update.pluginId);
      } else {
        applied.push(update.pluginId);
      }
    } catch (err) {
      console.error(`[update-checker] Error updating ${update.pluginId}:`, err);
      skipped.push(update.pluginId);
    }
  }

  return { applied, skipped };
}
