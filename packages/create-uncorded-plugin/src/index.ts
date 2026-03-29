#!/usr/bin/env bun
import { resolve } from "node:path";
import { runPrompts } from "./prompts.js";
import { scaffold } from "./scaffold.js";
import { sideload } from "./sideload.js";

const args = process.argv.slice(2);

const pluginName = args.find((a) => !a.startsWith("-"));
const shouldSideload = args.includes("--sideload");

const answers = await runPrompts(pluginName);
const targetDir = resolve(process.cwd(), answers.name);

scaffold(targetDir, answers);

if (shouldSideload) {
  await sideload(targetDir);
}
