import { createSignal, createMemo, Show, onCleanup } from "solid-js";
import type { FileReceipt, TransferProgress } from "../stores/file-store.js";
import { downloadFile, getTransferProgress, getSeeders } from "../stores/file-store.js";
import { readyData } from "../lib/gateway-store.js";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

function formatSpeed(bytesPerSec: number): string {
  return `${formatBytes(bytesPerSec)}/s`;
}

const IMAGE_TYPES = new Set(["image/png", "image/jpeg", "image/gif", "image/webp"]);

const FileMessage = (props: { receipt: FileReceipt; isOwn: boolean }) => {
  const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
  const [downloadError, setDownloadError] = createSignal<string | null>(null);

  const transfer = createMemo<TransferProgress | undefined>(() =>
    getTransferProgress(props.receipt.infoHash),
  );

  const seeders = createMemo(() => getSeeders(props.receipt.id));
  const seederCount = createMemo(() => seeders().length);
  const isImage = createMemo(() => IMAGE_TYPES.has(props.receipt.contentType));

  const isFreeUser = createMemo(
    () =>
      (readyData.data?.user as { subscriptionTier?: string } | undefined)?.subscriptionTier ===
        "free" ||
      !(readyData.data?.user as { subscriptionTier?: string } | undefined)?.subscriptionTier,
  );

  const status = createMemo(() => {
    const t = transfer();
    if (!t) return "idle";
    return t.status;
  });

  // Generate thumbnail for image types when a download completes
  async function generateThumbnail(blob: Blob): Promise<void> {
    try {
      const bitmap = await createImageBitmap(blob, {
        resizeWidth: 300,
        resizeHeight: 200,
        resizeQuality: "medium",
      });
      const canvas = new OffscreenCanvas(bitmap.width, bitmap.height);
      const ctx = canvas.getContext("2d");
      if (!ctx) return;
      ctx.drawImage(bitmap, 0, 0);
      const thumbBlob = await canvas.convertToBlob({ type: "image/webp", quality: 0.7 });
      setThumbnailUrl(URL.createObjectURL(thumbBlob));
      bitmap.close();
    } catch {
      // Not all images can be decoded — silently skip thumbnail
    }
  }

  function handleDownload() {
    setDownloadError(null);
    downloadFile(props.receipt.magnetUri, props.receipt.fileName)
      .then((files) => {
        // Generate thumbnail for image types after download
        if (isImage() && files[0]) {
          generateThumbnail(files[0]);
        }
      })
      .catch((err) => {
        const noSeeders = seederCount() === 0;
        if (noSeeders) {
          setDownloadError("File unavailable \u2014 no seeders online");
        } else if (isFreeUser()) {
          setDownloadError(
            "File sharing requires both users to be online. Upgrade to Supporter for relay-assisted transfers.",
          );
        } else {
          setDownloadError("Download failed. Please try again.");
        }
        console.error("[FileMessage] Download failed:", err);
      });
  }

  // Clean up thumbnail blob URL
  onCleanup(() => {
    const url = thumbnailUrl();
    if (url) URL.revokeObjectURL(url);
  });

  return (
    <div data-slot="file-message" class="my-1 rounded-lg border border-border bg-card p-3">
      <div class="flex items-center gap-3">
        {/* File icon or image indicator */}
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Show
            when={isImage()}
            fallback={
              <svg
                class="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                />
              </svg>
            }
          >
            <svg
              class="h-5 w-5"
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
          <p class="truncate text-sm font-medium text-foreground">{props.receipt.fileName}</p>
          <p class="text-xs text-muted-foreground">{formatBytes(props.receipt.fileSize)}</p>
        </div>

        {/* Status actions */}
        <div class="flex shrink-0 items-center gap-2">
          <Show when={status() === "idle" && !props.isOwn}>
            <Button size="sm" variant="outline" onClick={handleDownload}>
              Download
            </Button>
          </Show>

          <Show when={status() === "seeding"}>
            <Badge variant="success">Seeding</Badge>
          </Show>

          <Show when={status() === "done"}>
            <Badge variant="success">Saved</Badge>
          </Show>

          {/* Seeder count badge */}
          <Show when={seederCount() > 0}>
            <Badge variant="outline">
              {seederCount()} {seederCount() === 1 ? "seeder" : "seeders"}
            </Badge>
          </Show>
          <Show when={seederCount() === 0 && !props.isOwn && status() === "idle"}>
            <Badge variant="outline" class="text-muted-foreground">
              No seeders online
            </Badge>
          </Show>
        </div>
      </div>

      {/* Download progress bar */}
      <Show when={status() === "downloading"}>
        <div class="mt-2">
          <div class="h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div
              class="h-full rounded-full bg-primary transition-[width] duration-300"
              style={{ width: `${(transfer()?.progress ?? 0) * 100}%` }}
            />
          </div>
          <p class="mt-1 text-xs text-muted-foreground">
            {Math.round((transfer()?.progress ?? 0) * 100)}%
            {transfer()?.downloadSpeed ? ` \u2014 ${formatSpeed(transfer()!.downloadSpeed)}` : ""}
          </p>
        </div>
      </Show>

      {/* Error state */}
      <Show when={status() === "error" || downloadError()}>
        <div class="mt-2">
          <p class="text-xs text-destructive">
            {downloadError() ?? transfer()?.error ?? "Download failed. Please try again."}
          </p>
          <Button size="sm" variant="ghost" class="mt-1" onClick={handleDownload}>
            Retry
          </Button>
        </div>
      </Show>

      {/* Image preview (inline thumbnail) */}
      <Show when={isImage() && thumbnailUrl()}>
        <div class="mt-2">
          <img
            src={thumbnailUrl()!}
            alt={props.receipt.fileName}
            class="max-h-[200px] max-w-[300px] cursor-pointer rounded-md"
            onClick={handleDownload}
          />
        </div>
      </Show>
    </div>
  );
};

export default FileMessage;
export { formatBytes };
