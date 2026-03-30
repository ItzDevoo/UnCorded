import { createSignal, createEffect, onCleanup, Show } from "solid-js";
import { deletionState, dismissDeletion } from "../../stores/deletion-store.js";
import { lastCloseCode } from "../../lib/gateway-store.js";
import { CloseCode } from "@uncorded/protocol";
import { api } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";
import { handleApiError } from "../../lib/error-handling.js";
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
  const [expired, setExpired] = createSignal(false);

  let countdownInterval: ReturnType<typeof setInterval> | undefined;

  // Start/stop the visual countdown based on store state
  createEffect(() => {
    const state = deletionState();
    if (state.show && state.expiresAt) {
      const remaining = Math.max(
        0,
        Math.ceil((new Date(state.expiresAt).getTime() - Date.now()) / 1000),
      );
      setSecondsLeft(remaining);
      setDeleted(false);
      setExpired(false);

      if (countdownInterval !== undefined) clearInterval(countdownInterval);
      countdownInterval = setInterval(() => {
        setSecondsLeft((prev) => {
          if (prev <= 1) {
            if (countdownInterval !== undefined) clearInterval(countdownInterval);
            countdownInterval = undefined;
            setExpired(true);
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
      setExpired(false);
    }
  });

  // Server-driven confirmation: when the server closes the WS with ACCOUNT_DELETED
  // close code, it means db.delete() succeeded and disconnectUser() was called
  createEffect(() => {
    if (expired() && deletionState().show && lastCloseCode() === CloseCode.ACCOUNT_DELETED) {
      setDeleted(true);
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
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
      handleApiError(err, "Failed to cancel deletion");
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
            <Show
              when={!expired()}
              fallback={
                <div class="flex flex-col items-center gap-2">
                  <div class="h-8 w-8 animate-spin rounded-full border-2 border-destructive border-t-transparent" />
                  <span class="text-sm text-muted-foreground">Deleting...</span>
                </div>
              }
            >
              <span class="text-7xl font-bold tabular-nums text-destructive">
                {secondsLeft()}
              </span>
            </Show>
          </div>

          {/* Progress bar */}
          <Show when={!expired()}>
            <div class="mb-6 h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                class="h-full rounded-full bg-destructive transition-all duration-1000 ease-linear"
                style={{ width: `${progress()}%` }}
              />
            </div>
          </Show>

          {/* Cancel button — prominent, large, autofocused by DialogContent */}
          <Show when={!expired()}>
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
        </Show>
      </DialogContent>
    </Dialog>
  );
};

export default DeletionCountdown;
