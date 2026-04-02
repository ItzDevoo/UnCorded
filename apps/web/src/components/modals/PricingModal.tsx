import { createSignal, For } from "solid-js";
import type { PaidTier } from "@uncorded/shared";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog.js";
import { Button } from "../ui/button.js";

interface PricingModalProps {
  onClose: () => void;
  onSelect: (tier: PaidTier) => void;
}

const TIERS = [
  {
    id: "free" as const,
    name: "Free",
    price: "$0",
    description: "Basic chat and messaging",
    features: [
      "Text chat in servers",
      "Direct messages",
      "P2P file sharing in DMs",
      "Join up to 100 servers",
    ],
    missing: [
      "File sharing in server channels",
      "TURN relay for better connections",
      "Desktop app access",
      "Create & manage servers",
    ],
  },
  {
    id: "supporter" as const,
    name: "Supporter",
    price: "$5/mo",
    description: "Enhanced features for power users",
    features: [
      "Everything in Free",
      "File sharing in server channels",
      "TURN relay for reliable P2P",
      "Desktop app access",
    ],
    missing: ["Create & manage servers"],
    popular: true,
  },
  {
    id: "server_owner" as const,
    name: "Server Owner",
    price: "$10/mo",
    description: "Full platform access",
    features: [
      "Everything in Supporter",
      "Create & manage servers",
      "Channel management",
      "Traffic-based scaling",
    ],
    missing: [],
  },
] as const;

const PricingModal = (props: PricingModalProps) => {
  const [selected, setSelected] = createSignal<PaidTier>("supporter");

  return (
    <Dialog
      open
      onOpenChange={(open) => {
        if (!open) props.onClose();
      }}
    >
      <DialogContent class="max-w-lg lg:max-w-3xl" onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Choose a Plan</DialogTitle>
          <DialogDescription>Pick the plan that's right for you.</DialogDescription>
        </DialogHeader>

        <div
          class="grid grid-cols-1 gap-3 py-2 lg:grid-cols-3"
          role="radiogroup"
          aria-label="Subscription tier"
        >
          <For each={TIERS}>
            {(tier) => {
              const isFree = tier.id === "free";
              const isSelected = !isFree && selected() === tier.id;

              return (
                <button
                  type="button"
                  disabled={isFree}
                  role="radio"
                  aria-checked={isSelected}
                  aria-disabled={isFree}
                  class={`relative w-full rounded-xl border p-4 text-left transition-all ${
                    isFree
                      ? "border-border bg-muted/20 opacity-60 cursor-default"
                      : isSelected
                        ? "border-primary bg-primary/5 shadow-sm"
                        : "border-border hover:border-muted-foreground"
                  }`}
                  onClick={() => {
                    if (!isFree) setSelected(tier.id as PaidTier);
                  }}
                >
                  {"popular" in tier && tier.popular && (
                    <span class="absolute -top-2.5 right-3 rounded-full bg-primary px-2 py-0.5 text-[10px] font-semibold text-primary-foreground">
                      Popular
                    </span>
                  )}

                  <div>
                    <div class="flex items-center justify-between">
                      <span class="text-sm font-semibold text-foreground">{tier.name}</span>
                      <span
                        class={`text-sm font-bold ${isFree ? "text-muted-foreground" : "text-foreground"}`}
                      >
                        {tier.price}
                      </span>
                    </div>
                    <p class="mt-0.5 text-xs text-muted-foreground">{tier.description}</p>
                  </div>

                  <ul class="mt-3 space-y-1.5">
                    <For each={tier.features}>
                      {(f) => (
                        <li class="flex items-center gap-2 text-xs text-foreground/80">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="3"
                            class="shrink-0 text-primary"
                          >
                            <polyline points="20 6 9 17 4 12" />
                          </svg>
                          {f}
                        </li>
                      )}
                    </For>
                    <For each={tier.missing}>
                      {(f) => (
                        <li class="flex items-center gap-2 text-xs text-muted-foreground/50">
                          <svg
                            xmlns="http://www.w3.org/2000/svg"
                            width="12"
                            height="12"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            stroke-width="2"
                            class="shrink-0"
                          >
                            <line x1="18" y1="6" x2="6" y2="18" />
                            <line x1="6" y1="6" x2="18" y2="18" />
                          </svg>
                          {f}
                        </li>
                      )}
                    </For>
                  </ul>

                  {isFree && (
                    <span class="mt-2 inline-block text-[10px] text-primary">Current plan</span>
                  )}
                </button>
              );
            }}
          </For>
        </div>

        <DialogFooter class="justify-center">
          <Button variant="ghost" onClick={props.onClose}>
            Cancel
          </Button>
          <Button onClick={() => props.onSelect(selected())}>
            Continue with {selected() === "supporter" ? "Supporter" : "Server Owner"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PricingModal;
