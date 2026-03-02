import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import {
  ContextManager,
  contextSummary,
  buildClaudeMdSection,
  analyzeProject,
  generateRules,
  checkStaleness,
  computeTokenStats,
} from "@cockpit-ai/context";
import {
  findConfigPaths,
  resolveConfig,
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

// ─── context remove ────────────────────────────────────────────────────────

export async function contextRemoveCommand(rule: string): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const manager = new ContextManager(cwd);
  const removed = manager.removeRule(rule);

  if (!removed) {
    ui.warn(`Rule not found: "${rule}"`);
    ui.dim("Use 'cockpit context show' to list all current rules.");
    process.exit(1);
  }

  ui.success("Rule removed");
  ui.dim(`  Rule: ${rule}`);
  ui.blank();
  ui.info("Run 'cockpit context generate' to apply the changes.");
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

  // ContextManager.getResolved()를 사용하여 .cockpit/context/*.md 파일 규칙도 포함
  const manager = new ContextManager(cwd);
  const context = manager.getResolved();

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

// ─── context analyze ────────────────────────────────────────────────────────

export async function contextAnalyzeCommand(options: { apply?: boolean }): Promise<void> {
  const cwd = resolve(process.cwd());

  ui.heading("Context Analyze");
  ui.blank();

  const analysis = analyzeProject(cwd);

  // 분석 결과 표시
  console.log(chalk.bold("Tech Stack"));
  console.log(`  ${chalk.cyan("language:")}  ${analysis.language}`);
  if (analysis.frameworks.length > 0) {
    console.log(`  ${chalk.cyan("frameworks:")} ${analysis.frameworks.join(", ")}`);
  }
  if (analysis.buildTools.length > 0) {
    console.log(`  ${chalk.cyan("build:")}     ${analysis.buildTools.join(", ")}`);
  }
  if (analysis.testRunners.length > 0) {
    console.log(`  ${chalk.cyan("testing:")}   ${analysis.testRunners.join(", ")}`);
  }
  if (analysis.linters.length > 0) {
    console.log(`  ${chalk.cyan("linters:")}   ${analysis.linters.join(", ")}`);
  }
  console.log(`  ${chalk.cyan("pkg-manager:")} ${analysis.packageManager}`);
  if (analysis.strictMode !== undefined) {
    console.log(`  ${chalk.cyan("ts-strict:")} ${analysis.strictMode}`);
  }
  ui.blank();

  // 추천 룰 생성
  const suggestions = generateRules(analysis);

  if (suggestions.length === 0) {
    ui.info("No rule suggestions for the detected tech stack.");
    return;
  }

  console.log(chalk.bold(`Suggested Rules (${suggestions.length})`));
  for (const s of suggestions) {
    const scopeLabel = chalk.dim(`[${s.scope}]`);
    console.log(`  ${chalk.white("+")} ${s.content} ${scopeLabel}`);
    console.log(`    ${chalk.dim(s.reason)}`);
  }
  ui.blank();

  if (options.apply) {
    const paths = findConfigPaths(cwd);
    if (!paths.workspacePath && !paths.projectPath) {
      ui.error("No Cockpit configuration found. Run 'cockpit init' first.");
      process.exit(1);
    }

    const manager = new ContextManager(cwd);
    let added = 0;

    // 기존 룰과 중복 제거
    const existing = manager.getResolved();
    const existingContents = new Set([
      ...existing.global.map((r) => r.content),
      ...existing.project.map((r) => r.content),
    ]);

    for (const s of suggestions) {
      if (!existingContents.has(s.content)) {
        manager.addRule(s.content, s.scope);
        added++;
      }
    }

    if (added > 0) {
      ui.success(`Added ${added} rule${added === 1 ? "" : "s"} to config.`);
      ui.info("Run 'cockpit context generate' to apply the changes.");
    } else {
      ui.info("All suggested rules already exist. Nothing added.");
    }
  } else {
    ui.dim("Run with --apply to add these rules to your config.");
  }
}

// ─── context lint ───────────────────────────────────────────────────────────

export async function contextLintCommand(): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  ui.heading("Context Lint");
  ui.blank();

  const manager = new ContextManager(cwd);
  const context = manager.getResolved();
  const allRules = [...context.global, ...context.project];

  if (allRules.length === 0) {
    ui.info("No rules to lint.");
    return;
  }

  const warnings = checkStaleness(allRules, cwd);

  if (warnings.length === 0) {
    ui.success(`No issues found in ${allRules.length} rule${allRules.length === 1 ? "" : "s"}.`);
    return;
  }

  for (const w of warnings) {
    const typeLabel = w.type === "conflict" ? chalk.yellow("conflict") : chalk.red("stale");
    console.log(`  ${chalk.dim("!")} ${typeLabel} — ${w.message}`);
    console.log(`    ${chalk.dim("rule:")} ${w.rule.content.slice(0, 80)}${w.rule.content.length > 80 ? "…" : ""}`);
    if (w.rule.source) {
      console.log(`    ${chalk.dim("source:")} ${w.rule.source}`);
    }
    ui.blank();
  }

  ui.warn(`Found ${warnings.length} issue${warnings.length === 1 ? "" : "s"}.`);
}

// ─── context stats ──────────────────────────────────────────────────────────

export async function contextStatsCommand(): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const manager = new ContextManager(cwd);
  const context = manager.getResolved();
  const allRules = [...context.global, ...context.project];

  if (allRules.length === 0) {
    ui.info("No rules to compute stats for.");
    return;
  }

  const stats = computeTokenStats(allRules);

  ui.heading("Context Stats");
  ui.blank();

  console.log(chalk.bold("Summary"));
  console.log(`  ${chalk.cyan("total rules:")}  ${allRules.length}`);
  console.log(`  ${chalk.cyan("total tokens:")} ~${stats.totalTokens}`);
  console.log(`  ${chalk.cyan("global:")}       ~${stats.globalTokens} tokens`);
  console.log(`  ${chalk.cyan("project:")}      ~${stats.projectTokens} tokens`);
  ui.blank();

  console.log(chalk.bold("Per Rule"));
  const sorted = [...stats.rules].sort((a, b) => b.tokens - a.tokens);
  for (const s of sorted) {
    const bar = "█".repeat(Math.min(Math.ceil((s.percentage ?? 0) / 5), 20));
    const preview = s.rule.content.slice(0, 50) + (s.rule.content.length > 50 ? "…" : "");
    const scopeLabel = chalk.dim(`[${s.rule.scope}]`);
    console.log(
      `  ${chalk.cyan(`~${s.tokens}`.padStart(5))} ${chalk.dim(bar.padEnd(20))} ${scopeLabel} ${preview}`,
    );
  }
  ui.blank();
}
