import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { ContextManager, contextSummary, buildClaudeMdSection } from "@cockpit-ai/context";
import {
  findConfigPaths,
  resolveConfig,
  buildResolvedContext,
} from "@cockpit-ai/core";
import { ui } from "../ui/output.js";
import chalk from "chalk";

// ─── Constants ─────────────────────────────────────────────────────────────

const COCKPIT_MARKER = "<!-- cockpit:managed -->";
const CLAUDE_MD = "CLAUDE.md";

// ─── context show ──────────────────────────────────────────────────────────

export async function contextShowCommand(): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const config = resolveConfig(paths);
  const manager = new ContextManager(cwd);
  const context = manager.getResolved();

  ui.heading("Context");
  ui.blank();

  // Show config sources
  console.log(chalk.bold("Config Sources"));
  if (config.profilePath) {
    console.log(`  ${chalk.cyan("profile".padEnd(12))} ${chalk.dim(config.profilePath)}`);
  }
  if (config.workspacePath) {
    console.log(`  ${chalk.cyan("workspace".padEnd(12))} ${chalk.dim(config.workspacePath)}`);
  }
  if (config.projectPath) {
    console.log(`  ${chalk.cyan("project".padEnd(12))} ${chalk.dim(config.projectPath)}`);
  }
  ui.blank();

  // Show global rules
  console.log(chalk.bold("Global Rules"));
  if (context.global.length === 0) {
    console.log(`  ${chalk.dim("(none)")}`);
  } else {
    for (const rule of context.global) {
      const source = rule.source ? chalk.dim(` [${rule.source}]`) : "";
      console.log(`  ${chalk.white("-")} ${rule.content}${source}`);
    }
  }
  ui.blank();

  // Show project rules
  console.log(chalk.bold("Project Rules"));
  if (context.project.length === 0) {
    console.log(`  ${chalk.dim("(none)")}`);
  } else {
    for (const rule of context.project) {
      const source = rule.source ? chalk.dim(` [${rule.source}]`) : "";
      console.log(`  ${chalk.white("-")} ${rule.content}${source}`);
    }
  }
  ui.blank();

  // Show summary
  const summary = contextSummary(context);
  console.log(chalk.bold("Summary"));
  console.log(`  ${chalk.cyan("total".padEnd(12))} ${summary.totalRules}`);
  console.log(`  ${chalk.cyan("global".padEnd(12))} ${summary.globalCount}`);
  console.log(`  ${chalk.cyan("project".padEnd(12))} ${summary.projectCount}`);
  ui.blank();
}

// ─── context add ───────────────────────────────────────────────────────────

export async function contextAddCommand(
  rule: string,
  options: { scope?: string; project?: boolean }
): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  // Determine scope
  const scope: "global" | "project" =
    options.project || options.scope === "project" ? "project" : "global";

  const manager = new ContextManager(cwd);

  try {
    manager.addRule(rule, scope);
  } catch (err) {
    ui.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }

  // Determine which file was written
  const targetPath = paths.projectPath ?? paths.workspacePath;

  ui.success(`Added ${scope} rule`);
  ui.dim(`  Rule:  ${rule}`);
  ui.dim(`  Scope: ${scope}`);
  ui.dim(`  File:  ${targetPath}`);
  ui.blank();
  ui.info("Run 'cockpit context generate' to apply the context to your AI tools.");
}

// ─── context generate ──────────────────────────────────────────────────────

export async function contextGenerateCommand(): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const config = resolveConfig(paths);
  const context = buildResolvedContext(
    config.context.global,
    config.context.project,
    "cockpit"
  );

  const claudeMdPath = join(cwd, CLAUDE_MD);
  const claudeSection = buildClaudeMdSection(context);

  // Read existing CLAUDE.md if it exists, preserving hand-written content
  const existing = existsSync(claudeMdPath)
    ? readFileSync(claudeMdPath, "utf-8")
    : null;

  let finalContent: string;

  if (!existing) {
    finalContent = claudeSection;
  } else {
    // Strip existing cockpit-managed section and append fresh one
    const markerIndex = existing.indexOf(COCKPIT_MARKER);
    const base =
      markerIndex >= 0
        ? existing.slice(0, markerIndex).trimEnd()
        : existing.trimEnd();

    finalContent = base ? `${base}\n\n${claudeSection}` : claudeSection;
  }

  writeFileSync(claudeMdPath, finalContent, "utf-8");

  ui.heading("Context Generate");
  ui.blank();

  const totalRules = context.global.length + context.project.length;

  if (totalRules === 0) {
    ui.warn("No context rules defined. Wrote empty cockpit section.");
  } else {
    ui.success(`Wrote ${totalRules} context rule${totalRules === 1 ? "" : "s"} to ${CLAUDE_MD}`);
    ui.dim(`  Global:  ${context.global.length}`);
    ui.dim(`  Project: ${context.project.length}`);
  }

  ui.dim(`  Path: ${claudeMdPath}`);
  ui.blank();
}
