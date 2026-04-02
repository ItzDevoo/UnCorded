/**
 * Readiness check helper — plugins expose this at /ready to signal
 * that all internal services are accepting requests.
 */
export function createReadinessCheck(
  checks: Array<() => boolean | Promise<boolean>>,
): () => Promise<Response> {
  return async () => {
    for (const check of checks) {
      try {
        // eslint-disable-next-line no-await-in-loop
        if (!(await check())) {
          return new Response(JSON.stringify({ ready: false }), {
            status: 503,
            headers: { "Content-Type": "application/json" },
          });
        }
      } catch (err) {
        console.error("[readiness] Check threw:", err);
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
