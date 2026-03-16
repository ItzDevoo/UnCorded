/**
 * Simplified perceptual hash for images (scaffold).
 * Real PDQ implementation or Thorn API integration comes later.
 * The important thing is the hook point and the flow.
 */
export async function computePdqHash(file: File): Promise<string | null> {
  if (!file.type.startsWith("image/")) {
    return null;
  }

  const bitmap = await createImageBitmap(file);
  const canvas = new OffscreenCanvas(32, 32);
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;

  ctx.drawImage(bitmap, 0, 0, 32, 32);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, 32, 32);
  const pixels = imageData.data;

  // Convert to grayscale values
  const grayscale = new Float64Array(32 * 32);
  let sum = 0;
  for (let i = 0; i < 32 * 32; i++) {
    const offset = i * 4;
    // biome-ignore lint: non-null assertion for known-length pixel array
    const gray =
      pixels[offset]! * 0.299 + pixels[offset + 1]! * 0.587 + pixels[offset + 2]! * 0.114;
    grayscale[i] = gray;
    sum += gray;
  }

  // Compute average
  const avg = sum / (32 * 32);

  // Generate hash: each bit is 1 if pixel > average, 0 otherwise
  // 32*32 = 1024 bits = 256 hex chars, but we want 64 chars = 256 bits
  // Use every 4th pixel to get 256 bits
  const bytes = new Uint8Array(32);
  for (let i = 0; i < 256; i++) {
    const pixelIdx = i * 4; // sample every 4th pixel
    if (pixelIdx < grayscale.length && (grayscale[pixelIdx] ?? 0) > avg) {
      const byteIdx = Math.floor(i / 8);
      const bitIdx = 7 - (i % 8);
      // biome-ignore lint: non-null assertion for known index
      bytes[byteIdx] = bytes[byteIdx]! | (1 << bitIdx);
    }
  }

  // Convert to hex string (64 chars)
  let hex = "";
  for (const byte of bytes) {
    hex += byte.toString(16).padStart(2, "0");
  }

  return hex;
}
