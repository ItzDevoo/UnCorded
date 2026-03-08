import { createSignal, Show } from "solid-js";
import { api, ApiRequestError } from "../../lib/api.js";
import { addServer } from "../../lib/gateway-store.js";
import { setSelectedServerId } from "../../stores/app-store.js";
import Modal from "./Modal.js";

interface InvitePreview {
  code: string;
  server: { name: string; iconUrl: string | null };
  memberCount: number;
}

interface AcceptResponse {
  server: {
    id: string;
    name: string;
    iconUrl: string | null;
    ownerId: string;
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
        id: data.server.id,
        name: data.server.name,
        iconUrl: data.server.iconUrl,
        ownerId: data.server.ownerId,
        channels: [],
      });
      setSelectedServerId(data.server.id);
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
    <Modal isOpen={true} onClose={props.onClose} title="Join a Server">
      <Show
        when={preview()}
        fallback={
          <form onSubmit={handlePreview}>
            <label class="mb-1 block text-sm font-medium text-text-secondary">Invite Code</label>
            <input
              type="text"
              value={code()}
              onInput={(e) => setCode(e.currentTarget.value)}
              placeholder="abc12345"
              class="mb-4 w-full rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand"
              autofocus
            />

            {error() && <p class="mb-3 text-sm text-danger">{error()}</p>}

            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={props.onClose}
                class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={loading() || !code().trim()}
                class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {loading() ? "Looking up..." : "Preview"}
              </button>
            </div>
          </form>
        }
      >
        {(p) => (
          <div>
            <div class="mb-4 flex items-center gap-3 rounded-lg bg-bg-tertiary p-3">
              <div class="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-bg-active text-lg font-bold text-text-primary">
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
                <div class="font-semibold text-text-primary">{p().server.name}</div>
                <div class="text-sm text-text-muted">
                  {p().memberCount} {p().memberCount === 1 ? "member" : "members"}
                </div>
              </div>
            </div>

            {error() && <p class="mb-3 text-sm text-danger">{error()}</p>}

            <div class="flex justify-end gap-3">
              <button
                type="button"
                onClick={() => {
                  setPreview(null);
                  setError("");
                }}
                class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
              >
                Back
              </button>
              <button
                type="button"
                onClick={handleJoin}
                disabled={loading()}
                class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
              >
                {loading() ? "Joining..." : "Join Server"}
              </button>
            </div>
          </div>
        )}
      </Show>
    </Modal>
  );
};

export default JoinServerModal;
