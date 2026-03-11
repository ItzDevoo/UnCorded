// Module augmentation for WebTorrent 2.x async file methods.
// @types/webtorrent@0.110.x is stale and only declares the old callback API
// (getBlob, getBuffer, getBlobURL). WebTorrent 2.x replaced those with:
//   file.blob()        → Promise<Blob>
//   file.arrayBuffer() → Promise<ArrayBuffer>
//   file.stream()      → ReadableStream

// This import makes the file a module so `declare module` augments rather than replaces.
import "webtorrent";

declare module "webtorrent" {
  interface TorrentFile {
    blob(): Promise<Blob>;
    arrayBuffer(): Promise<ArrayBuffer>;
    stream(): ReadableStream;
  }
}
