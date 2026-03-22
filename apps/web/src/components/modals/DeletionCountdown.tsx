import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { deletionState, dismissDeletion } from "../../stores/deletion-store.js";
import { api, ApiRequestError } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "../ui/dialog.js";

const COUNTDOWN_SECONDS = 10;

const DeletionCountdown = () => {
  const [secondsLeft, setSecondsLeft] = createSignal(COUNTDOWN_SECONDS);
  const [cancelling, setCancelling] = createSignal(false);
  const [deleted, setDeleted] = createSignal(false);

  let countdownInterval: ReturnType<typeof setInterval> | undefined;

  createEffect(() => {
    const state = deletionState();
    if (state.show && state.expiresAt) {
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
    <Dialog
      open={deletionState().show}
      onOpenChange={() => {
        /* prevent Escape from closing — user must cancel or wait */
      }}
    >
      <DialogContent class="border-destructive/30">
        <Show
          when={!deleted()}
          fallback={
            <div class="text-center py-4">
              <p class="text-2xl font-bold text-destructive">Account Deleted</p>
              <p class="mt-2 text-sm text-muted-foreground">Redirecting...</p>
            </div>
          }
        >
          <DialogHeader>
            <DialogTitle class="text-center">
              Account Deletion in Progress
            </DialogTitle>
            <DialogDescription class="text-center">
              Your account will be permanently deleted. All your data will be removed.
            </DialogDescription>
          </DialogHeader>

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

          {/* Cancel button — prominent, large, autofocused by DialogContent */}
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
      </DialogContent>
    </Dialog>
  );
};

export default DeletionCountdown;
