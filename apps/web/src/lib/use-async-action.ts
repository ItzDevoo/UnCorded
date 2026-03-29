import { createSignal } from "solid-js";
import { handleApiError } from "./error-handling.js";

export function useAsyncAction() {
  const [loading, setLoading] = createSignal(false);

  async function run(fn: () => Promise<void>, errorFallback = "Action failed") {
    if (loading()) return;
    setLoading(true);
    try {
      await fn();
    } catch (err) {
      handleApiError(err, errorFallback);
    } finally {
      setLoading(false);
    }
  }

  return { loading, run } as const;
}
