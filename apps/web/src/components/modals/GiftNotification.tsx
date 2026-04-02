import { Show } from "solid-js";
import { giftState, dismissGift } from "../../stores/gift-store.js";
import { Button } from "../ui/button.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog.js";

const TIER_LABELS: Record<string, string> = {
  supporter: "Supporter",
  server_owner: "Server Owner",
};

const TIER_BENEFITS: Record<string, string[]> = {
  supporter: [
    "File sharing in server channels",
    "TURN relay for better P2P connections",
    "Desktop app access",
  ],
  server_owner: ["Everything in Supporter", "Create and manage servers", "Traffic-based scaling"],
};

const GiftNotification = () => {
  const state = giftState;

  return (
    <Dialog
      open={state().show}
      onOpenChange={(open) => {
        if (!open) dismissGift();
      }}
    >
      <DialogContent onClose={dismissGift}>
        <DialogHeader>
          <DialogTitle class="text-center text-2xl">You've received a gift!</DialogTitle>
          <DialogDescription class="text-center">
            You've been upgraded to{" "}
            <span class="font-semibold text-primary">
              {TIER_LABELS[state().tier] ?? state().tier}
            </span>{" "}
            for {state().days} days
          </DialogDescription>
        </DialogHeader>

        <div class="py-4">
          <div class="rounded-xl border border-primary/20 bg-primary/5 p-4">
            <p class="mb-2 text-sm font-medium text-primary">What you get:</p>
            <Show when={TIER_BENEFITS[state().tier]}>
              <ul class="space-y-1.5">
                {TIER_BENEFITS[state().tier]!.map((benefit) => (
                  <li class="flex items-center gap-2 text-sm text-foreground/80">
                    <span class="text-primary">+</span>
                    {benefit}
                  </li>
                ))}
              </ul>
            </Show>
          </div>

          <p class="mt-3 text-center text-xs text-muted-foreground">
            Expires on{" "}
            {(() => {
              const d = new Date(state().expiresAt);
              return Number.isNaN(d.getTime())
                ? "N/A"
                : d.toLocaleDateString(undefined, {
                    year: "numeric",
                    month: "long",
                    day: "numeric",
                  });
            })()}
          </p>
        </div>

        <DialogFooter class="justify-center">
          <Button onClick={dismissGift} size="lg">
            Awesome!
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default GiftNotification;
