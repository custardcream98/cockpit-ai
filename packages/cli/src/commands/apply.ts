import { resolve } from "node:path";
import { findConfigPaths, resolveConfig } from "@cockpit/core";
import { ui } from "../ui/output.js";

// ─── Apply Command ─────────────────────────────────────────────────────────

export interface ApplyOptions {
  adapter?: string;
}

export async function applyCommand(options: ApplyOptions): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const config = resolveConfig(paths);

  const targetAdapters = options.adapter
    ? [options.adapter]
    : config.adapters;

  ui.heading("Cockpit Apply");
  ui.info(`Workspace: ${config.name}`);
  ui.info(`Adapters: ${targetAdapters.join(", ")}`);
  ui.blank();

  // Phase 2 will implement actual adapter logic
  ui.warn("Adapter integration not yet implemented (Phase 2).");
  ui.dim("This command will apply skills, context, and agents to each configured AI tool.");
  ui.blank();
  ui.dim("Planned adapters:");
  for (const adapter of targetAdapters) {
    ui.dim(`  • ${adapter}`);
  }
}
