import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const CLOUDFLARED_RELEASES = "https://github.com/cloudflare/cloudflared/releases/latest/download";

function getPlatformBinary(): { url: string; name: string } {
  const platform = process.platform;
  const arch = process.arch;

  if (platform === "win32") {
    return { url: `${CLOUDFLARED_RELEASES}/cloudflared-windows-amd64.exe`, name: "cloudflared.exe" };
  }
  if (platform === "darwin") {
    const suffix = arch === "arm64" ? "darwin-arm64" : "darwin-amd64";
    return { url: `${CLOUDFLARED_RELEASES}/cloudflared-${suffix}.tgz`, name: "cloudflared" };
  }
  // Linux
  const suffix = arch === "arm64" ? "linux-arm64" : "linux-amd64";
  return { url: `${CLOUDFLARED_RELEASES}/cloudflared-${suffix}`, name: "cloudflared" };
}

function findInPath(): string | null {
  try {
    const cmd = process.platform === "win32" ? "where cloudflared" : "which cloudflared";
    const result = execSync(cmd, { encoding: "utf-8", timeout: 5000 }).trim();
    if (result) return result.split("\n")[0]!.trim();
  } catch {
    // Not in PATH
  }
  return null;
}

/**
 * Ensure the `cloudflared` binary is available.
 * Checks PATH first, then checks the local cache, then downloads.
 */
export async function ensureCloudflared(dataDir: string): Promise<string> {
  // 1. Check PATH
  const pathBinary = findInPath();
  if (pathBinary) {
    console.error(`[tunnel] Found cloudflared in PATH: ${pathBinary}`);
    return pathBinary;
  }

  // 2. Check local cache
  const { url, name } = getPlatformBinary();
  const binDir = path.join(dataDir, "bin");
  const localPath = path.join(binDir, name);

  if (fs.existsSync(localPath)) {
    console.error(`[tunnel] Using cached cloudflared: ${localPath}`);
    return localPath;
  }

  // 3. Download
  console.error(`[tunnel] Downloading cloudflared from ${url}...`);
  fs.mkdirSync(binDir, { recursive: true });

  const response = await fetch(url, { redirect: "follow" });
  if (!response.ok) {
    throw new Error(`Failed to download cloudflared: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (url.endsWith(".tgz")) {
    // macOS comes as tgz — extract
    const tmpPath = path.join(binDir, "cloudflared.tgz");
    fs.writeFileSync(tmpPath, buffer);
    execSync(`tar -xzf "${tmpPath}" -C "${binDir}"`, { timeout: 30_000 });
    fs.unlinkSync(tmpPath);
  } else {
    fs.writeFileSync(localPath, buffer);
  }

  // Make executable on Unix
  if (process.platform !== "win32") {
    fs.chmodSync(localPath, 0o755);
  }

  // Verify
  try {
    execSync(`"${localPath}" --version`, { encoding: "utf-8", timeout: 10_000 });
  } catch (err) {
    throw new Error(`Downloaded cloudflared binary is not working: ${err}`);
  }

  console.error(`[tunnel] Downloaded cloudflared to ${localPath}`);
  return localPath;
}
