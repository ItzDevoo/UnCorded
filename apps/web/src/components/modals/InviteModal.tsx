import { createSignal, onMount, onCleanup, Show } from "solid-js";
import type { ServerId, InviteCode, UserId } from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Button } from "../ui/button.js";

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
      const body: { maxUses?: number; expiresAt?: string } = {};
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
    <Dialog open={true} onOpenChange={() => props.onClose()}>
      <DialogContent onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Invite People</DialogTitle>
        </DialogHeader>

        <Show
          when={!loading() || invite()}
          fallback={
            <div class="flex justify-center py-6">
              <div class="h-8 w-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          }
        >
          <Show when={error()}>
            <p role="alert" class="mb-3 text-sm text-destructive">{error()}</p>
          </Show>

          <Show when={invite()}>
            {(inv) => (
              <>
                <label class="mb-1 block text-sm font-medium text-secondary-foreground">Invite Code</label>
                <div class="mb-4 flex gap-2">
                  <Input
                    type="text"
                    value={inv().code}
                    readOnly
                    class="flex-1"
                  />
                  <Button type="button" onClick={handleCopy}>
                    {copied() ? "Copied!" : "Copy"}
                  </Button>
                </div>

                <Button
                  type="button"
                  variant="link"
                  size="sm"
                  onClick={() => setShowAdvanced((v) => !v)}
                  class="mb-3 text-xs text-muted-foreground"
                >
                  {showAdvanced() ? "Hide advanced" : "Advanced options"}
                </Button>

                <Show when={showAdvanced()}>
                  <div class="mb-4 space-y-3 rounded-lg bg-secondary p-3">
                    <div>
                      <label class="mb-1 block text-xs font-medium text-secondary-foreground">
                        Max Uses
                      </label>
                      <Input
                        type="number"
                        value={maxUses()}
                        onInput={(e) => setMaxUses(e.currentTarget.value)}
                        placeholder="Unlimited"
                        min="1"
                      />
                    </div>
                    <div>
                      <label class="mb-1 block text-xs font-medium text-secondary-foreground">
                        Expires In (hours)
                      </label>
                      <Input
                        type="number"
                        value={expiresIn()}
                        onInput={(e) => setExpiresIn(e.currentTarget.value)}
                        placeholder="Never"
                        min="1"
                      />
                    </div>
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      onClick={handleGenerateAdvanced}
                      disabled={loading()}
                    >
                      {loading() ? "Generating..." : "Generate New"}
                    </Button>
                  </div>
                </Show>
              </>
            )}
          </Show>
        </Show>

        <DialogFooter>
          <Button type="button" variant="ghost" onClick={() => props.onClose()}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default InviteModal;
