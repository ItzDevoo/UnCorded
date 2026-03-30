import { createSignal } from "solid-js";
import { handleApiError } from "./error-handling.js";

export function useAsyncAction() {
  const [loading, setLoading] = createSignal(false);
  let runId = 0;

  async function run(fn: () => Promise<void>, errorFallback = "Action failed") {
    if (loading()) return;
    const id = ++runId;
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      if (id === runId) handleApiError(err, errorFallback);
    } finally {
      if (id === runId) setLoading(false);
    }
  }

  function reset() {
    ++runId;
    setLoading(false);
  }

  return { loading, run, reset } as const;
}
