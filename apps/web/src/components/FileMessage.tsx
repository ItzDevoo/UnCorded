import { createSignal, createMemo, createEffect, Show, onCleanup, untrack } from "solid-js";
import type { FileReceipt, TransferProgress } from "../stores/file-store.js";
import {
  previewFile,
  saveFile,
  getTransferProgress,
  getSeeders,
  getPreviews,
} from "../stores/file-store.js";
import { TorrentTimeoutError } from "../lib/torrent-client.js";
import { readyData } from "../lib/gateway-store.js";
import { Button } from "./ui/button.js";
import { Badge } from "./ui/badge.js";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "./ui/dialog.js";
import MessageContent from "./MessageContent.js";

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
const TEXT_TYPES = new Set([
  "text/plain",
  "text/markdown",
  "text/csv",
  "text/html",
  "application/json",
  "application/xml",
]);

const MAX_TEXT_BYTES = 50 * 1024;
const MAX_TEXT_LINES = 500;

const FileMessage = (props: { receipt: FileReceipt; isOwn: boolean }) => {
  const [thumbnailUrl, setThumbnailUrl] = createSignal<string | null>(null);
  const [fullImageUrl, setFullImageUrl] = createSignal<string | null>(null);
  const [videoUrl, setVideoUrl] = createSignal<string | null>(null);
  const [downloadError, setDownloadError] = createSignal<string | null>(null);
  const [lightboxOpen, setLightboxOpen] = createSignal(false);
  const [textContent, setTextContent] = createSignal<string | null>(null);
  const [textTruncated, setTextTruncated] = createSignal(false);
  const [saved, setSaved] = createSignal(false);

  const transfer = createMemo<TransferProgress | undefined>(() =>
    getTransferProgress(props.receipt.infoHash),
  );

  const seeders = createMemo(() => getSeeders(props.receipt.id));
  const seederCount = createMemo(() => seeders().length);
  const isImage = createMemo(() => IMAGE_TYPES.has(props.receipt.contentType));
  const isVideo = createMemo(() => VIDEO_TYPES.has(props.receipt.contentType));
  const isText = createMemo(() => TEXT_TYPES.has(props.receipt.contentType));
  const isMarkdown = createMemo(() => props.receipt.contentType === "text/markdown");

  const isFreeUser = createMemo(
    () => !readyData.data?.user.subscriptionTier || readyData.data.user.subscriptionTier === "free",
  );

  const status = createMemo(() => {
    const t = transfer();
    if (!t) return "idle";
    return t.status;
  });

  const previews = createMemo(() => getPreviews(props.receipt.infoHash));

  // Auto-render preview when cached files are available (sender or receiver)
  createEffect(() => {
    const files = previews();
    if (!files) return;
    const file = files[0];
    if (!file) return;
    untrack(() => renderPreview(file));
  });

  function renderPreview(file: File): void {
    if (isImage()) {
      generateThumbnail(file);
    } else if (isVideo()) {
      generateVideoUrl(file);
    } else if (isText()) {
      readTextContent(file);
    }
  }

  async function readTextContent(file: File): Promise<void> {
    try {
      const slice = file.size > MAX_TEXT_BYTES ? file.slice(0, MAX_TEXT_BYTES) : file;
      const raw = await slice.text();
      const lines = raw.split("\n");
      if (lines.length > MAX_TEXT_LINES || file.size > MAX_TEXT_BYTES) {
        setTextContent(lines.slice(0, MAX_TEXT_LINES).join("\n"));
        setTextTruncated(true);
      } else {
        setTextContent(raw);
        setTextTruncated(false);
      }
    } catch {
      // Text reading failed — preview simply won't show
      if (import.meta.env.DEV) console.warn("[FileMessage] Text preview failed");
    }
  }

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

  function handlePreview(): void {
    setDownloadError(null);
    previewFile(props.receipt.magnetUri, props.receipt.fileName, props.receipt)
      .then((files) => {
        const file = files[0];
        if (file) {
          renderPreview(file);
        }
      })
      .catch((err) => {
        if (seederCount() === 0) {
          setDownloadError("File unavailable \u2014 no seeders online");
        } else if (err instanceof TorrentTimeoutError) {
          setDownloadError(
            isFreeUser()
              ? "Could not connect to the sender. Upgrade to Supporter for more reliable file transfers, or ask them to share via DM instead."
              : "Could not connect to the sender. They may be on a restricted network \u2014 try again shortly.",
          );
        } else {
          setDownloadError("Download failed. Please try again.");
        }
        if (import.meta.env.DEV) console.error("[FileMessage] Preview failed:", err);
      });
  }

  function handleSave(): void {
    saveFile(props.receipt.infoHash);
    setSaved(true);
  }

  function openLightbox(): void {
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
                  <Show
                    when={isText()}
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
                    {/* Text file icon */}
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
                        d="M19.5 14.25v-2.625a3.375 3.375 0 0 0-3.375-3.375h-1.5A1.125 1.125 0 0 1 13.5 7.125v-1.5a3.375 3.375 0 0 0-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 0 0-9-9Z"
                      />
                    </svg>
                  </Show>
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
          {/* Preview button for non-owners in idle state — only when seeders are online */}
          <Show when={status() === "idle" && !props.isOwn && seederCount() > 0}>
            <Button size="sm" variant="outline" onClick={handlePreview}>
              <svg
                class="mr-1 h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                stroke-width="2"
                aria-hidden="true"
              >
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M2.036 12.322a1.012 1.012 0 0 1 0-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.963-7.178Z"
                />
                <path
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z"
                />
              </svg>
              Preview
            </Button>
          </Show>

          {/* File unavailable — no seeders online (receiver, idle, no seeders) */}
          <Show when={status() === "idle" && !props.isOwn && seederCount() === 0}>
            <Badge variant="outline" class="text-muted-foreground">
              File unavailable — no seeders online
            </Badge>
          </Show>

          {/* Sender status: seeding vs received */}
          <Show when={status() === "seeding" && props.isOwn}>
            <Show
              when={seederCount() > 1}
              fallback={<Badge variant="outline">Seeding — waiting for download</Badge>}
            >
              <Badge variant="success">Received</Badge>
            </Show>
          </Show>

          <Show when={status() === "seeding" && !props.isOwn}>
            <Badge variant="success">Seeding</Badge>
          </Show>

          {/* Done state: show Save button + badges */}
          <Show when={status() === "done" && !props.isOwn}>
            <Show when={!saved()} fallback={<Badge variant="success">Saved</Badge>}>
              <Badge variant="outline">Previewed</Badge>
              <Button size="sm" variant="outline" onClick={handleSave}>
                <svg
                  class="mr-1 h-4 w-4"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  stroke-width="2"
                  aria-hidden="true"
                >
                  <path
                    stroke-linecap="round"
                    stroke-linejoin="round"
                    d="M3 16.5v2.25A2.25 2.25 0 0 0 5.25 21h13.5A2.25 2.25 0 0 0 21 18.75V16.5M16.5 12 12 16.5m0 0L7.5 12m4.5 4.5V3"
                  />
                </svg>
                Save to device
              </Button>
            </Show>
          </Show>

          <Show when={status() === "cancelled"}>
            <Badge variant="outline">Cancelled</Badge>
            <Button size="sm" variant="ghost" onClick={handlePreview}>
              Retry
            </Button>
          </Show>

          {/* Seeder count badge (not shown for own files in seeding state — handled above) */}
          <Show when={seederCount() > 0 && !(props.isOwn && status() === "seeding")}>
            <Badge variant="outline">
              {seederCount()} {seederCount() === 1 ? "seeder" : "seeders"}
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
          <Button size="sm" variant="ghost" class="mt-1" onClick={handlePreview}>
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

      {/* Video preview (inline player after preview) */}
      <Show when={isVideo() && videoUrl()}>
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

      {/* Text/markdown preview */}
      <Show when={isText() && textContent()}>
        <div class="mt-2 max-h-[400px] overflow-auto rounded-md border border-border bg-secondary p-3">
          <Show
            when={isMarkdown()}
            fallback={
              <pre class="whitespace-pre-wrap break-words font-mono text-xs text-foreground">
                <code>{textContent()}</code>
              </pre>
            }
          >
            <MessageContent content={textContent() ?? ""} />
          </Show>
          <Show when={textTruncated()}>
            <p class="mt-2 text-xs text-muted-foreground">Content truncated</p>
          </Show>
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
