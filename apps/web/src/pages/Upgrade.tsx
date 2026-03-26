import { createSignal, Show } from "solid-js";
import { useNavigate } from "@solidjs/router";
import PricingModal from "../components/modals/PricingModal.js";
import CheckoutModal from "../components/modals/CheckoutModal.js";

const Upgrade = () => {
  const navigate = useNavigate();
  const [checkoutTier, setCheckoutTier] = createSignal<"supporter" | "server_owner" | null>(null);
  const [showPricing, setShowPricing] = createSignal(true);

  return (
    <>
      <Show when={showPricing()}>
        <PricingModal
          onClose={() => {
            setShowPricing(false);
            navigate("/settings/profile");
          }}
          onSelect={(tier) => {
            setShowPricing(false);
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

export default Upgrade;
