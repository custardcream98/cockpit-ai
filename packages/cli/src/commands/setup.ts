import { resolve } from "node:path";
import ora from "ora";
import chalk from "chalk";
import { findConfigPaths } from "@cockpit-ai/core";
import { analyzeProject, generateRules, ContextManager } from "@cockpit-ai/context";
import { ui } from "../ui/output.js";
import { initCommand } from "./init.js";
import { applyCommand } from "./apply.js";

// ─── Setup Command ───────────────────────────────────────────────────────────

export interface SetupOptions {
  adapter?: string;
  dryRun?: boolean;
}

/**
 * 원터치 Cockpit 세팅:
 * 1. init (config 없을 때)
 * 2. context analyze --apply (기술 스택 감지 + 규칙 자동 추가)
 * 3. apply (AI 도구에 적용)
 */
export async function setupCommand(options: SetupOptions = {}): Promise<void> {
  const cwd = resolve(process.cwd());

  ui.heading("Cockpit Setup");
  ui.blank();
  console.log(`  ${chalk.dim("This will:")} init → analyze → apply in one step`);
  ui.blank();

  // ── Step 1: Init ────────────────────────────────────────────────────────

  const paths = findConfigPaths(cwd);
  const alreadyInited = !!(paths.workspacePath || paths.projectPath);

  if (!alreadyInited) {
    const spinner = ora("Initializing workspace config...").start();
    try {
      // 비대화형 init: 기본값으로 워크스페이스 설정 생성
      await initCommand(cwd, { nonInteractive: true });
      spinner.succeed("Workspace config created");
    } catch (err) {
      spinner.fail(`Init failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  } else {
    console.log(`  ${chalk.dim("✓")} Config already exists — skipping init`);
  }

  // ── Step 2: Analyze tech stack + add rules ───────────────────────────────

  const spinner2 = ora("Analyzing tech stack...").start();
  let addedCount = 0;
  let detectedStack = "";

  try {
    const analysis = analyzeProject(cwd);
    const suggestions = generateRules(analysis);

    const manager = new ContextManager(cwd);
    const existing = manager.getResolved();
    const existingContents = new Set([
      ...existing.global.map((r) => r.content),
      ...existing.project.map((r) => r.content),
    ]);

    for (const s of suggestions) {
      if (!existingContents.has(s.content)) {
        if (!options.dryRun) {
          manager.addRule(s.content, s.scope);
        }
        addedCount++;
      }
    }

    const stackParts = [
      analysis.language,
      ...analysis.frameworks,
      ...analysis.testRunners.slice(0, 2),
      ...analysis.buildTools.slice(0, 2),
    ].filter(Boolean);
    detectedStack = stackParts.join(", ");

    const ruleMsg =
      addedCount > 0
        ? ` — ${addedCount} rule${addedCount === 1 ? "" : "s"} ${options.dryRun ? "would be added (dry-run)" : "added"}`
        : " — no new rules";
    spinner2.succeed(`Tech stack analyzed${ruleMsg}`);
    if (detectedStack) {
      console.log(`  ${chalk.dim("Detected:")} ${detectedStack}`);
    }
  } catch (err) {
    spinner2.warn(
      `Context analysis skipped: ${err instanceof Error ? err.message : String(err)}`,
    );
  }

  // ── Step 3: Apply ────────────────────────────────────────────────────────

  if (options.dryRun) {
    console.log(`  ${chalk.dim("(dry-run: apply skipped)")}`);
  } else {
    try {
      await applyCommand({ adapter: options.adapter });
    } catch (err) {
      ui.error(`Apply failed: ${err instanceof Error ? err.message : String(err)}`);
      throw err;
    }
  }

  // ── Summary ─────────────────────────────────────────────────────────────

  ui.blank();
  ui.success("Cockpit setup complete!");
  ui.blank();
  console.log(chalk.bold("Next steps:"));
  console.log(`  ${chalk.cyan("cockpit context show")}      — review your context rules`);
  console.log(`  ${chalk.cyan("cockpit context analyze")}   — fine-tune rule suggestions`);
  console.log(`  ${chalk.cyan("cockpit watch")}             — auto-apply on config changes`);
  console.log(`  ${chalk.cyan("cockpit agent list")}        — browse available agents`);
  ui.blank();
}
