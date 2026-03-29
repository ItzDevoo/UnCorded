#!/usr/bin/env bun
import { createMockBridge } from "./server.js";

const args = process.argv.slice(2);
let port = 7070;

for (let i = 0; i < args.length; i++) {
  if (args[i] === "--port" && args[i + 1]) {
    port = Number(args[i + 1]);
    i++;
  }
}

const app = createMockBridge();
app.listen(port);

console.log(`[mock-bridge] UnCorded mock bridge running on http://localhost:${port}`);
console.log(`[mock-bridge] Use UNCORDED_BRIDGE_URL=http://localhost:${port}`);
console.log(`[mock-bridge] Use any value for UNCORDED_BRIDGE_TOKEN`);

export { createMockBridge };
