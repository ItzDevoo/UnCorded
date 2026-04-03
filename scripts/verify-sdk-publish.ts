#!/usr/bin/env bun
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";

const ROOT = resolve(import.meta.dirname, "..");
const PACKAGES = [
  "packages/shared",
  "packages/protocol",
  "packages/plugin-server",
  "packages/plugin-client",
  "packages/mock-bridge",
  "packages/create-uncorded-plugin",
];
const CLI_PACKAGES = ["packages/mock-bridge", "packages/create-uncorded-plugin"];

let failures = 0;

function check(label: string, ok: boolean): void {
  if (ok) {
    console.log(`  ✓ ${label}`);
  } else {
    console.log(`  ✗ ${label}`);
    failures++;
  }
}

console.log("\n=== SDK v0.1.0 Publish Verification ===\n");

// 1. Check dist entrypoints exist
console.log("1. Entrypoints");
for (const pkg of PACKAGES) {
  const dir = resolve(ROOT, pkg);
  check(`${pkg}/dist/index.js`, existsSync(resolve(dir, "dist/index.js")));
  check(`${pkg}/dist/index.d.ts`, existsSync(resolve(dir, "dist/index.d.ts")));
}

// 2. Check shebangs on CLI tools
console.log("\n2. CLI Shebangs");
for (const pkg of CLI_PACKAGES) {
  const file = resolve(ROOT, pkg, "dist/index.js");
  if (existsSync(file)) {
    const first = readFileSync(file, "utf8").split("\n")[0];
    check(`${pkg} shebang`, first === "#!/usr/bin/env bun");
  } else {
    check(`${pkg} shebang (file missing)`, false);
  }
}

// 3. Check package.json exports match disk
console.log("\n3. Export Paths");
for (const pkg of PACKAGES) {
  const dir = resolve(ROOT, pkg);
  const json = JSON.parse(readFileSync(resolve(dir, "package.json"), "utf8"));
  const main = json.main;
  const types = json.types;
  if (main) check(`${pkg} main → ${main}`, existsSync(resolve(dir, main)));
  if (types) check(`${pkg} types → ${types}`, existsSync(resolve(dir, types)));
}

// 4. Check versions
console.log("\n4. Versions");
for (const pkg of PACKAGES) {
  const json = JSON.parse(readFileSync(resolve(ROOT, pkg, "package.json"), "utf8"));
  check(`${pkg} version = 0.1.0`, json.version === "0.1.0");
  check(`${pkg} not private`, json.private !== true);
}

// 5. Check READMEs exist
console.log("\n5. READMEs");
for (const pkg of PACKAGES) {
  check(`${pkg}/README.md`, existsSync(resolve(ROOT, pkg, "README.md")));
}

// 6. Summary
console.log(`\n=== ${failures === 0 ? "ALL CHECKS PASSED" : `${failures} FAILURE(S)`} ===\n`);
process.exit(failures === 0 ? 0 : 1);
