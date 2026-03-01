import {
  WorktreeManager,
  registerWorktree,
  unregisterWorktree,
  assignAgent,
  readWorktreeState,
  getWorktreeState,
} from "@cockpit-ai/worktree";
import { ui } from "../ui/output.js";
import chalk from "chalk";
import { resolve } from "node:path";
import { existsSync } from "node:fs";

// ─── worktree create ────────────────────────────────────────────────────────

export async function worktreeCreateCommand(
  branch: string,
  options: { repo?: string; path?: string }
): Promise<void> {
  const repoPath = resolve(options.repo ?? process.cwd());
  const manager = new WorktreeManager(repoPath);

  try {
    const info = manager.create({
      branch,
      path: options.path ? resolve(options.path) : undefined,
    });
    registerWorktree(info.path, info.branch);
    ui.success(`Created worktree for branch ${chalk.cyan(info.branch)}`);
    ui.info(`Path: ${info.path}`);
  } catch (err) {
    ui.error(`Failed to create worktree: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ─── worktree list ──────────────────────────────────────────────────────────

export async function worktreeListCommand(): Promise<void> {
  const repoPath = resolve(process.cwd());
  const manager = new WorktreeManager(repoPath);

  let gitWorktrees: ReturnType<WorktreeManager["list"]> = [];
  try {
    gitWorktrees = manager.list();
  } catch (err) {
    ui.warn(`Could not list git worktrees: ${err instanceof Error ? err.message : String(err)}`);
  }

  const state = readWorktreeState();

  if (gitWorktrees.length === 0 && Object.keys(state.worktrees).length === 0) {
    ui.info("No worktrees found.");
    return;
  }

  ui.heading("Worktrees");

  // Build a combined set of paths to display
  const allPaths = new Set<string>([
    ...gitWorktrees.map((wt) => wt.path),
    ...Object.keys(state.worktrees),
  ]);

  // Print table header
  console.log(
    `  ${chalk.bold("Path".padEnd(40))} ${chalk.bold("Branch".padEnd(25))} ${chalk.bold("Agent")}`
  );
  console.log(`  ${chalk.dim("─".repeat(80))}`);

  for (const path of allPaths) {
    const gitEntry = gitWorktrees.find((wt) => wt.path === path);
    const stateEntry = state.worktrees[path];
    const branch = gitEntry?.branch ?? stateEntry?.branch ?? chalk.dim("(unknown)");
    const agent = stateEntry?.assignedAgent ?? chalk.dim("(none)");
    const mainTag = gitEntry?.isMain ? chalk.dim(" [main]") : "";

    const truncatedPath = path.length > 39 ? "..." + path.slice(path.length - 36) : path;
    console.log(
      `  ${chalk.cyan(truncatedPath.padEnd(40))} ${chalk.white(branch.padEnd(25))}${mainTag} ${chalk.yellow(agent)}`
    );
  }

  ui.blank();
}

// ─── worktree status ────────────────────────────────────────────────────────

export async function worktreeStatusCommand(): Promise<void> {
  const state = readWorktreeState();
  const entries = Object.values(state.worktrees);

  if (entries.length === 0) {
    ui.info("No tracked worktrees in Cockpit state.");
    ui.dim("Use 'cockpit worktree create <branch>' to create one.");
    return;
  }

  ui.heading(`Worktree Status (${entries.length})`);

  for (const entry of entries) {
    const exists = existsSync(entry.path);
    const statusMark = exists ? chalk.green("active") : chalk.red("missing");
    console.log(`  ${chalk.cyan(entry.branch)} ${chalk.dim("—")} ${statusMark}`);
    console.log(`    ${chalk.dim("Path:")}       ${entry.path}`);
    console.log(`    ${chalk.dim("Agent:")}      ${entry.assignedAgent ?? chalk.dim("(none)")}`);
    console.log(`    ${chalk.dim("Created:")}    ${entry.createdAt}`);
    ui.blank();
  }
}

// ─── worktree assign ────────────────────────────────────────────────────────

export async function worktreeAssignCommand(
  worktreePath: string,
  agentName: string
): Promise<void> {
  const resolvedPath = resolve(worktreePath);

  const existing = getWorktreeState(resolvedPath);
  if (!existing) {
    ui.error(`Worktree not found in state: ${resolvedPath}`);
    ui.dim("Use 'cockpit worktree list' to see tracked worktrees.");
    process.exit(1);
  }

  try {
    assignAgent(resolvedPath, agentName);
    ui.success(
      `Assigned agent ${chalk.yellow(agentName)} to worktree ${chalk.cyan(existing.branch)}`
    );
  } catch (err) {
    ui.error(`Failed to assign agent: ${err instanceof Error ? err.message : String(err)}`);
    process.exit(1);
  }
}

// ─── worktree clean ─────────────────────────────────────────────────────────

export async function worktreeCleanCommand(): Promise<void> {
  const repoPath = resolve(process.cwd());
  const manager = new WorktreeManager(repoPath);

  // Prune stale git worktree refs
  try {
    manager.prune();
    ui.info("Pruned stale git worktree references.");
  } catch (err) {
    ui.warn(
      `git worktree prune failed: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  // Remove entries from state where path no longer exists
  const state = readWorktreeState();
  const staleEntries = Object.values(state.worktrees).filter(
    (entry) => !existsSync(entry.path)
  );

  if (staleEntries.length === 0) {
    ui.info("No stale worktree entries to clean.");
    return;
  }

  for (const entry of staleEntries) {
    unregisterWorktree(entry.path);
    ui.success(`Removed stale entry: ${chalk.cyan(entry.branch)} (${entry.path})`);
  }

  ui.blank();
  ui.dim(`Cleaned ${staleEntries.length} stale entry${staleEntries.length === 1 ? "" : "ies"}.`);
}
