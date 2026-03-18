import { createSignal, onMount, onCleanup, Show, Switch, Match } from "solid-js";
import type { Stripe, StripeElements } from "@stripe/stripe-js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "../ui/dialog.js";
import { getStripe } from "../../lib/stripe-client.js";
import {
  getSubscription,
  cancelSubscription,
  resumeSubscription,
  changePlan,
  createSetupIntent,
  updatePaymentMethod,
  type SubscriptionDetails,
} from "../../lib/api.js";
import { showToast } from "../ui/toast.js";

type View = "overview" | "cancel" | "payment" | "change-plan";

const TIER_LABELS: Record<string, string> = {
  supporter: "Supporter",
  server_owner: "Server Owner",
};

const TIER_PRICES: Record<string, string> = {
  supporter: "$5/mo",
  server_owner: "$10/mo",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
}

interface SubscriptionModalProps {
  onClose: () => void;
}

const SubscriptionModal = (props: SubscriptionModalProps) => {
  const [view, setView] = createSignal<View>("overview");
  const [sub, setSub] = createSignal<SubscriptionDetails | null>(null);
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [actionLoading, setActionLoading] = createSignal(false);

  async function load() {
    setLoading(true);
    setError(null);
    try {
      const data = await getSubscription();
      setSub(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load subscription");
    } finally {
      setLoading(false);
    }
  }

  onMount(load);

  return (
    <Dialog open onOpenChange={(open) => { if (!open) props.onClose(); }}>
      <DialogContent class="max-w-md" onClose={props.onClose}>
        <Show when={loading()}>
          <div class="flex items-center justify-center py-12">
            <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
          </div>
        </Show>

        <Show when={error()}>
          <DialogHeader>
            <DialogTitle>Subscription</DialogTitle>
          </DialogHeader>
          <p class="text-sm text-destructive">{error()}</p>
        </Show>

        <Show when={!loading() && !error() && !sub()}>
          <DialogHeader>
            <DialogTitle>Subscription</DialogTitle>
          </DialogHeader>
          <p class="text-sm text-muted-foreground">No active subscription found.</p>
        </Show>

        <Show when={!loading() && !error() && sub()}>
          {(subData) => (
            <Switch>
              <Match when={view() === "overview"}>
                <OverviewView
                  sub={subData()}
                  actionLoading={actionLoading()}
                  onCancel={() => setView("cancel")}
                  onPayment={() => setView("payment")}
                  onChangePlan={() => setView("change-plan")}
                  onResume={async () => {
                    setActionLoading(true);
                    try {
                      await resumeSubscription();
                      setSub({ ...subData(), cancelAtPeriodEnd: false });
                      showToast("Subscription resumed", "info");
                    } catch {
                      showToast("Failed to resume subscription", "error");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                />
              </Match>

              <Match when={view() === "cancel"}>
                <CancelView
                  sub={subData()}
                  actionLoading={actionLoading()}
                  onBack={() => setView("overview")}
                  onConfirm={async () => {
                    setActionLoading(true);
                    try {
                      const result = await cancelSubscription();
                      setSub({
                        ...subData(),
                        cancelAtPeriodEnd: result.cancelAtPeriodEnd,
                        currentPeriodEnd: result.currentPeriodEnd,
                      });
                      showToast("Subscription will cancel at period end", "info");
                      setView("overview");
                    } catch {
                      showToast("Failed to cancel subscription", "error");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                />
              </Match>

              <Match when={view() === "payment"}>
                <PaymentView
                  onBack={() => setView("overview")}
                  onSuccess={() => {
                    showToast("Payment method updated", "info");
                    load();
                    setView("overview");
                  }}
                />
              </Match>

              <Match when={view() === "change-plan"}>
                <ChangePlanView
                  currentTier={subData().tier}
                  actionLoading={actionLoading()}
                  onBack={() => setView("overview")}
                  onConfirm={async (newTier) => {
                    setActionLoading(true);
                    try {
                      await changePlan(newTier);
                      showToast(`Switched to ${TIER_LABELS[newTier] ?? newTier}`, "info");
                      load();
                      setView("overview");
                    } catch {
                      showToast("Failed to change plan", "error");
                    } finally {
                      setActionLoading(false);
                    }
                  }}
                />
              </Match>
            </Switch>
          )}
        </Show>
      </DialogContent>
    </Dialog>
  );
};

// ── Overview View ─────────────────────────────────────────────────────────

const OverviewView = (props: {
  sub: SubscriptionDetails;
  actionLoading: boolean;
  onCancel: () => void;
  onPayment: () => void;
  onChangePlan: () => void;
  onResume: () => void;
}) => (
  <>
    <DialogHeader>
      <DialogTitle>Your Subscription</DialogTitle>
      <DialogDescription>Manage your plan, billing, and payment method.</DialogDescription>
    </DialogHeader>

    <div class="space-y-4">
      {/* Plan info */}
      <div class="rounded-lg border border-border bg-muted/30 p-4">
        <div class="flex items-center justify-between">
          <div>
            <span class="text-sm font-medium text-foreground">
              {TIER_LABELS[props.sub.tier] ?? props.sub.tier}
            </span>
            <span class="ml-2 text-xs text-muted-foreground">
              {TIER_PRICES[props.sub.tier] ?? ""}
            </span>
          </div>
          <span
            class={`rounded-full px-2 py-0.5 text-xs font-medium ${
              props.sub.cancelAtPeriodEnd
                ? "bg-warning/10 text-warning"
                : props.sub.status === "active"
                  ? "bg-success/10 text-success"
                  : "bg-destructive/10 text-destructive"
            }`}
          >
            {props.sub.cancelAtPeriodEnd ? "Cancelling" : props.sub.status}
          </span>
        </div>

        <div class="mt-3 space-y-1 text-xs text-muted-foreground">
          <p>Member since {formatDate(props.sub.createdAt)}</p>
          <Show when={props.sub.currentPeriodEnd}>
            {(end) => (
              <p>
                {props.sub.cancelAtPeriodEnd ? "Access until" : "Next billing"}{" "}
                {formatDate(end())}
              </p>
            )}
          </Show>
        </div>
      </div>

      {/* Payment method */}
      <div class="flex items-center justify-between rounded-lg border border-border p-3">
        <div class="flex items-center gap-2">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            class="h-4 w-4 text-muted-foreground"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            stroke-width="2"
          >
            <path
              stroke-linecap="round"
              stroke-linejoin="round"
              d="M3 10h18M7 15h1m4 0h1m-7 4h12a3 3 0 003-3V8a3 3 0 00-3-3H6a3 3 0 00-3 3v8a3 3 0 003 3z"
            />
          </svg>
          <Show
            when={props.sub.paymentMethod}
            fallback={<span class="text-sm text-muted-foreground">No payment method</span>}
          >
            {(pm) => (
              <span class="text-sm text-foreground capitalize">
                {pm().brand} •••• {pm().last4}
              </span>
            )}
          </Show>
        </div>
        <button
          type="button"
          class="text-xs text-primary hover:underline"
          onClick={props.onPayment}
        >
          Update
        </button>
      </div>
    </div>

    <DialogFooter class="mt-4 flex-col gap-2 sm:flex-row">
      <button
        type="button"
        class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
        onClick={props.onChangePlan}
      >
        Change Plan
      </button>
      <Show
        when={!props.sub.cancelAtPeriodEnd}
        fallback={
          <button
            type="button"
            class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={props.actionLoading}
            onClick={props.onResume}
          >
            Resume Subscription
          </button>
        }
      >
        <button
          type="button"
          class="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90"
          onClick={props.onCancel}
        >
          Cancel Subscription
        </button>
      </Show>
    </DialogFooter>
  </>
);

// ── Cancel View ───────────────────────────────────────────────────────────

const CancelView = (props: {
  sub: SubscriptionDetails;
  actionLoading: boolean;
  onBack: () => void;
  onConfirm: () => void;
}) => (
  <>
    <DialogHeader>
      <DialogTitle>Cancel Subscription</DialogTitle>
      <DialogDescription>Are you sure you want to cancel?</DialogDescription>
    </DialogHeader>

    <div class="rounded-lg border border-warning/30 bg-warning/5 p-4 text-sm text-foreground">
      <p>
        Your subscription will remain active until{" "}
        <strong>{props.sub.currentPeriodEnd ? formatDate(props.sub.currentPeriodEnd) : "the end of your billing period"}</strong>.
        After that, you'll be downgraded to the Free plan.
      </p>
      <p class="mt-2 text-xs text-muted-foreground">
        You can resume your subscription at any time before then.
      </p>
    </div>

    <DialogFooter class="mt-4">
      <button
        type="button"
        class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
        onClick={props.onBack}
      >
        Go Back
      </button>
      <button
        type="button"
        class="rounded-lg bg-destructive px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-destructive/90 disabled:opacity-50"
        disabled={props.actionLoading}
        onClick={props.onConfirm}
      >
        {props.actionLoading ? "Cancelling..." : "Confirm Cancel"}
      </button>
    </DialogFooter>
  </>
);

// ── Payment View ──────────────────────────────────────────────────────────

const PaymentView = (props: {
  onBack: () => void;
  onSuccess: () => void;
}) => {
  const [loading, setLoading] = createSignal(true);
  const [error, setError] = createSignal<string | null>(null);
  const [submitting, setSubmitting] = createSignal(false);
  let stripeInstance: Stripe | null = null;
  let elementsInstance: StripeElements | null = null;
  // oxlint-disable-next-line eslint(no-unassigned-vars) -- SolidJS ref pattern
  let containerRef!: HTMLDivElement;

  onMount(async () => {
    try {
      const [stripe, clientSecret] = await Promise.all([
        getStripe(),
        createSetupIntent(),
      ]);

      if (!stripe) {
        setError("Payment system unavailable");
        setLoading(false);
        return;
      }

      stripeInstance = stripe;
      elementsInstance = stripe.elements({
        clientSecret,
        appearance: {
          theme: "night",
          variables: {
            colorPrimary: "#6ee7b7",
            colorBackground: "#141416",
            colorText: "#e5e7eb",
            borderRadius: "8px",
          },
        },
      });

      const paymentElement = elementsInstance.create("payment");
      paymentElement.mount(containerRef);
      setLoading(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to load payment form");
      setLoading(false);
    }
  });

  onCleanup(() => {
    elementsInstance?.getElement("payment")?.destroy();
  });

  const handleSubmit = async () => {
    if (!stripeInstance || !elementsInstance) return;
    setSubmitting(true);

    const { error: submitError } = await elementsInstance.submit();
    if (submitError) {
      showToast(submitError.message ?? "Validation failed", "error");
      setSubmitting(false);
      return;
    }

    const { error: confirmError, setupIntent } = await stripeInstance.confirmSetup({
      elements: elementsInstance,
      redirect: "if_required",
    });

    if (confirmError) {
      showToast(confirmError.message ?? "Payment setup failed", "error");
      setSubmitting(false);
      return;
    }

    if (setupIntent?.payment_method && typeof setupIntent.payment_method === "string") {
      try {
        await updatePaymentMethod(setupIntent.payment_method);
        props.onSuccess();
      } catch {
        showToast("Card saved but failed to set as default", "error");
      }
    }

    setSubmitting(false);
  };

  return (
    <>
      <DialogHeader>
        <DialogTitle>Update Payment Method</DialogTitle>
        <DialogDescription>Enter your new card details.</DialogDescription>
      </DialogHeader>

      <Show when={error()}>
        <p class="text-sm text-destructive">{error()}</p>
      </Show>

      <Show when={loading() && !error()}>
        <div class="flex items-center justify-center py-12">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
        </div>
      </Show>

      <div ref={containerRef} class={loading() || error() ? "hidden" : "min-h-[200px]"} />

      <DialogFooter class="mt-4">
        <button
          type="button"
          class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
          onClick={props.onBack}
        >
          Back
        </button>
        <Show when={!loading() && !error()}>
          <button
            type="button"
            class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
            disabled={submitting()}
            onClick={handleSubmit}
          >
            {submitting() ? "Saving..." : "Save Card"}
          </button>
        </Show>
      </DialogFooter>
    </>
  );
};

// ── Change Plan View ──────────────────────────────────────────────────────

const plans = [
  { tier: "supporter" as const, label: "Supporter", price: "$5/mo", features: "File sharing in servers, TURN relay, desktop app" },
  { tier: "server_owner" as const, label: "Server Owner", price: "$10/mo", features: "Everything in Supporter + create & manage servers" },
];

const ChangePlanView = (props: {
  currentTier: string;
  actionLoading: boolean;
  onBack: () => void;
  onConfirm: (tier: "supporter" | "server_owner") => void;
}) => {
  const [selected, setSelected] = createSignal<"supporter" | "server_owner">(
    props.currentTier === "supporter" ? "server_owner" : "supporter",
  );

  return (
    <>
      <DialogHeader>
        <DialogTitle>Change Plan</DialogTitle>
        <DialogDescription>Your billing will be prorated.</DialogDescription>
      </DialogHeader>

      <div class="space-y-2">
        {plans.map((plan) => (
          <button
            type="button"
            class={`w-full rounded-lg border p-3 text-left transition-colors ${
              selected() === plan.tier
                ? "border-primary bg-primary/5"
                : props.currentTier === plan.tier
                  ? "border-border bg-muted/30 opacity-60"
                  : "border-border hover:border-muted-foreground"
            }`}
            disabled={props.currentTier === plan.tier}
            onClick={() => setSelected(plan.tier)}
          >
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium text-foreground">{plan.label}</span>
              <span class="text-sm text-muted-foreground">{plan.price}</span>
            </div>
            <p class="mt-1 text-xs text-muted-foreground">{plan.features}</p>
            <Show when={props.currentTier === plan.tier}>
              <span class="mt-1 inline-block text-xs text-primary">Current plan</span>
            </Show>
          </button>
        ))}
      </div>

      <DialogFooter class="mt-4">
        <button
          type="button"
          class="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground transition-colors hover:bg-accent"
          onClick={props.onBack}
        >
          Back
        </button>
        <button
          type="button"
          class="rounded-lg bg-primary px-3 py-1.5 text-sm font-medium text-white transition-colors hover:bg-primary/90 disabled:opacity-50"
          disabled={props.actionLoading || selected() === props.currentTier}
          onClick={() => props.onConfirm(selected())}
        >
          {props.actionLoading ? "Switching..." : `Switch to ${TIER_LABELS[selected()] ?? selected()}`}
        </button>
      </DialogFooter>
    </>
  );
};

export default SubscriptionModal;
