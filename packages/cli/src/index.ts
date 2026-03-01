import { Command } from "commander";
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { applyCommand } from "./commands/apply.js";
import {
  skillListCommand,
  skillCreateCommand,
  skillAddCommand,
  skillRemoveCommand,
} from "./commands/skill.js";

const program = new Command();

program
  .name("cockpit")
  .description("AI-first Development Environment Orchestrator")
  .version("0.0.1");

// ─── init ──────────────────────────────────────────────────────────────────

program
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
  .option("--clean", "Remove cockpit-managed files instead of applying")
  .action(async (opts) => {
    try {
      await applyCommand({
        adapter: opts.adapter as string | undefined,
        clean: opts.clean as boolean | undefined,
      });
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ─── skill ─────────────────────────────────────────────────────────────────

const skillCmd = program
  .command("skill")
  .description("Manage Cockpit skills");

skillCmd
  .command("list")
  .description("List all available skills")
  .action(async () => {
    try {
      await skillListCommand();
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

skillCmd
  .command("create <name>")
  .description("Scaffold a new skill from template")
  .action(async (name: string) => {
    try {
      await skillCreateCommand(name);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

skillCmd
  .command("add <path>")
  .description("Add a skill from a local file")
  .action(async (path: string) => {
    try {
      await skillAddCommand(path);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

skillCmd
  .command("remove <name>")
  .description("Remove a skill")
  .action(async (name: string) => {
    try {
      await skillRemoveCommand(name);
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

program.parse(process.argv);
