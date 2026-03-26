import { resolve } from "node:path";
import { defineConfig } from "vite";
import solid from "vite-plugin-solid";
import tailwindcss from "@tailwindcss/vite";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig({
  plugins: [
    solid(),
    tailwindcss(),
    nodePolyfills({
      include: ["buffer", "events", "stream", "process", "util", "path", "crypto", "fs", "os"],
    }),
  ],
  resolve: {
    alias: {
      // bittorrent-dht is Node-only (UDP sockets). WebTorrent disables DHT in
      // browsers via { dht: false }, but torrent-discovery still imports it at
      // the module level. Stub it out so Vite can bundle without errors.
      "bittorrent-dht": resolve(__dirname, "src/stubs/bittorrent-dht.ts"),
    },
  },
  server: {
    port: 5173,
  },
});
