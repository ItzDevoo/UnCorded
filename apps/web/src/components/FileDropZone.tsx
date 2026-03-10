import { createSignal, Show, type JSX } from "solid-js";
import type { AnyChannelId } from "@uncorded/protocol";
import { MAX_FILE_SIZE_BYTES } from "@uncorded/shared";

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

const FileDropZone = (props: {
  channelId: AnyChannelId;
  children: JSX.Element;
  onFileSelect: (file: File) => void;
}) => {
  const [dragging, setDragging] = createSignal(false);
  const [errorMessage, setErrorMessage] = createSignal<string | null>(null);
  let dragCounter = 0;

  function handleDragEnter(e: DragEvent) {
    e.preventDefault();
    dragCounter++;
    if (dragCounter === 1) setDragging(true);
  }

  function handleDragLeave(e: DragEvent) {
    e.preventDefault();
    dragCounter--;
    if (dragCounter === 0) setDragging(false);
  }

  function handleDrop(e: DragEvent) {
    e.preventDefault();
    dragCounter = 0;
    setDragging(false);

    const file = e.dataTransfer?.files[0];
    if (!file) return;

    const maxMb = MAX_FILE_SIZE_BYTES / (1024 * 1024);
    if (file.size > MAX_FILE_SIZE_BYTES) {
      setErrorMessage(`File exceeds ${maxMb} MB limit`);
      if (import.meta.env.DEV)
        console.warn(`[FileDropZone] File too large: ${file.size} bytes (max ${maxMb} MB)`);
      return;
    }

    setErrorMessage(null);
    props.onFileSelect(file);
  }

  return (
    <div
      data-slot="file-drop-zone"
      class="relative flex h-full flex-col"
      onDragEnter={handleDragEnter}
      onDragLeave={handleDragLeave}
      onDragOver={handleDragOver}
      onDrop={handleDrop}
    >
      {props.children}
      {dragging() && (
        <div class="absolute inset-0 z-10 flex items-center justify-center rounded-lg border-2 border-dashed border-primary bg-primary/10">
          <p class="text-lg font-semibold text-primary">Drop file to share</p>
        </div>
      )}
      <Show when={errorMessage()}>
        <div class="px-3 py-1.5 text-xs text-destructive">{errorMessage()}</div>
      </Show>
    </div>
  );
};

export default FileDropZone;
