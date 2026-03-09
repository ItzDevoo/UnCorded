import { createSignal, Show } from "solid-js";
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
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Button } from "../ui/button.js";

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
    <Dialog open={true} onOpenChange={() => props.onClose()}>
      <DialogContent onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Create a Server</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <label class="mb-1 block text-sm font-medium text-secondary-foreground">
            Server Name
          </label>
          <Input
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={100}
            placeholder="My Awesome Server"
            autofocus
            class="mb-4"
          />

          <label class="mb-1 block text-sm font-medium text-secondary-foreground">
            Icon URL <span class="text-muted-foreground">(optional)</span>
          </label>
          <Input
            type="text"
            value={iconUrl()}
            onInput={(e) => setIconUrl(e.currentTarget.value)}
            placeholder="https://example.com/icon.png"
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
            <Button type="submit" disabled={loading() || !name().trim()}>
              {loading() ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateServerModal;
