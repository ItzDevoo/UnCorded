/**
 * Readiness check helper — plugins expose this at /ready to signal
 * that all internal services are accepting requests.
 */
export function createReadinessCheck(
  checks: Array<() => boolean | Promise<boolean>>,
): () => Promise<Response> {
  return async () => {
    for (const check of checks) {
      if (!(await check())) {
        return new Response(JSON.stringify({ ready: false }), {
          status: 503,
          headers: { "Content-Type": "application/json" },
        });
      }
    }
    return new Response(JSON.stringify({ ready: true }), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
}
