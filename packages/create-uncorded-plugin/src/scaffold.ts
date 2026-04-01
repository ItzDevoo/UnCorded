import { existsSync, mkdirSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import type { PluginAnswers } from "./prompts.js";

const TEMPLATES_DIR = resolve(import.meta.dirname, "../templates");

function readTemplate(name: string): string {
  return readFileSync(join(TEMPLATES_DIR, name), "utf-8");
}

function replaceVars(template: string, vars: Record<string, string>): string {
  let result = template;
  for (const [key, value] of Object.entries(vars)) {
    result = result.replaceAll(`{{${key}}}`, value);
  }
  return result;
}

export function scaffold(targetDir: string, answers: PluginAnswers): void {
  // Preflight: abort if target directory already exists and is non-empty
  if (existsSync(targetDir)) {
    const entries = readdirSync(targetDir);
    if (entries.length > 0) {
      throw new Error(
        `Directory "${targetDir}" already exists and is not empty. Remove it or choose a different name.`,
      );
    }
  }

  mkdirSync(targetDir, { recursive: true });
  mkdirSync(join(targetDir, "src"), { recursive: true });

  const vars: Record<string, string> = {
    name: answers.name,
    description: answers.description,
    author: answers.author,
    scope: answers.scope,
    port: String(answers.port),
    permissions: JSON.stringify(answers.permissions),
    uiType: answers.uiType === "none" ? "" : `"type": "${answers.uiType}"`,
  };

  // uncorded-plugin.json (manifest)
  const manifest = {
    id: answers.name,
    name: answers.name,
    version: "0.1.0",
    description: answers.description,
    author: answers.author,
    scope: answers.scope,
    permissions: answers.permissions,
    runtime: {
      image: `${answers.name}:latest`,
      port: answers.port,
      healthCheck: "/health",
    },
    ...(answers.uiType !== "none" ? { ui: { type: answers.uiType } } : {}),
  };
  writeFileSync(join(targetDir, "uncorded-plugin.json"), JSON.stringify(manifest, null, 2) + "\n");

  // package.json
  const pkgJson = readTemplate("package.json.tmpl");
  writeFileSync(join(targetDir, "package.json"), replaceVars(pkgJson, vars));

  // tsconfig.json
  const tsconfig = readTemplate("tsconfig.json.tmpl");
  writeFileSync(join(targetDir, "tsconfig.json"), tsconfig);

  // Dockerfile
  const isBundled = answers.pluginType === "bundled";
  const dockerfileTemplate = isBundled ? "bundled/Dockerfile.tmpl" : "Dockerfile.tmpl";
  const dockerfile = readTemplate(dockerfileTemplate);
  writeFileSync(join(targetDir, "Dockerfile"), replaceVars(dockerfile, vars));

  // src/server.ts
  const serverTemplate = isBundled ? "bundled/server.ts.tmpl" : "server.ts.tmpl";
  if (isBundled && answers.internalPort !== undefined) {
    vars.internalPort = String(answers.internalPort);
  }
  const serverTs = readTemplate(serverTemplate);
  writeFileSync(join(targetDir, "src/server.ts"), replaceVars(serverTs, vars));

  // src/index.html (if UI)
  if (answers.uiType !== "none") {
    const indexHtml = readTemplate("index.html.tmpl");
    writeFileSync(join(targetDir, "src/index.html"), replaceVars(indexHtml, vars));
  }

  // .gitignore
  const gitignore = readTemplate("gitignore.tmpl");
  writeFileSync(join(targetDir, ".gitignore"), gitignore);

  console.log(`\nPlugin scaffolded at ${targetDir}/`);
  console.log(`\nNext steps:`);
  console.log(`  cd ${answers.name}`);
  console.log(`  bun install`);
  console.log(`  bun run dev`);
}
