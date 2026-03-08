import { createSignal } from "solid-js";
import { createServerSchema } from "@uncorded/shared";
import { api, ApiRequestError } from "../../lib/api.js";
import { addServer, type ReadyServer } from "../../lib/gateway-store.js";
import { setSelectedServerId } from "../../stores/app-store.js";
import Modal from "./Modal.js";

interface CreateServerResponse {
  id: string;
  name: string;
  iconUrl: string | null;
  ownerId: string;
  channels: {
    id: string;
    serverId: string;
    name: string;
    type: string;
    fileSharingEnabled: boolean;
    position: number;
    topic: string | null;
  }[];
}

interface Props {
  onClose: () => void;
}

const CreateServerModal = (props: Props) => {
  const [name, setName] = createSignal("");
  const [iconUrl, setIconUrl] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    const body = {
      name: name().trim(),
      iconUrl: iconUrl().trim() || null,
    };

    const result = createServerSchema.safeParse(body);
    if (!result.success) {
      setError(result.error.issues[0]?.message ?? "Invalid input");
      return;
    }

    setLoading(true);
    try {
      const server = await api<CreateServerResponse>("/api/servers", {
        method: "POST",
        body: JSON.stringify(body),
      });

      const readyServer: ReadyServer = {
        id: server.id,
        name: server.name,
        iconUrl: server.iconUrl,
        ownerId: server.ownerId,
        channels: server.channels.map((ch) => ({
          id: ch.id,
          serverId: ch.serverId,
          name: ch.name,
          type: ch.type,
          position: ch.position,
          topic: ch.topic,
          fileSharingEnabled: ch.fileSharingEnabled,
        })),
      };

      addServer(readyServer);
      setSelectedServerId(server.id);
      props.onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError("Failed to create server");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal isOpen={true} onClose={props.onClose} title="Create a Server">
      <form onSubmit={handleSubmit}>
        <label class="mb-1 block text-sm font-medium text-text-secondary">Server Name</label>
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          maxLength={100}
          placeholder="My Awesome Server"
          class="mb-4 w-full rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand"
          autofocus
        />

        <label class="mb-1 block text-sm font-medium text-text-secondary">
          Icon URL <span class="text-text-muted">(optional)</span>
        </label>
        <input
          type="text"
          value={iconUrl()}
          onInput={(e) => setIconUrl(e.currentTarget.value)}
          placeholder="https://example.com/icon.png"
          class="mb-4 w-full rounded-lg bg-bg-input px-3 py-2 text-sm text-text-primary placeholder:text-text-muted outline-none focus:ring-2 focus:ring-brand"
        />

        {error() && <p class="mb-3 text-sm text-danger">{error()}</p>}

        <div class="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-lg px-4 py-2 text-sm text-text-secondary hover:text-text-primary"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading() || !name().trim()}
            class="rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover disabled:opacity-50"
          >
            {loading() ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateServerModal;
