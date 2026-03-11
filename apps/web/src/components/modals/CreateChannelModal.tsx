import { createSignal, Show } from "solid-js";
import type { ServerId, ChannelId } from "@uncorded/protocol";
import { channelId, serverId as toServerId } from "@uncorded/protocol";
import { CHANNEL_NAME_MAX } from "@uncorded/shared";
import { api, ApiRequestError } from "../../lib/api.js";
import { addChannel, type ReadyChannel } from "../../lib/gateway-store.js";
import { setSelectedChannelId } from "../../stores/app-store.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "../ui/dialog.js";
import { Input } from "../ui/input.js";
import { Button } from "../ui/button.js";

interface CreateChannelResponse {
  id: ChannelId;
  serverId: ServerId;
  name: string;
  type: string;
  fileSharingEnabled: boolean;
  position: number;
  topic: string | null;
}

interface Props {
  serverId: ServerId;
  onClose: () => void;
}

const CreateChannelModal = (props: Props) => {
  const [name, setName] = createSignal("");
  const [loading, setLoading] = createSignal(false);
  const [error, setError] = createSignal("");

  const handleSubmit = async (e: Event) => {
    e.preventDefault();
    setError("");

    const trimmed = name().trim();
    if (!trimmed) {
      setError("Channel name is required");
      return;
    }
    if (trimmed.length > CHANNEL_NAME_MAX) {
      setError(`Channel name must be ${CHANNEL_NAME_MAX} characters or less`);
      return;
    }

    setLoading(true);
    try {
      const ch = await api<CreateChannelResponse>(
        `/api/servers/${props.serverId}/channels`,
        {
          method: "POST",
          body: JSON.stringify({ name: trimmed }),
        },
      );

      const readyChannel: ReadyChannel = {
        id: channelId(ch.id),
        serverId: toServerId(ch.serverId),
        name: ch.name,
        type: ch.type,
        position: ch.position,
        topic: ch.topic,
        fileSharingEnabled: ch.fileSharingEnabled,
      };

      addChannel(props.serverId, readyChannel);
      setSelectedChannelId(channelId(ch.id));
      props.onClose();
    } catch (err) {
      if (err instanceof ApiRequestError) {
        setError(err.body.message);
      } else {
        setError("Failed to create channel");
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={true} onOpenChange={() => props.onClose()}>
      <DialogContent onClose={props.onClose}>
        <DialogHeader>
          <DialogTitle>Create Channel</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit}>
          <label for="channel-name" class="mb-1 block text-sm font-medium text-secondary-foreground">
            Channel Name
          </label>
          <Input
            id="channel-name"
            type="text"
            value={name()}
            onInput={(e) => setName(e.currentTarget.value)}
            maxLength={CHANNEL_NAME_MAX}
            placeholder="general"
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
            <Button type="submit" disabled={loading() || !name().trim()}>
              {loading() ? "Creating..." : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default CreateChannelModal;
