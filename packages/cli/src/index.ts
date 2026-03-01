import { Command } from "commander";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
import { initCommand } from "./commands/init.js";
import { statusCommand } from "./commands/status.js";
import { applyCommand } from "./commands/apply.js";
import { watchCommand } from "./commands/watch.js";
import {
  skillListCommand,
  skillCreateCommand,
  skillAddCommand,
  skillRemoveCommand,
} from "./commands/skill.js";
import {
  profileShowCommand,
  profileCreateCommand,
  profileSyncPushCommand,
  profileSyncPullCommand,
  profileExportCommand,
  profileImportCommand,
} from "./commands/profile.js";
import {
  agentListCommand,
  agentSpawnCommand,
  agentStopCommand,
  agentStatusCommand,
} from "./commands/agent.js";
import {
  worktreeCreateCommand,
  worktreeListCommand,
  worktreeStatusCommand,
  worktreeAssignCommand,
  worktreeCleanCommand,
} from "./commands/worktree.js";
import {
  contextShowCommand,
  contextAddCommand,
  contextGenerateCommand,
} from "./commands/context.js";

const program = new Command();

program
  .name("cockpit")
  .description("AI-first Development Environment Orchestrator")
  .version(version);

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

// ─── watch ─────────────────────────────────────────────────────────────────

program
  .command("watch")
  .description("Watch .cockpit/ for changes and auto-apply")
  .action(async () => {
    try {
      await watchCommand();
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
    try { await skillListCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

skillCmd
  .command("create <name>")
  .description("Scaffold a new skill from template")
  .action(async (name: string) => {
    try { await skillCreateCommand(name); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

skillCmd
  .command("add <path>")
  .description("Add a skill from a local file")
  .action(async (path: string) => {
    try { await skillAddCommand(path); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

skillCmd
  .command("remove <name>")
  .description("Remove a skill")
  .action(async (name: string) => {
    try { await skillRemoveCommand(name); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

// ─── profile ───────────────────────────────────────────────────────────────

const profileCmd = program
  .command("profile")
  .description("Manage your personal Cockpit profile");

profileCmd
  .command("show")
  .description("Display current profile info")
  .action(async () => {
    try { await profileShowCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

profileCmd
  .command("create")
  .description("Create a new profile interactively")
  .action(async () => {
    try { await profileCreateCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

const syncCmd = profileCmd
  .command("sync")
  .description("Sync profile with remote git repository");

syncCmd
  .command("push")
  .description("Push profile to remote")
  .action(async () => {
    try { await profileSyncPushCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

syncCmd
  .command("pull")
  .description("Pull profile from remote")
  .action(async () => {
    try { await profileSyncPullCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

profileCmd
  .command("export [file]")
  .description("Export profile to a single YAML file")
  .action(async (file: string | undefined) => {
    try { await profileExportCommand(file); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

profileCmd
  .command("import <file>")
  .description("Import profile from a YAML export file")
  .action(async (file: string) => {
    try { await profileImportCommand(file); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

// ─── agent ─────────────────────────────────────────────────────────────────

const agentCmd = program
  .command("agent")
  .description("Manage Cockpit agents");

agentCmd
  .command("list")
  .description("List available agents")
  .action(async () => {
    try { await agentListCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

agentCmd
  .command("spawn <name>")
  .description("Spawn an agent")
  .action(async (name: string) => {
    try { await agentSpawnCommand(name); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

agentCmd
  .command("stop <name>")
  .description("Stop a running agent")
  .action(async (name: string) => {
    try { await agentStopCommand(name); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

agentCmd
  .command("status")
  .description("Show agent status dashboard")
  .action(async () => {
    try { await agentStatusCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

// ─── worktree ──────────────────────────────────────────────────────────────

const worktreeCmd = program
  .command("worktree")
  .description("Manage git worktrees");

worktreeCmd
  .command("create <branch>")
  .description("Create a new worktree")
  .option("--repo <path>", "Path to git repo (default: cwd)")
  .option("--path <path>", "Where to create the worktree")
  .action(async (branch: string, opts) => {
    try { await worktreeCreateCommand(branch, { repo: opts.repo as string | undefined, path: opts.path as string | undefined }); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

worktreeCmd
  .command("list")
  .description("List all worktrees")
  .action(async () => {
    try { await worktreeListCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

worktreeCmd
  .command("status")
  .description("Show worktree status dashboard")
  .action(async () => {
    try { await worktreeStatusCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

worktreeCmd
  .command("assign <worktree> <agent>")
  .description("Assign an agent to a worktree")
  .action(async (wt: string, agent: string) => {
    try { await worktreeAssignCommand(wt, agent); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

worktreeCmd
  .command("clean")
  .description("Clean up stale worktrees")
  .action(async () => {
    try { await worktreeCleanCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

// ─── context ───────────────────────────────────────────────────────────────

const contextCmd = program
  .command("context")
  .description("Manage context rules");

contextCmd
  .command("show")
  .description("Show current merged context")
  .action(async () => {
    try { await contextShowCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

contextCmd
  .command("add <rule>")
  .description("Add a context rule")
  .option("--project", "Add as a project-scoped rule (default: global)")
  .option("--scope <scope>", "Rule scope: global or project")
  .action(async (rule: string, opts) => {
    try {
      await contextAddCommand(rule, {
        scope: opts.scope as string | undefined,
        project: opts.project as boolean | undefined,
      });
    }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

contextCmd
  .command("generate")
  .description("Generate adapter context files (CLAUDE.md etc.)")
  .action(async () => {
    try { await contextGenerateCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

program.parse(process.argv);
