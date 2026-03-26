import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import SubscriptionModal from "../components/modals/SubscriptionModal.js";
import CheckoutModal from "../components/modals/CheckoutModal.js";

const Billing = () => {
  const navigate = useNavigate();
  const [checkoutTier, setCheckoutTier] = createSignal<"supporter" | "server_owner" | null>(null);
  const [showSub, setShowSub] = createSignal(true);

  return (
    <>
      <Show when={showSub()}>
        <SubscriptionModal
          onClose={() => {
            setShowSub(false);
            navigate("/settings/profile");
          }}
          onCheckout={(tier) => {
            setShowSub(false);
            setCheckoutTier(tier);
          }}
        />
      </Show>
      <Show when={checkoutTier()}>
        {(tier) => (
          <CheckoutModal
            tier={tier()}
            onClose={() => {
              setCheckoutTier(null);
              navigate("/settings/profile");
            }}
          />
        )}
      </Show>
    </>
  );
};

export default Billing;
