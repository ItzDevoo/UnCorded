import { createSignal, createMemo, Show, onCleanup } from "solid-js";
import type { FileReceipt, TransferProgress } from "../stores/file-store.js";
import { downloadFile, getTransferProgress, getSeeders } from "../stores/file-store.js";
import { readyData } from "../lib/gateway-store.js";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.js";

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
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg"]);

const FileMessage = (props: { receipt: FileReceipt; isOwn: boolean }) => {
  const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
  const [fullImageUrl, setFullImageUrl] = createSignal<string | null>(null);
  const [videoUrl, setVideoUrl] = createSignal<string | null>(null);
  const [downloadError, setDownloadError] = createSignal<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = createSignal(false);

  const transfer = createMemo<TransferProgress | undefined>(() =>
    getTransferProgress(props.receipt.infoHash),
  );

  const seeders = createMemo(() => getSeeders(props.receipt.id));
  const seederCount = createMemo(() => seeders().length);
  const isImage = createMemo(() => IMAGE_TYPES.has(props.receipt.contentType));
  const isVideo = createMemo(() => VIDEO_TYPES.has(props.receipt.contentType));

  const isFreeUser = createMemo(
    () => !readyData.data?.user.subscriptionTier || readyData.data.user.subscriptionTier === "free",
  );

  const status = createMemo(() => {
    const t = transfer();
    if (!t) return "idle";
    return t.status;
  });

  // Generate thumbnail for image types (preserving aspect ratio)
  async function generateThumbnail(blob: Blob): Promise<void> {
    // Set full image URL first (lightbox works even if thumbnail fails)
    const prevFull = fullImageUrl();
    if (prevFull) URL.revokeObjectURL(prevFull);
    setFullImageUrl(URL.createObjectURL(blob));

    try {
      const bitmap = await createImageBitmap(blob);
      const { width, height } = bitmap;

      // Cap dimensions at 400x300 while preserving aspect ratio
      const maxW = 400;
      const maxH = 300;
      const scale = Math.min(maxW / width, maxH / height, 1);
      const thumbW = Math.round(width * scale);
      const thumbH = Math.round(height * scale);

      const canvas = new OffscreenCanvas(thumbW, thumbH);
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        bitmap.close();
        return;
      }
      ctx.drawImage(bitmap, 0, 0, thumbW, thumbH);
      const thumbBlob = await canvas.convertToBlob({ type: "image/webp", quality: 0.7 });
      const prevThumb = thumbnailUrl();
      if (prevThumb) URL.revokeObjectURL(prevThumb);
      setThumbnailUrl(URL.createObjectURL(thumbBlob));
      bitmap.close();
    } catch {
      // Thumbnail failed but fullImageUrl is still set for lightbox
    }
  }

  // Generate video blob URL
  function generateVideoUrl(blob: Blob): void {
    const prev = videoUrl();
    if (prev) URL.revokeObjectURL(prev);
    setVideoUrl(URL.createObjectURL(blob));
  }

  function handleDownload() {
    setDownloadError(null);
    downloadFile(props.receipt.magnetUri, props.receipt.fileName)
      .then((files) => {
        if (files[0]) {
          if (isImage()) {
            generateThumbnail(files[0]);
          } else if (isVideo()) {
            generateVideoUrl(files[0]);
          }
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
        if (import.meta.env.DEV) console.error("[FileMessage] Download failed:", err);
      });
  }

  function openLightbox() {
    if (fullImageUrl()) {
      setLightboxOpen(true);
    }
  }

  // Clean up blob URLs
  onCleanup(() => {
    const thumb = thumbnailUrl();
    if (thumb) URL.revokeObjectURL(thumb);
    const full = fullImageUrl();
    if (full) URL.revokeObjectURL(full);
    const vid = videoUrl();
    if (vid) URL.revokeObjectURL(vid);
  });

  return (
    <div data-slot="file-message" class="my-1 rounded-lg border border-border bg-card p-3">
      <div class="flex items-center gap-3">
        {/* File icon or image/video indicator */}
        <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-secondary text-secondary-foreground">
          <Show
            when={isImage()}
            fallback={
              <Show
                when={isVideo()}
                fallback={
                  <svg
                    class="h-5 w-5"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    stroke-width="2"
                    aria-hidden="true"
                  >
                    <path
                      stroke-linecap="round"
                      stroke-linejoin="round"
                      d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                    />
                  </svg>
                }
              >
                {/* Video icon */}
                <svg
                  class="h-5 w-5"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9a2.25 2.25 0 0 0 2.25-2.25v-9a2.25 2.25 0 0 0-2.25-2.25h-9A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z"
                  />
                </svg>
              </Show>
            }
          >
            <svg
              class="h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2"
              aria-hidden="true"
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

          <Show when={status() === "cancelled"}>
            <Badge variant="outline">Cancelled</Badge>
            <Button size="sm" variant="ghost" onClick={handleDownload}>
              Retry
            </Button>
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
            {transfer()?.downloadSpeed
              ? ` \u2014 ${formatSpeed(transfer()?.downloadSpeed ?? 0)}`
              : ""}
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
        <button
          type="button"
          class="mt-2 cursor-pointer rounded-md"
          aria-label={`View ${props.receipt.fileName} full size`}
          onClick={openLightbox}
        >
          <img
            src={thumbnailUrl() ?? ""}
            alt={props.receipt.fileName}
            class="max-h-[300px] max-w-[400px] rounded-md object-contain"
          />
        </button>
      </Show>

      {/* Video preview (inline player after download) */}
      <Show when={isVideo() && videoUrl() && status() === "done"}>
        <div class="relative mt-2">
          <video
            src={videoUrl() ?? ""}
            controls
            preload="metadata"
            class="max-h-[300px] max-w-[400px] rounded-md bg-black object-contain"
          >
            <track kind="captions" />
          </video>
        </div>
      </Show>

      {/* Image Lightbox Dialog */}
      <Dialog open={lightboxOpen()} onOpenChange={setLightboxOpen}>
        <DialogContent
          onClose={() => setLightboxOpen(false)}
          class="max-w-[95vw] border-none bg-transparent p-0 shadow-none"
        >
          <DialogHeader class="px-4 pt-4">
            <DialogTitle class="text-sm font-medium text-foreground">
              {props.receipt.fileName}
              <span class="ml-2 text-xs text-muted-foreground">
                {formatBytes(props.receipt.fileSize)}
              </span>
            </DialogTitle>
          </DialogHeader>
          <div class="flex items-center justify-center p-4">
            <img
              src={fullImageUrl() ?? ""}
              alt={props.receipt.fileName}
              class="max-h-[85vh] max-w-[90vw] rounded-md object-contain"
            />
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default FileMessage;
export { formatBytes };
