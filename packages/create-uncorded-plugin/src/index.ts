#!/usr/bin/env bun
import { basename, relative, resolve } from "node:path";
import { runPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { sideload } from "./sideload.js";

const VALID_NAME = /^[a-zA-Z0-9_-]+$/;

const args = process.argv.slice(2);

const pluginName = args.find((a) => !a.startsWith("-"));
const shouldSideload = args.includes("--sideload");

const answers = await runPrompts(pluginName);

// Validate plugin name
const safeName = basename(answers.name);
if (!safeName || !VALID_NAME.test(safeName)) {
  console.error(`Invalid plugin name: "${answers.name}". Use alphanumeric characters, hyphens, or underscores only.`);
  process.exit(1);
}

const targetDir = resolve(process.cwd(), safeName);

// Ensure targetDir is inside cwd (prevent path traversal)
const rel = relative(process.cwd(), targetDir);
if (rel.startsWith("..") || resolve(targetDir) !== targetDir) {
  console.error(`Invalid target directory: "${targetDir}" is outside the current working directory.`);
  process.exit(1);
}

// Use the sanitized name
answers.name = safeName;

scaffold(targetDir, answers);

if (shouldSideload) {
  try {
    await sideload(targetDir);
  } catch (err) {
    console.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}
