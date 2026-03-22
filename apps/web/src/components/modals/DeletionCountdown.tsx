import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { deletionState, dismissDeletion } from "../../stores/deletion-store.js";
import { api, ApiRequestError } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";

const COUNTDOWN_SECONDS = 10;

const DeletionCountdown = () => {
  const [secondsLeft, setSecondsLeft] = createSignal(COUNTDOWN_SECONDS);
  const [cancelling, setCancelling] = createSignal(false);
  const [deleted, setDeleted] = createSignal(false);

  let countdownInterval: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    const state = deletionState();
    if (state.show && state.expiresAt) {
      // Calculate remaining seconds from server's expiresAt
      const remaining = Math.max(
        0,
        Math.ceil((new Date(state.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      setDeleted(false);

      if (countdownInterval !== undefined) clearInterval(countdownInterval);
      countdownInterval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownInterval !== undefined) clearInterval(countdownInterval);
            countdownInterval = undefined;
            setDeleted(true);
            setTimeout(() => {
              window.location.href = "/";
            }, 2000);
            return 0;
          }
          return prev - 1;
        });
      }, 1000);
    } else {
      if (countdownInterval !== undefined) {
        clearInterval(countdownInterval);
        countdownInterval = undefined;
      }
    }
  });

  onCleanup(() => {
    if (countdownInterval !== undefined) clearInterval(countdownInterval);
  });

  async function handleCancel() {
    if (cancelling()) return;
    setCancelling(true);
    try {
      await api("/api/users/@me/cancel-deletion", { method: "POST" });
      if (countdownInterval !== undefined) {
        clearInterval(countdownInterval);
        countdownInterval = undefined;
      }
      dismissDeletion();
      showToast("Account deletion cancelled", "info");
    } catch (err) {
      const msg =
        err instanceof ApiRequestError ? err.body.message : "Failed to cancel deletion";
      showToast(msg, "error");
    } finally {
      setCancelling(false);
    }
  }

  const progress = () => (secondsLeft() / COUNTDOWN_SECONDS) * 100;

  return (
    <Show when={deletionState().show}>
      <div class="fixed inset-0 z-[100] flex items-center justify-center bg-background/80 backdrop-blur-sm">
        <div class="mx-4 w-full max-w-md rounded-xl border border-destructive/30 bg-card p-8 shadow-2xl">
          <Show
            when={!deleted()}
            fallback={
              <div class="text-center">
                <p class="text-2xl font-bold text-destructive">Account Deleted</p>
                <p class="mt-2 text-sm text-muted-foreground">Redirecting...</p>
              </div>
            }
          >
            <h2 class="text-center text-lg font-semibold text-foreground">
              Account Deletion in Progress
            </h2>

            {/* Large countdown number */}
            <div class="my-8 text-center">
              <span class="text-7xl font-bold tabular-nums text-destructive">
                {secondsLeft()}
              </span>
            </div>

            {/* Progress bar */}
            <div class="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-destructive transition-all duration-1000 ease-linear"
                style={{ width: `${progress()}%` }}
              />
            </div>

            <p class="mb-8 text-center text-sm text-muted-foreground">
              Your account will be permanently deleted. All your data will be removed.
            </p>

            {/* Cancel button — prominent, large */}
            <div class="flex justify-center">
              <Button
                size="lg"
                onClick={handleCancel}
                disabled={cancelling()}
                class="w-full text-base"
              >
                {cancelling() ? "Cancelling..." : "Cancel Deletion"}
              </Button>
            </div>
          </Show>
        </div>
      </div>
    </Show>
  );
};

export default DeletionCountdown;
