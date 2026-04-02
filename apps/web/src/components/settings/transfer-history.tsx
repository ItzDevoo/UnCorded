import { createSignal, createResource, For, Show } from "solid-js";
import { api } from "../../lib/api.js";
import { readyData } from "../../lib/gateway-store.js";
import { Button } from "../ui/button.js";
import { Empty } from "../ui/empty.js";
import { formatBytes } from "../FileMessage.js";

type FilterType = "all" | "sent" | "received";

interface FileReceiptResponse {
  id: string;
  fileName: string;
  fileSize: number;
  contentType: string;
  senderId: string | null;
  senderUsername: string | null;
  receiverId: string | null;
  receiverUsername: string | null;
  createdAt: string | null;
}

interface ReceiptsResponse {
  receipts: FileReceiptResponse[];
  hasMore: boolean;
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  return d.toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getFileIcon(contentType: string): string {
  if (contentType.startsWith("image/")) return "image";
  if (contentType.startsWith("video/")) return "video";
  if (contentType.startsWith("audio/")) return "audio";
  return "file";
}

const TransferHistory = () => {
  const [filter, setFilter] = createSignal<FilterType>("all");
  const [allReceipts, setAllReceipts] = createSignal<FileReceiptResponse[]>([]);
  const [cursor, setCursor] = createSignal<string | undefined>(undefined);
  const [hasMore, setHasMore] = createSignal(false);
  const [loadingMore, setLoadingMore] = createSignal(false);

  const currentUserId = () => readyData.data?.user.id;

  const fetchReceipts = async (type: FilterType) => {
    const data = await api<ReceiptsResponse>(`/api/file-receipts?type=${type}`);
    setAllReceipts(data.receipts);
    setHasMore(data.hasMore);
    if (data.receipts.length > 0) {
      const last = data.receipts[data.receipts.length - 1];
      setCursor(last?.createdAt ?? undefined);
    }
    return data;
  };

  const [receiptsResource] = createResource(filter, fetchReceipts);

  const loadMore = async () => {
    if (!hasMore() || loadingMore()) return;
    setLoadingMore(true);
    try {
      const c = cursor();
      const data = await api<ReceiptsResponse>(
        `/api/file-receipts?type=${filter()}${c ? `&cursor=${encodeURIComponent(c)}` : ""}`,
      );
      setAllReceipts((prev) => [...prev, ...data.receipts]);
      setHasMore(data.hasMore);
      if (data.receipts.length > 0) {
        const last = data.receipts[data.receipts.length - 1];
        setCursor(last?.createdAt ?? undefined);
      }
    } finally {
      setLoadingMore(false);
    }
  };

  return (
    <div>
      <h2 class="mb-1 text-xl font-semibold text-foreground">Transfer History</h2>
      <p class="mb-6 text-sm text-muted-foreground">
        Files you've sent and received via P2P sharing.
      </p>

      {/* Filter buttons */}
      <div class="mb-4 flex gap-1">
        {(["all", "sent", "received"] as const).map((type) => (
          <button
            class={`rounded-lg px-3 py-1.5 text-sm font-medium transition-colors ${
              filter() === type
                ? "bg-primary/10 text-primary"
                : "text-muted-foreground hover:bg-accent hover:text-foreground"
            }`}
            onClick={() => setFilter(type)}
          >
            {type.charAt(0).toUpperCase() + type.slice(1)}
          </button>
        ))}
      </div>

      {/* Loading state */}
      <Show when={receiptsResource.loading && allReceipts().length === 0}>
        <div class="flex items-center justify-center py-12">
          <div class="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
        </div>
      </Show>

      {/* Empty state */}
      <Show when={!receiptsResource.loading && allReceipts().length === 0}>
        <Empty
          title="No file transfers yet"
          description="Files you send or receive will appear here."
          icon={
            <svg
              xmlns="http://www.w3.org/2000/svg"
              class="h-12 w-12"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="1.5"
            >
              <path
                stroke-linecap="round"
                stroke-linejoin="round"
                d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
              />
            </svg>
          }
        />
      </Show>

      {/* Receipt list */}
      <Show when={allReceipts().length > 0}>
        <div class="space-y-2">
          <For each={allReceipts()}>
            {(receipt) => {
              const isSent = () => receipt.senderId === currentUserId();
              const otherUsername = () =>
                isSent() ? receipt.receiverUsername : receipt.senderUsername;

              return (
                <div class="flex items-center gap-3 rounded-lg border border-border bg-card px-4 py-3">
                  {/* File type icon */}
                  <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-muted">
                    <Show
                      when={getFileIcon(receipt.contentType) === "image"}
                      fallback={
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          class="h-5 w-5 text-muted-foreground"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                          stroke-width="2"
                        >
                          <path
                            stroke-linecap="round"
                            stroke-linejoin="round"
                            d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                          />
                        </svg>
                      }
                    >
                      <svg
                        xmlns="http://www.w3.org/2000/svg"
                        class="h-5 w-5 text-muted-foreground"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        stroke-width="2"
                      >
                        <path
                          stroke-linecap="round"
                          stroke-linejoin="round"
                          d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
                        />
                      </svg>
                    </Show>
                  </div>

                  {/* File info */}
                  <div class="min-w-0 flex-1">
                    <p class="truncate text-sm font-medium text-foreground">{receipt.fileName}</p>
                    <div class="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{formatBytes(receipt.fileSize)}</span>
                      <span>·</span>
                      <span class={isSent() ? "text-info" : "text-success"}>
                        {isSent() ? "Sent" : "Received"}
                      </span>
                      <Show when={otherUsername()}>
                        <span>·</span>
                        <span>
                          {isSent() ? "to" : "from"} {otherUsername()}
                        </span>
                      </Show>
                    </div>
                  </div>

                  {/* Date */}
                  <p class="shrink-0 text-xs text-muted-foreground">
                    {formatDate(receipt.createdAt)}
                  </p>
                </div>
              );
            }}
          </For>

          {/* Load more */}
          <Show when={hasMore()}>
            <div class="flex justify-center pt-2">
              <Button variant="ghost" size="sm" onClick={loadMore} disabled={loadingMore()}>
                <Show when={loadingMore()} fallback="Load More">
                  Loading...
                </Show>
              </Button>
            </div>
          </Show>
        </div>
      </Show>
    </div>
  );
};

export default TransferHistory;
