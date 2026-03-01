import { mkdirSync, existsSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { createInterface } from "node:readline";
import { COCKPIT_DIR, CONFIG_FILE } from "@cockpit-ai/core";
import { ui } from "../ui/output.js";

// ─── Prompt Helpers ────────────────────────────────────────────────────────

async function prompt(question: string, defaultValue?: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const display = defaultValue ? `${question} (${defaultValue}): ` : `${question}: `;
  return new Promise((resolve) => {
    rl.question(display, (answer) => {
      rl.close();
      resolve(answer.trim() || defaultValue || "");
    });
  });
}

// ─── Template Generators ───────────────────────────────────────────────────

function workspaceTemplate(name: string): string {
  return `cockpit: "1.0"

workspace:
  name: ${name}
  default_adapter: claude-code

adapters:
  - claude-code

context:
  global:
    - "Follow project coding conventions"
`;
}

function projectTemplate(name: string): string {
  return `cockpit: "1.0"

project:
  name: ${name}

context:
  global: []
`;
}

// ─── Init Command ──────────────────────────────────────────────────────────

export interface InitOptions {
  project?: boolean;
}

export async function initCommand(targetPath: string | undefined, options: InitOptions): Promise<void> {
  const dir = resolve(targetPath ?? process.cwd());
  const cockpitDir = join(dir, COCKPIT_DIR);
  const configPath = join(cockpitDir, CONFIG_FILE);

  if (existsSync(configPath)) {
    ui.warn(`Cockpit config already exists at ${configPath}`);
    ui.info("Use 'cockpit status' to view the current configuration.");
    return;
  }

  const isProject = options.project === true;
  const kind = isProject ? "project" : "workspace";

  ui.heading(`Initializing Cockpit ${kind}`);
  ui.info(`Target directory: ${dir}`);
  ui.blank();

  const defaultName = dir.split("/").at(-1) ?? "my-workspace";
  const name = await prompt(`${kind} name`, defaultName);

  mkdirSync(cockpitDir, { recursive: true });

  const content = isProject ? projectTemplate(name) : workspaceTemplate(name);
  writeFileSync(configPath, content, "utf-8");

  ui.blank();
  ui.success(`Created ${configPath}`);
  ui.blank();
  ui.dim("Next steps:");
  ui.dim(`  cockpit status         — view current environment`);
  ui.dim(`  cockpit skill list     — browse available skills`);
  ui.dim(`  cockpit apply          — apply config to AI tools`);
}
