import { resolve } from "node:path";
import chalk from "chalk";
import {
  findConfigPaths,
  resolveConfig,
} from "@cockpit-ai/core";
import { ui, printKeyValue, printKeyList } from "../ui/output.js";

// ─── Status Command ────────────────────────────────────────────────────────

export async function statusCommand(targetPath?: string): Promise<void> {
  const cwd = resolve(targetPath ?? process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.warn("No Cockpit configuration found.");
    ui.dim(`Searched from: ${cwd}`);
    ui.blank();
    ui.info("Run 'cockpit init' to initialize a workspace.");
    return;
  }

  const config = resolveConfig(paths);

  ui.heading("Cockpit Status");

  // ── Workspace ──────────────────────────────────────────────────────────
  console.log(chalk.bold("  Workspace"));
  printKeyValue("Name", config.name);
  printKeyValue("Default Adapter", config.defaultAdapter);
  printKeyList("Adapters", config.adapters);
  ui.blank();

  // ── Paths ──────────────────────────────────────────────────────────────
  console.log(chalk.bold("  Config Paths"));
  printKeyValue("Profile", config.profilePath);
  printKeyValue("Workspace", config.workspacePath);
  printKeyValue("Project", config.projectPath);
  ui.blank();

  // ── Preferences ────────────────────────────────────────────────────────
  console.log(chalk.bold("  Preferences"));
  printKeyValue("Language", config.preferences.language);
  printKeyValue("Default Model", config.preferences.defaultModel);
  ui.blank();

  // ── Context ────────────────────────────────────────────────────────────
  if (config.context.global.length > 0) {
    console.log(chalk.bold("  Context Rules"));
    for (const rule of config.context.global) {
      console.log(`    ${chalk.dim("•")} ${rule}`);
    }
    ui.blank();
  }

  // ── Skills & Agents ────────────────────────────────────────────────────
  if (config.skills.include.length > 0 || config.agents.include.length > 0) {
    console.log(chalk.bold("  Resources"));
    if (config.skills.include.length > 0) {
      printKeyList("Skill paths", config.skills.include);
    }
    if (config.agents.include.length > 0) {
      printKeyList("Agent paths", config.agents.include);
    }
    ui.blank();
  }
}
