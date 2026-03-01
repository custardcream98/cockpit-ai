import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { applyCommand } from "./commands/apply.js";

const program = new Command();

program
  .name("cockpit")
  .description("AI-first Development Environment Orchestrator")
  .version("0.0.1");

// ─── init ──────────────────────────────────────────────────────────────────

const initCmd = program
  .command("init [path]")
  .description("Initialize a Cockpit workspace or project")
  .option("--project", "Initialize as a project config (instead of workspace)")
  .action(async (path: string | undefined, opts) => {
    try {
      await initCommand(path, { project: opts.project as boolean | undefined });
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ─── status ────────────────────────────────────────────────────────────────

program
  .command("status [path]")
  .description("Show current Cockpit environment status")
  .action(async (path: string | undefined) => {
    try {
      await statusCommand(path);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ─── apply ─────────────────────────────────────────────────────────────────

program
  .command("apply")
  .description("Apply Cockpit config to AI tools in the current project")
  .option("--adapter <name>", "Apply only to a specific adapter")
  .action(async (opts) => {
    try {
      await applyCommand({ adapter: opts.adapter as string | undefined });
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse(process.argv);
