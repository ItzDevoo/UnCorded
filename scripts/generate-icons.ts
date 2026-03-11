import sharp from "sharp";
import { join } from "path";

const publicDir = join(import.meta.dir, "..", "apps", "web", "public");
const source = join(publicDir, "icon-1024.png");

const bg = { r: 0, g: 0, b: 0, alpha: 0 };

const sizes = [
  { name: "favicon-16x16.png", size: 16 },
  { name: "favicon-32x32.png", size: 32 },
  { name: "apple-touch-icon.png", size: 180 },
  { name: "icon-192.png", size: 192 },
  { name: "icon-512.png", size: 512 },
] as const;

await Promise.all(
  sizes.map(async ({ name, size }) => {
    await sharp(source)
      .resize(size, size, { fit: "contain", background: bg })
      .png()
      .toFile(join(publicDir, name));
    console.log(`Generated ${name} (${size}x${size})`);
  }),
);

// favicon.ico — just a 32x32 PNG named .ico (browsers handle it fine)
await sharp(source)
  .resize(32, 32, { fit: "contain", background: bg })
  .png()
  .toFile(join(publicDir, "favicon.ico"));
console.log("Generated favicon.ico (32x32 PNG)");

console.log("Done!");
