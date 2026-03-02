import { Command } from "commander";
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { version } = require("../package.json") as { version: string };
import { initCommand } from "./commands/init.js";
import { projectInitCommand, projectListCommand, projectRemoveCommand } from "./commands/project.js";
import { setupCommand } from "./commands/setup.js";
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
  agentLogsCommand,
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
  contextRemoveCommand,
  contextGenerateCommand,
  contextAnalyzeCommand,
  contextLintCommand,
  contextStatsCommand,
} from "./commands/context.js";

const program = new Command();

program
  .name("cockpit")
  .description("AI-first Development Environment Orchestrator")
  .version(version)
  .option("--verbose", "Show detailed debug information (config paths, adapter detection, etc.)")
  .hook("preAction", (thisCommand) => {
    if (thisCommand.opts()["verbose"]) {
      process.env["COCKPIT_VERBOSE"] = "1";
    }
  });

// ─── setup ─────────────────────────────────────────────────────────────────

program
  .command("setup")
  .description("One-touch setup: init + detect tech stack + apply to AI tools")
  .option("--adapter <name>", "Apply only to a specific adapter")
  .option("--dry-run", "Preview without writing any files")
  .action(async (opts) => {
    try {
      await setupCommand({
        adapter: opts.adapter as string | undefined,
        dryRun: opts.dryRun as boolean | undefined,
      });
    } catch (err) {
      console.error("Error:", err instanceof Error ? err.message : err);
      process.exit(1);
    }
  });

// ─── init ──────────────────────────────────────────────────────────────────

program
  .command("init [path]")
  .description("Initialize a Cockpit workspace")
  .action(async (path: string | undefined) => {
    try {
      await initCommand(path, {});
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
  .option("--dry-run", "Preview changes without writing any files")
  .action(async (opts) => {
    try {
      await applyCommand({
        adapter: opts.adapter as string | undefined,
        clean: opts.clean as boolean | undefined,
        dryRun: opts.dryRun as boolean | undefined,
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

// ─── project ───────────────────────────────────────────────────────────────

const projectCmd = program
  .command("project")
  .description("Manage projects within a workspace");

projectCmd
  .command("init <name>")
  .description("Register a project in this workspace")
  .action(async (name: string) => {
    try { await projectInitCommand(name); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

projectCmd
  .command("list")
  .description("List all configured projects")
  .action(async () => {
    try { await projectListCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

projectCmd
  .command("remove <name>")
  .description("Remove a project from this workspace")
  .action(async (name: string) => {
    try { await projectRemoveCommand(name); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
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
  .command("spawn <name> <task>")
  .description("Spawn an agent to execute a task")
  .option("--model <model>", "Override model for this run")
  .option("--max-turns <n>", "Maximum conversation turns", parseInt)
  .option("--worktree", "Create a worktree for this agent run")
  .option("--cleanup", "Delete worktree after agent completes")
  .option("--dry-run", "Preview spawn config without starting the process")
  .action(async (name: string, task: string, opts) => {
    try {
      await agentSpawnCommand(name, task, {
        model: opts.model as string | undefined,
        maxTurns: opts.maxTurns as number | undefined,
        worktree: opts.worktree as boolean | undefined,
        cleanup: opts.cleanup as boolean | undefined,
        dryRun: opts.dryRun as boolean | undefined,
      });
    }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

agentCmd
  .command("stop <runId>")
  .description("Stop a running agent by runId")
  .action(async (runId: string) => {
    try { await agentStopCommand(runId); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

agentCmd
  .command("status")
  .description("Show agent status dashboard")
  .action(async () => {
    try { await agentStatusCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

agentCmd
  .command("logs <runId>")
  .description("Show logs for a specific agent run")
  .action(async (runId: string) => {
    try { await agentLogsCommand(runId); }
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
  .command("remove <rule>")
  .description("Remove a context rule by exact content match")
  .action(async (rule: string) => {
    try { await contextRemoveCommand(rule); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

contextCmd
  .command("generate")
  .description("Generate adapter context files (CLAUDE.md etc.)")
  .action(async () => {
    try { await contextGenerateCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

contextCmd
  .command("analyze")
  .description("Analyze project tech stack and suggest context rules")
  .option("--apply", "Automatically add suggested rules to config")
  .action(async (opts) => {
    try { await contextAnalyzeCommand({ apply: opts.apply as boolean | undefined }); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

contextCmd
  .command("lint")
  .description("Check for stale or conflicting context rules")
  .action(async () => {
    try { await contextLintCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

contextCmd
  .command("stats")
  .description("Show token cost breakdown per context rule")
  .action(async () => {
    try { await contextStatsCommand(); }
    catch (err) { console.error("Error:", err instanceof Error ? err.message : err); process.exit(1); }
  });

program.parse(process.argv);
