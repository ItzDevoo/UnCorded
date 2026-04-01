/**
 * Extract client IP from proxy headers.
 *
 * SECURITY: This trusts X-Forwarded-For / X-Real-IP headers.
 * The server MUST run behind a reverse proxy (nginx) that sets these.
 * Direct exposure without a proxy allows IP spoofing to bypass rate limits.
 */
export function getClientIp(request: Request): string {
  return (
    request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ??
    request.headers.get("x-real-ip") ??
    "0.0.0.0"
  );
}
