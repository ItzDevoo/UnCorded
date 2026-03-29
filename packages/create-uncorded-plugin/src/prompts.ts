import * as readline from "node:readline";

const KNOWN_PERMISSIONS = [
  "server.read",
  "members.read",
  "channels.read",
  "messages.read",
  "messages.send",
  "users.read",
  "presence.read",
  "notifications.send",
  "config.read",
  "storage.read",
  "storage.write",
] as const;

export interface PluginAnswers {
  name: string;
  description: string;
  author: string;
  scope: "server" | "personal" | "both";
  permissions: string[];
  port: number;
  uiType: "panel" | "page" | "both" | "none";
}

function ask(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, resolve);
  });
}

function askChoice(rl: readline.Interface, question: string, options: string[]): Promise<string> {
  const optionsStr = options.map((o, i) => `  ${i + 1}) ${o}`).join("\n");
  return new Promise((resolve) => {
    const prompt = (): void => {
      rl.question(`${question}\n${optionsStr}\n> `, (answer) => {
        const idx = Number(answer) - 1;
        if (idx >= 0 && idx < options.length) {
          resolve(options[idx]!);
        } else if (options.includes(answer)) {
          resolve(answer);
        } else {
          console.log("Invalid choice, try again.");
          prompt();
        }
      });
    };
    prompt();
  });
}

function askMultiChoice(rl: readline.Interface, question: string, options: string[]): Promise<string[]> {
  const optionsStr = options.map((o, i) => `  ${i + 1}) ${o}`).join("\n");
  return new Promise((resolve) => {
    const prompt = (): void => {
      rl.question(
        `${question} (comma-separated numbers, or "all")\n${optionsStr}\n> `,
        (answer) => {
          if (answer.trim().toLowerCase() === "all") {
            resolve([...options]);
            return;
          }
          const indices = answer.split(",").map((s) => Number(s.trim()) - 1);
          const selected = indices
            .filter((i) => i >= 0 && i < options.length)
            .map((i) => options[i]!);
          if (selected.length > 0) {
            resolve(selected);
          } else {
            console.log("No valid permissions selected, try again.");
            prompt();
          }
        },
      );
    };
    prompt();
  });
}

function askPort(rl: readline.Interface): Promise<number> {
  return new Promise((resolve) => {
    const prompt = (): void => {
      rl.question("Container port (default 3000): ", (answer) => {
        const trimmed = answer.trim();
        if (trimmed === "") {
          resolve(3000);
          return;
        }
        const parsed = parseInt(trimmed, 10);
        if (Number.isInteger(parsed) && parsed >= 1 && parsed <= 65535) {
          resolve(parsed);
        } else {
          console.log("Invalid port. Enter a number between 1 and 65535.");
          prompt();
        }
      });
    };
    prompt();
  });
}

export async function runPrompts(defaultName?: string): Promise<PluginAnswers> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  try {
    const name = defaultName ?? (await ask(rl, "Plugin name: "));
    const description = await ask(rl, "Description: ");
    const author = await ask(rl, "Author: ");
    const scope = (await askChoice(rl, "Scope:", ["server", "personal", "both"])) as PluginAnswers["scope"];
    const permissions = await askMultiChoice(rl, "Permissions:", [...KNOWN_PERMISSIONS]);
    const port = await askPort(rl);
    const uiType = (await askChoice(rl, "UI type:", ["panel", "page", "both", "none"])) as PluginAnswers["uiType"];

    return { name, description, author, scope, permissions, port, uiType };
  } finally {
    rl.close();
  }
}
