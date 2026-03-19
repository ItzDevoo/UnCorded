import { createSignal } from "solid-js";
import { Opcode } from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";
import { updateCurrentUser } from "../lib/gateway-store.js";

interface GiftState {
  show: boolean;
  tier: string;
  expiresAt: string;
  days: number;
}

const [giftState, setGiftState] = createSignal<GiftState>({
  show: false,
  tier: "",
  expiresAt: "",
  days: 0,
});

export { giftState };

export function dismissGift() {
  setGiftState((prev) => ({ ...prev, show: false }));
}

const VALID_TIERS = new Set(["supporter", "server_owner"]);

export function setupGiftStore() {
  onGatewayEvent(Opcode.SUBSCRIPTION_GIFT, (data) => {
    const d = data as Record<string, unknown>;
    const tier = typeof d.tier === "string" ? d.tier : "";
    const expiresAt = typeof d.expiresAt === "string" ? d.expiresAt : "";
    const days = typeof d.days === "number" ? d.days : 0;
    if (!VALID_TIERS.has(tier)) return;

    // Update the reactive user store so tier-gated UI updates immediately
    updateCurrentUser({ subscriptionTier: tier });

    // Show the gift notification popup
    setGiftState({
      show: true,
      tier,
      expiresAt,
      days,
    });
  });
}
