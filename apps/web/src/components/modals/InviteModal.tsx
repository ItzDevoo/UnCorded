import { createSignal, onMount, onCleanup, Show } from "solid-js";
import type { ServerId, InviteCode, UserId } from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import Modal from "./Modal.js";

interface InviteResponse {
  code: InviteCode;
  serverId: ServerId;
  creatorId: UserId;
  uses: number;
  maxUses: number | null;
  expiresAt: string | null;
}

interface Props {
  serverId: ServerId;
  onClose: () => void;
}

const InviteModal = (props: Props) => {
  const [invite, setInvite] = createSignal<InviteResponse | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");
  const [copied, setCopied] = createSignal(false);
  const [showAdvanced, setShowAdvanced] = createSignal(false);
  const [maxUses, setMaxUses] = createSignal("");
  const [expiresIn, setExpiresIn] = createSignal("");

  const generateInvite = async (options?: { maxUses?: number; expiresAt?: string }) => {
    setError("");
    setLoading(true);
    try {
      const body: Record<string, unknown> = {};
      if (options?.maxUses) body.maxUses = options.maxUses;
      if (options?.expiresAt) body.expiresAt = options.expiresAt;

      const data = await api<InviteResponse>(`/api/servers/${props.serverId}/invites`, {
        method: "POST",
        body: JSON.stringify(body),
      });
      setInvite(data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError("Failed to create invite");
      }
    } finally {
      setLoading(false);
    }
  };

  onMount(() => generateInvite());

  let copiedTimer: ReturnType<typeof setTimeout> | undefined;
  onCleanup(() => clearTimeout(copiedTimer));

  const handleCopy = async () => {
    const inv = invite();
    if (!inv) return;
    try {
      await navigator.clipboard.writeText(inv.code);
      setCopied(true);
      clearTimeout(copiedTimer);
      copiedTimer = setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("Failed to copy");
    }
  };

  const handleGenerateAdvanced = () => {
    const options: { maxUses?: number; expiresAt?: string } = {};
    const uses = maxUses().trim() ? parseInt(maxUses(), 10) : undefined;
    const hours = expiresIn().trim() ? parseInt(expiresIn(), 10) : undefined;
    if (uses !== undefined) options.maxUses = uses;
    if (hours !== undefined)
      options.expiresAt = new Date(Date.now() + hours * 3600_000).toISOString();
    generateInvite(options);
  };

  return (
    <Modal isOpen={true} onClose={props.onClose} title="Invite People">
      <Show
        when={!loading() || invite()}
        fallback={
          <div class="flex justify-center py-6">
            <div class="h-8 w-8 animate-spin rounded-full border-2 border-brand border-t-transparent" />
          </div>
        }
      >
        {error() && <p class="mb-3 text-sm text-danger">{error()}</p>}

        <Show when={invite()}>
          {(inv) => (
            <>
              <label class="mb-1 block text-sm font-medium text-text-secondary">Invite Code</label>
              <div class="mb-4 flex gap-2">
                <input
                  type="text"
                  value={inv().code}
                  readOnly
                  class="flex-1 rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary outline-none"
                />
                <button
                  type="button"
                  onClick={handleCopy}
                  class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover"
                >
                  {copied() ? "Copied!" : "Copy"}
                </button>
              </div>

              <button
                type="button"
                onClick={() => setShowAdvanced((v) => !v)}
                class="mb-3 text-xs text-text-muted hover:text-text-secondary"
              >
                {showAdvanced() ? "Hide advanced" : "Advanced options"}
              </button>

              <Show when={showAdvanced()}>
                <div class="mb-4 space-y-3 rounded-lg bg-bg-tertiary p-3">
                  <div>
                    <label class="mb-1 block text-xs font-medium text-text-secondary">
                      Max Uses
                    </label>
                    <input
                      type="number"
                      value={maxUses()}
                      onInput={(e) => setMaxUses(e.currentTarget.value)}
                      placeholder="Unlimited"
                      min="1"
                      class="w-full rounded-lg bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <div>
                    <label class="mb-1 block text-xs font-medium text-text-secondary">
                      Expires In (hours)
                    </label>
                    <input
                      type="number"
                      value={expiresIn()}
                      onInput={(e) => setExpiresIn(e.currentTarget.value)}
                      placeholder="Never"
                      min="1"
                      class="w-full rounded-lg bg-bg-input px-3 py-1.5 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                  <button
                    type="button"
                    onClick={handleGenerateAdvanced}
                    disabled={loading()}
                    class="rounded-lg bg-bg-active px-3 py-1.5 text-sm text-text-primary hover:bg-bg-hover disabled:opacity-50"
                  >
                    {loading() ? "Generating..." : "Generate New"}
                  </button>
                </div>
              </Show>
            </>
          )}
        </Show>
      </Show>

      <div class="flex justify-end">
        <button
          type="button"
          onClick={() => props.onClose()}
          class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
        >
          Done
        </button>
      </div>
    </Modal>
  );
};

export default InviteModal;
