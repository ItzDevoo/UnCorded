import { ApiRequestError } from "./api.js";
import { showToast } from "../components/ui/toast.js";

export function handleApiError(err: unknown, fallback: string): void {
  const message =
    err instanceof ApiRequestError
      ? err.body.message?.trim() || fallback
      : err instanceof Error
        ? err.message?.trim() || fallback
        : fallback;
  showToast(message, "error");
}
