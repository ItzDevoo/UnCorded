import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const DEFAULT_SIDECAR_PORT = 7070;

export async function sideload(pluginDir: string): Promise<void> {
  // Read manifest
  const manifestPath = join(pluginDir, "uncorded-plugin.json");
  const manifest = JSON.parse(readFileSync(manifestPath, "utf-8")) as {
    id: string;
    name: string;
    runtime: { image: string };
  };

  const imageName = manifest.runtime.image;

  // Build Docker image (use execFileSync to avoid shell injection via imageName)
  console.log(`\nBuilding Docker image: ${imageName}`);
  execFileSync("docker", ["build", "-t", imageName, "."], {
    cwd: pluginDir,
    stdio: "inherit",
  });

  // POST to sidecar install endpoint
  const sidecarPort = process.env["UNCORDED_SIDECAR_PORT"] ?? String(DEFAULT_SIDECAR_PORT);
  const sidecarUrl = `http://localhost:${sidecarPort}/plugins/install`;

  console.log(`\nInstalling plugin via sidecar at ${sidecarUrl}...`);

  const res = await fetch(sidecarUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: readFileSync(manifestPath, "utf-8"),
  });

  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Sideload failed (${res.status}): ${text}`);
  }

  const result = await res.json();
  console.log("Plugin installed:", result);
}
