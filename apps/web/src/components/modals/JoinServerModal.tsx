import { createSignal, Show } from "solid-js";
import { serverId, userId, type ServerId, type UserId, type InviteCode } from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import { addServer } from "../../lib/gateway-store.js";
import { setSelectedServerId } from "../../stores/app-store.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Button } from "../ui/button.js";

interface InvitePreview {
  code: InviteCode;
  server: { name: string; iconUrl: string | null };
  memberCount: number;
}

interface AcceptResponse {
  server: {
    id: ServerId;
    name: string;
    iconUrl: string | null;
    ownerId: UserId;
  };
}

interface Props {
  onClose: () => void;
}

const JoinServerModal = (props: Props) => {
  const [code, setCode] = createSignal("");
  const [preview, setPreview] = createSignal<InvitePreview | null>(null);
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const handlePreview = async (e: Event) => {
    e.preventDefault();
    const trimmed = code().trim();
    if (!trimmed) return;

    setError("");
    setLoading(true);
    try {
      const data = await api<InvitePreview>(`/api/invites/${encodeURIComponent(trimmed)}`);
      setPreview(data);
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.status === 404 ? "Invite not found" : err.body.message);
      } else {
        setError("Failed to fetch invite");
      }
    } finally {
      setLoading(false);
    }
  };

  const handleJoin = async () => {
    const p = preview();
    if (!p) return;

    setError("");
    setLoading(true);
    try {
      const data = await api<AcceptResponse>(`/api/invites/${encodeURIComponent(p.code)}/accept`, {
        method: "POST",
      });

      addServer({
        id: serverId(data.server.id),
        name: data.server.name,
        iconUrl: data.server.iconUrl,
        ownerId: userId(data.server.ownerId),
        channels: [],
      });
      setSelectedServerId(serverId(data.server.id));
      props.onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.status === 409 ? "You are already a member of this server" : err.body.message);
      } else {
        setError("Failed to join server");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => props.onClose()}>
      <DialogContent onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Join a Server</DialogTitle>
        </DialogHeader>

        <Show
          when={preview()}
          fallback={
            <form onSubmit={handlePreview}>
              <label class="mb-1 block text-sm font-medium text-secondary-foreground">
                Invite Code
              </label>
              <Input
                type="text"
                value={code()}
                onInput={(e) => setCode(e.currentTarget.value)}
                placeholder="abc12345"
                autofocus
                class="mb-4"
              />

              <Show when={error()}>
                <p role="alert" class="mb-3 text-sm text-destructive">
                  {error()}
                </p>
              </Show>

              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => props.onClose()}>
                  Cancel
                </Button>
                <Button type="submit" disabled={loading() || !code().trim()}>
                  {loading() ? "Looking up..." : "Preview"}
                </Button>
              </DialogFooter>
            </form>
          }
        >
          {(p) => (
            <div>
              <div class="mb-4 flex items-center gap-3 rounded-lg bg-secondary p-3">
                <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-muted text-lg font-bold text-foreground">
                  {p().server.iconUrl ? (
                    <img
                      src={p().server.iconUrl ?? undefined}
                      alt={p().server.name}
                      class="h-12 w-12 rounded-xl object-cover"
                    />
                  ) : (
                    p().server.name.charAt(0).toUpperCase()
                  )}
                </div>
                <div>
                  <div class="font-semibold text-foreground">{p().server.name}</div>
                  <div class="text-sm text-muted-foreground">
                    {p().memberCount} {p().memberCount === 1 ? "member" : "members"}
                  </div>
                </div>
              </div>

              <Show when={error()}>
                <p role="alert" class="mb-3 text-sm text-destructive">
                  {error()}
                </p>
              </Show>

              <DialogFooter>
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => {
                    setPreview(null);
                    setError("");
                  }}
                >
                  Back
                </Button>
                <Button type="button" onClick={handleJoin} disabled={loading()}>
                  {loading() ? "Joining..." : "Join Server"}
                </Button>
              </DialogFooter>
            </div>
          )}
        </Show>
      </DialogContent>
    </Dialog>
  );
};

export default JoinServerModal;
