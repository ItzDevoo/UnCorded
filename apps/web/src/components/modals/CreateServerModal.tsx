import { createSignal } from "solid-js";
import { createServerSchema } from "@uncorded/shared";
import {
  serverId,
  userId,
  channelId,
  type ServerId,
  type UserId,
  type ChannelId,
} from "@uncorded/protocol";
import { api, ApiRequestError } from "../../lib/api.js";
import { addServer, type ReadyServer } from "../../lib/gateway-store.js";
import { setSelectedServerId } from "../../stores/app-store.js";
import Modal from "./Modal.js";

interface CreateServerResponse {
  id: ServerId;
  name: string;
  iconUrl: string | null;
  ownerId: UserId;
  channels: {
    id: ChannelId;
    serverId: ServerId;
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
        id: serverId(server.id),
        name: server.name,
        iconUrl: server.iconUrl,
        ownerId: userId(server.ownerId),
        channels: server.channels.map((ch) => ({
          id: channelId(ch.id),
          serverId: serverId(ch.serverId),
          name: ch.name,
          type: ch.type,
          position: ch.position,
          topic: ch.topic,
          fileSharingEnabled: ch.fileSharingEnabled,
        })),
      };

      addServer(readyServer);
      setSelectedServerId(serverId(server.id));
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
        <label class="mb-1 block text-sm font-medium text-secondary-foreground">Server Name</label>
        <input
          type="text"
          value={name()}
          onInput={(e) => setName(e.currentTarget.value)}
          maxLength={100}
          placeholder="My Awesome Server"
          class="mb-4 w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
          autofocus
        />

        <label class="mb-1 block text-sm font-medium text-secondary-foreground">
          Icon URL <span class="text-muted-foreground">(optional)</span>
        </label>
        <input
          type="text"
          value={iconUrl()}
          onInput={(e) => setIconUrl(e.currentTarget.value)}
          placeholder="https://example.com/icon.png"
          class="mb-4 w-full rounded-lg bg-input px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground outline-none focus:ring-2 focus:ring-ring"
        />

        {error() && <p class="mb-3 text-sm text-destructive">{error()}</p>}

        <div class="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => props.onClose()}
            class="rounded-lg px-4 py-2 text-sm text-secondary-foreground hover:text-foreground"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading() || !name().trim()}
            class="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-white hover:bg-primary/80 disabled:opacity-50"
          >
            {loading() ? "Creating..." : "Create"}
          </button>
        </div>
      </form>
    </Modal>
  );
};

export default CreateServerModal;
