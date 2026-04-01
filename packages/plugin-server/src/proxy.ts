import type { Subprocess } from "bun";

// ── Types ─────────────────────────────────────────────────

export interface ProxyOptions {
  /** Strip the prefix from the forwarded path. Default: true. */
  stripPrefix?: boolean;
  /** Request timeout in ms. Default: 30_000. */
  timeout?: number;
}

export interface RewriteOptions extends ProxyOptions {
  /** Additional patterns to rewrite beyond href/src/action. */
  extraPatterns?: Array<{ match: RegExp; replace: string }>;
  /**
   * Inject `<base href="{prefix}/">` into `<head>` instead of regex rewriting.
   * Catches more cases (CSS url(), fetch() in JS) without fragile regex.
   * Default: true. Set to false to use regex-only rewriting.
   */
  injectBaseHref?: boolean;
}

export interface BundledServiceConfig {
  /** Spawn command, e.g. ["hedgedoc", "--port", "3001"]. */
  command: string[];
  /** Port the child service listens on. */
  port: number;
  /** Path to poll for readiness. Default: "/health". */
  readyCheck?: string;
  /** How long to wait for readiness in ms. Default: 30_000. */
  readyTimeout?: number;
  /** URL prefix on this plugin's server. */
  proxyPath: string;
  /** Rewrite root-relative URLs in HTML responses. Default: true. */
  rewriteUrls?: boolean;
  /** Called for each stdout line from the child. Default: console.log with [service] prefix. */
  onStdout?: (line: string) => void;
  /** Called for each stderr line from the child. Default: console.error with [service] prefix. */
  onStderr?: (line: string) => void;
}

export interface BundledService {
  /** Request handler for Bun.serve fetch — proxies matching requests to the bundled service. */
  handler: (req: Request) => Promise<Response | null>;
  /** Returns true once the bundled service is accepting requests. */
  ready: () => boolean;
  /** Gracefully stops the child process. */
  shutdown: () => Promise<void>;
  /**
   * Escape hatch: direct access to the child process.
   * Use for debugging only — do not depend on internal process state.
   */
  process: Subprocess;
}

// ── Constants ─────────────────────────────────────────────

const DEFAULT_TIMEOUT_MS = 30_000;
const DEFAULT_READY_CHECK = "/health";
const DEFAULT_READY_TIMEOUT_MS = 30_000;
const READY_POLL_INITIAL_MS = 500;
const READY_POLL_MAX_MS = 4_000;
const SHUTDOWN_GRACE_MS = 5_000;

/** Headers that MUST NOT be forwarded between hops (RFC 2616 §13.5.1). */
const HOP_BY_HOP_HEADERS: ReadonlySet<string> = new Set([
  "connection",
  "keep-alive",
  "proxy-authenticate",
  "proxy-authorization",
  "te",
  "trailers",
  "transfer-encoding",
  "upgrade",
]);

// ── Helpers ───────────────────────────────────────────────

/** Copy headers from source, stripping hop-by-hop entries. */
function forwardHeaders(source: Headers): Headers {
  const out = new Headers();
  source.forEach((value, key) => {
    if (!HOP_BY_HOP_HEADERS.has(key.toLowerCase())) {
      out.set(key, value);
    }
  });
  return out;
}

/** Ensure a prefix starts with "/" and has no trailing slash. */
function normalizePrefix(prefix: string): string {
  const p = prefix.startsWith("/") ? prefix : `/${prefix}`;
  return p.replace(/\/+$/, "");
}

/** Read a ReadableStream line-by-line and invoke `cb` for each complete line. */
async function pipeLines(
  stream: ReadableStream<Uint8Array>,
  cb: (line: string) => void,
): Promise<void> {
  const decoder = new TextDecoder();
  let buffer = "";

  for await (const chunk of stream) {
    buffer += decoder.decode(chunk, { stream: true });
    const lines = buffer.split("\n");
    // Last element is either "" (if chunk ended with \n) or partial data
    buffer = lines.pop()!;
    for (const line of lines) {
      cb(line);
    }
  }

  // Flush remaining data
  buffer += decoder.decode();
  if (buffer.length > 0) {
    cb(buffer);
  }
}

// ── proxy() ───────────────────────────────────────────────

/**
 * Raw reverse proxy. Returns a request handler that forwards matching
 * requests to `target` and returns `null` for non-matching paths,
 * allowing easy chaining in Bun.serve's fetch handler.
 */
export function proxy(
  prefix: string,
  target: string,
  options?: ProxyOptions,
): (req: Request) => Promise<Response | null> {
  const normalizedPrefix = normalizePrefix(prefix);
  const stripPrefix = options?.stripPrefix ?? true;
  const timeoutMs = options?.timeout ?? DEFAULT_TIMEOUT_MS;
  const targetBase = target.replace(/\/+$/, "");

  return async (req: Request): Promise<Response | null> => {
    const url = new URL(req.url);

    // Check if this request matches the prefix
    if (
      url.pathname !== normalizedPrefix &&
      !url.pathname.startsWith(`${normalizedPrefix}/`)
    ) {
      return null;
    }

    // Build upstream path
    const upstreamPath = stripPrefix
      ? url.pathname.slice(normalizedPrefix.length) || "/"
      : url.pathname;
    const upstreamUrl = `${targetBase}${upstreamPath}${url.search}`;

    // Forward headers, stripping hop-by-hop
    const headers = forwardHeaders(req.headers);

    // Timeout via AbortController
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);

    try {
      const upstreamRes = await fetch(upstreamUrl, {
        method: req.method,
        headers,
        body: req.body,
        signal: controller.signal,
        redirect: "manual",
        // @ts-expect-error — Bun supports duplex on Request
        duplex: "half",
      });

      // Build response headers, stripping hop-by-hop from upstream
      const resHeaders = forwardHeaders(upstreamRes.headers);

      // Rewrite Location header for redirects so they go through the proxy
      const location = upstreamRes.headers.get("location");
      if (location && stripPrefix) {
        try {
          const locUrl = new URL(location, upstreamUrl);
          const targetUrl = new URL(targetBase);
          // Only rewrite if the redirect points to the same upstream origin
          if (locUrl.origin === targetUrl.origin) {
            resHeaders.set(
              "location",
              `${normalizedPrefix}${locUrl.pathname}${locUrl.search}`,
            );
          }
        } catch {
          // If URL parsing fails, pass through as-is
        }
      }

      // Pass through set-cookie from upstream
      const setCookies = upstreamRes.headers.getSetCookie?.();
      if (setCookies) {
        // Clear any set-cookie that forwardHeaders may have collapsed
        resHeaders.delete("set-cookie");
        for (const cookie of setCookies) {
          resHeaders.append("set-cookie", cookie);
        }
      }

      // Iframe-safe: merge frame-ancestors into existing CSP instead of overwriting
      const existingCsp = resHeaders.get("content-security-policy");
      if (existingCsp) {
        if (/\bframe-ancestors\b/i.test(existingCsp)) {
          resHeaders.set(
            "content-security-policy",
            existingCsp.replace(/\bframe-ancestors\b[^;]*/i, "frame-ancestors *"),
          );
        } else {
          resHeaders.set("content-security-policy", `${existingCsp}; frame-ancestors *`);
        }
      } else {
        resHeaders.set("content-security-policy", "frame-ancestors *");
      }

      // Echo request origin instead of wildcard — supports credentialed requests
      const requestOrigin = req.headers.get("origin");
      if (requestOrigin) {
        resHeaders.set("access-control-allow-origin", requestOrigin);
        resHeaders.set("access-control-allow-credentials", "true");
      }

      return new Response(upstreamRes.body, {
        status: upstreamRes.status,
        statusText: upstreamRes.statusText,
        headers: resHeaders,
      });
    } catch (err) {
      if (err instanceof DOMException && err.name === "AbortError") {
        return new Response("Proxy timeout", { status: 504 });
      }
      return new Response("Bad gateway", { status: 502 });
    } finally {
      clearTimeout(timer);
    }
  };
}

// ── rewriteHtmlBase() ─────────────────────────────────────

/**
 * HTML-aware proxy that rewrites root-relative URLs in HTML responses
 * so embedded assets resolve correctly through the prefix path.
 *
 * v1-pragmatic: handles href="/", src="/", action="/" in HTML bodies.
 * Known limitations: inline JS strings, CSS url(), dynamically-generated HTML.
 */
export function rewriteHtmlBase(
  prefix: string,
  target: string,
  options?: RewriteOptions,
): (req: Request) => Promise<Response | null> {
  const normalizedPrefix = normalizePrefix(prefix);
  const inner = proxy(prefix, target, options);
  const extraPatterns = options?.extraPatterns ?? [];
  const injectBaseHref = options?.injectBaseHref ?? true;

  return async (req: Request): Promise<Response | null> => {
    const res = await inner(req);
    if (!res) return null;

    const contentType = res.headers.get("content-type") ?? "";
    if (!contentType.includes("text/html")) {
      return res;
    }

    let html = await res.text();

    if (injectBaseHref) {
      // Inject <base href> into <head> — catches relative URLs globally
      // (CSS url(), fetch() calls, etc.) without fragile regex.
      const baseTag = `<base href="${normalizedPrefix}/">`;
      const headMatch = html.match(/<head[^>]*>/i);
      if (headMatch) {
        const insertPos = headMatch.index! + headMatch[0].length;
        html = html.slice(0, insertPos) + baseTag + html.slice(insertPos);
      }
    } else {
      // Fallback: regex rewriting of href="/", src="/", action="/"
      // v1-pragmatic — known fragile for inline JS, CSS url(), dynamic HTML.
      html = html.replace(
        /((?:href|src|action)\s*=\s*["'])\//gi,
        `$1${normalizedPrefix}/`,
      );
    }

    // Apply extra user-supplied patterns regardless of strategy
    for (const { match, replace } of extraPatterns) {
      html = html.replace(match, replace);
    }

    const headers = new Headers(res.headers);
    headers.delete("content-length");

    return new Response(html, {
      status: res.status,
      statusText: res.statusText,
      headers,
    });
  };
}

// ── createBundledService() ────────────────────────────────

/**
 * Full supervisor that spawns a child process, waits for readiness, and
 * exposes a proxy handler. Composes the public proxy/rewriteHtmlBase —
 * plugin authors can skip this and use the lower-level pieces directly.
 */
export function createBundledService(config: BundledServiceConfig): BundledService {
  const {
    command,
    port,
    readyCheck = DEFAULT_READY_CHECK,
    readyTimeout = DEFAULT_READY_TIMEOUT_MS,
    proxyPath,
    rewriteUrls = true,
    onStdout,
    onStderr,
  } = config;

  const serviceName = command[0] ?? "service";
  const defaultStdout = (line: string) => console.log(`[${serviceName}] ${line}`);
  const defaultStderr = (line: string) => console.error(`[${serviceName}] ${line}`);

  const useCallbacks = onStdout !== undefined || onStderr !== undefined;
  const stdoutCb = onStdout ?? defaultStdout;
  const stderrCb = onStderr ?? defaultStderr;

  // Spawn child
  const proc = Bun.spawn(command, {
    stdio: useCallbacks
      ? ["ignore", "pipe", "pipe"]
      : ["ignore", "inherit", "inherit"],
  });

  // Pipe stdout/stderr line-by-line when using callbacks
  if (useCallbacks) {
    if (proc.stdout) {
      pipeLines(proc.stdout as ReadableStream<Uint8Array>, stdoutCb).catch((err) => {
        stderrCb(`[pipe] stdout stream error: ${err}`);
      });
    }
    if (proc.stderr) {
      pipeLines(proc.stderr as ReadableStream<Uint8Array>, stderrCb).catch((err) => {
        console.error(`[${serviceName}] stderr stream error:`, err);
      });
    }
  }

  // Readiness state
  let isReady = false;

  // Reset readiness when the child exits (crash, SIGTERM, etc.)
  proc.exited
    .then(() => { isReady = false; })
    .catch(() => { isReady = false; });

  // Build proxy handler
  const target = `http://localhost:${port}`;
  const handler = rewriteUrls
    ? rewriteHtmlBase(proxyPath, target)
    : proxy(proxyPath, target);

  // Poll for readiness with exponential backoff (500ms → 1s → 2s → 4s cap)
  // Error logs suppressed during grace window to avoid noise from expected failures.
  const readyUrl = `http://localhost:${port}${readyCheck}`;
  const readyPromise = (async () => {
    const deadline = Date.now() + readyTimeout;
    let interval = READY_POLL_INITIAL_MS;
    while (Date.now() < deadline && proc.exitCode === null) {
      try {
        const res = await fetch(readyUrl, {
          signal: AbortSignal.timeout(2_000),
        });
        if (res.status === 200) {
          isReady = true;
          return;
        }
      } catch {
        // Expected during startup — suppress until deadline
      }
      await Bun.sleep(interval);
      interval = Math.min(interval * 2, READY_POLL_MAX_MS);
    }
    if (proc.exitCode !== null) {
      console.error(`[${serviceName}] child process exited before becoming ready`);
    } else {
      console.error(
        `[${serviceName}] readiness check timed out after ${readyTimeout}ms`,
      );
    }
  })();

  // Prevent unhandled rejection if the caller never awaits readyPromise
  readyPromise.catch(() => {});

  const shutdown = async (): Promise<void> => {
    // SIGTERM first
    proc.kill("SIGTERM");

    const exited = new Promise<boolean>((resolve) => {
      proc.exited.then(() => resolve(true)).catch(() => resolve(true));
      setTimeout(() => resolve(false), SHUTDOWN_GRACE_MS);
    });

    const didExit = await exited;
    if (!didExit) {
      proc.kill("SIGKILL");
      await proc.exited.catch(() => {});
    }
  };

  return {
    handler,
    ready: () => isReady,
    shutdown,
    process: proc,
  };
}
