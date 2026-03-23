import { createSignal } from "solid-js";
import { Opcode } from "@uncorded/protocol";
import { onGatewayEvent } from "../lib/gateway.js";

interface DeletionState {
  show: boolean;
  expiresAt: string | null;
}

const [deletionState, setDeletionState] = createSignal<DeletionState>({
  show: false,
  expiresAt: null,
});

export { deletionState };

export function dismissDeletion() {
  setDeletionState({ show: false, expiresAt: null });
}

function isValidDateString(value: string): boolean {
  const d = new Date(value);
  return !Number.isNaN(d.getTime());
}

export function showPendingDeletion(expiresAt: string) {
  if (!isValidDateString(expiresAt)) return;
  setDeletionState({ show: true, expiresAt });
}

export function setupDeletionStore() {
  onGatewayEvent(Opcode.ACCOUNT_DELETION_PENDING, (data) => {
    const d = data as Record<string, unknown>;
    const expiresAt = typeof d.expiresAt === "string" ? d.expiresAt : null;
    if (!expiresAt || !isValidDateString(expiresAt)) return;

    setDeletionState({ show: true, expiresAt });
  });

  onGatewayEvent(Opcode.ACCOUNT_DELETION_CANCELLED, () => {
    setDeletionState({ show: false, expiresAt: null });
  });
}
