import { createSignal, onMount, onCleanup, Show } from "solid-js";
import type { StripeEmbeddedCheckout } from "@stripe/stripe-js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "../ui/dialog.js";
import { getStripe } from "../../lib/stripe-client.js";
import { createCheckout } from "../../lib/api.js";
import { showToast } from "../ui/toast.js";

interface CheckoutModalProps {
  tier: "supporter" | "server_owner";
  onClose: () => void;
}

const TIER_LABELS: Record<string, string> = {
  supporter: "Supporter",
  server_owner: "Server Owner",
};

const CheckoutModal = (props: CheckoutModalProps) => {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  let checkoutInstance: StripeEmbeddedCheckout | null = null;
  // oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern
  let containerRef!: HTMLDivElement;

  onMount(async () => {
    try {
      const [stripe, clientSecret] = await Promise.all([
        getStripe(),
        createCheckout(props.tier),
      ]);

      if (!stripe) {
        setError("Payment system unavailable");
        setLoading(false);
        return;
      }

      checkoutInstance = await stripe.initEmbeddedCheckout({
        clientSecret,
        onComplete: () => {
          showToast("Subscription activated!", "info");
          props.onClose();
        },
      });

      setLoading(false);
      checkoutInstance.mount(containerRef);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load checkout");
      setLoading(false);
    }
  });

  onCleanup(() => {
    checkoutInstance?.destroy();
  });

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent class="max-w-lg" onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Upgrade to {TIER_LABELS[props.tier] ?? props.tier}</DialogTitle>
        </DialogHeader>

        <Show when={error()}>
          <p class="text-sm text-destructive">{error()}</p>
        </Show>

        <Show when={loading() && !error()}>
          <div class="flex items-center justify-center py-12">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        </Show>

        <div ref={containerRef} class={loading() || error() ? "hidden" : ""} />
      </DialogContent>
    </Dialog>
  );
};

export default CheckoutModal;
