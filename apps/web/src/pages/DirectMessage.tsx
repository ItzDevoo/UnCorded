import { createEffect, Show } from "solid-js";
import { useParams, useNavigate } from "@solidjs/router";
import type { DmChannelId } from "@uncorded/protocol";
import { readyData } from "../lib/gateway-store.js";
import { selectDmChannel, selectedDmChannelId } from "../stores/app-store.js";
import ChatArea from "../components/ChatArea.js";
import { Empty } from "../components/ui/empty.js";

const DirectMessage = () => {
  const params = useParams<{ userId: string }>();
  const navigate = useNavigate();

  // Auto-select the DM channel matching the URL userId
  createEffect(() => {
    const userId = params.userId;
    const dm = readyData.data?.dmChannels.find((d) => d.otherUser.id === userId);
    if (dm && selectedDmChannelId() !== dm.id) {
      selectDmChannel(dm.id as DmChannelId);
    }
  });

  const hasDm = () =>
    readyData.data?.dmChannels.some((d) => d.otherUser.id === params.userId) ?? false;

  return (
    <Show
      when={hasDm()}
      fallback={
        <Empty
          title="Conversation not found"
          description="This DM doesn't exist or hasn't started yet."
        >
          <button
            type="button"
            onClick={() => navigate("/messages")}
            class="mt-2 rounded-md border border-border px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
          >
            &larr; Back to Messages
          </button>
        </Empty>
      }
    >
      <ChatArea />
    </Show>
  );
};

export default DirectMessage;
