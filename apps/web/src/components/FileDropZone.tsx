import { createSignal, type JSX } from "solid-js";
import type { ChannelId } from "@uncorded/protocol";

const MAX_FILE_SIZE = 100 * 1024 * 1024; // 100 MB

function handleDragOver(e: DragEvent) {
  e.preventDefault();
}

const FileDropZone = (props: {
  channelId: ChannelId;
  children: JSX.Element;
  onFileSelect: (file: File) => void;
}) => {
  const [dragging, setDragging] = createSignal(false);
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

    if (file.size > MAX_FILE_SIZE) {
      console.warn("[FileDropZone] File too large:", file.size, "bytes (max 100 MB)");
      return;
    }

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
    </div>
  );
};

export default FileDropZone;
export { MAX_FILE_SIZE };
