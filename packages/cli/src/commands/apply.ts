import { resolve, join } from "node:path";
import ora from "ora";
import chalk from "chalk";
import {
  findConfigPaths,
  resolveConfig,
  COCKPIT_DIR,
  type AdapterName,
} from "@cockpit-ai/core";
import { getAdapters } from "@cockpit-ai/adapters";
import { SkillRegistry } from "@cockpit-ai/skills";
import { ContextManager } from "@cockpit-ai/context";
import { getBuiltinSkills, STANDING_INSTRUCTION } from "../builtins/index.js";
import { ui } from "../ui/output.js";

// ─── Apply Command ─────────────────────────────────────────────────────────

export interface ApplyOptions {
  adapter?: string;
  clean?: boolean;
  dryRun?: boolean;
}

export async function applyCommand(options: ApplyOptions): Promise<void> {
  const cwd = resolve(process.cwd());
  const paths = findConfigPaths(cwd);

  if (!paths.workspacePath && !paths.projectPath) {
    // process.exit 대신 throw → watch 등 호출자에서 catch 가능
    throw new Error("No Cockpit configuration found. Run 'cockpit init' to initialize a workspace.");
  }

  const config = resolveConfig(paths);

  // verbose: 설정 파일 경로 출력
  ui.verbose(`profile:   ${paths.profilePath ?? "(none)"}`);
  ui.verbose(`workspace: ${paths.workspacePath ?? "(none)"}`);
  ui.verbose(`project:   ${paths.projectPath ?? "(none)"}`);

  // Determine which adapters to target
  const targetAdapterNames: AdapterName[] = options.adapter
    ? [options.adapter as AdapterName]
    : config.adapters;

  const adapters = getAdapters(targetAdapterNames);

  ui.verbose(`adapters: ${targetAdapterNames.join(", ")} (resolved: ${adapters.map((a) => a.name).join(", ")})`);

  if (adapters.length === 0) {
    ui.warn("No supported adapters found.");
    ui.dim(`Requested: ${targetAdapterNames.join(", ")}`);
    return;
  }

  ui.heading("Cockpit Apply");
  ui.info(`Workspace: ${config.name}`);
  ui.blank();

  // ── Load skills ──────────────────────────────────────────────────────────

  const skillDirs = config.skills.include.map((p) => {
    // Resolve relative paths against workspace root
    if (p.startsWith(".")) {
      const root = paths.workspacePath
        ? resolve(join(paths.workspacePath, "..", ".."))
        : cwd;
      return resolve(join(root, p));
    }
    return resolve(p);
  });

  // Also load from the default .cockpit/skills/ dir in workspace and project
  const workspaceRoot = paths.workspacePath ? resolve(join(paths.workspacePath, "..", "..")) : null;
  const projectRoot = paths.projectPath ? resolve(join(paths.projectPath, "..", "..")) : null;

  const defaultDirs = [
    workspaceRoot ? join(workspaceRoot, COCKPIT_DIR, "skills") : null,
    projectRoot ? join(projectRoot, COCKPIT_DIR, "skills") : null,
  ].filter(Boolean) as string[];

  const allSkillDirs = [...new Set([...defaultDirs, ...skillDirs])];

  const registry = new SkillRegistry();
  const loadErrors = registry.loadFromDirs(allSkillDirs);

  for (const { file, error } of loadErrors) {
    ui.warn(`Skipped skill ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const skills = [...registry.list(), ...getBuiltinSkills()];

  // ── Build context (inline rules + external .md files + standing instruction)

  const contextManager = new ContextManager(cwd);
  const baseContext = contextManager.getResolved();
  const context = {
    ...baseContext,
    global: [
      ...baseContext.global,
      { content: STANDING_INSTRUCTION, scope: "global" as const, source: "cockpit-builtin" },
    ],
  };

  // 어댑터 파일(CLAUDE.md, .claude/skills/)을 쓸 대상 디렉토리 결정
  // projectRoot가 있으면 프로젝트 루트, 없으면 워크스페이스 루트 사용
  const applyTarget = projectRoot ?? workspaceRoot ?? cwd;

  // ── Dry-run 미리보기 ─────────────────────────────────────────────────────

  if (options.dryRun) {
    ui.info("Dry run — no files will be written.");
    ui.blank();
    for (const adapter of adapters) {
      console.log(`  ${chalk.cyan(adapter.name)}`);
      if (options.clean) {
        console.log(`    ${chalk.dim("action:")} clean (remove cockpit-managed files)`);
      } else {
        const ruleCount = context.global.length + context.project.length;
        const skillCount = skills.length;
        if (ruleCount > 0) console.log(`    ${chalk.dim("context:")} ${ruleCount} rules`);
        if (skillCount > 0) console.log(`    ${chalk.dim("skills:")}  ${skillCount}`);
        console.log(`    ${chalk.dim("target:")}  ${applyTarget}`);
      }
    }
    ui.blank();
    return;
  }

  // ── Apply to each adapter ────────────────────────────────────────────────

  for (const adapter of adapters) {
    const spinner = ora(`Applying to ${adapter.name}…`).start();

    try {
      if (options.clean) {
        await adapter.clean(applyTarget);
        spinner.info(`Cleaned ${adapter.name}`);
        continue;
      }

      // Apply context rules
      if (context.global.length > 0 || context.project.length > 0) {
        await adapter.applyContext(applyTarget, context);
      }

      // Apply each skill
      for (const skill of skills) {
        await adapter.applySkill(applyTarget, skill);
      }

      const parts: string[] = [];
      if (context.global.length + context.project.length > 0) {
        parts.push(`${context.global.length + context.project.length} context rules`);
      }
      if (skills.length > 0) {
        parts.push(`${skills.length} skill${skills.length === 1 ? "" : "s"}`);
      }

      spinner.succeed(
        `${adapter.name}: ${parts.length > 0 ? parts.join(", ") : "nothing to apply"}`
      );
    } catch (err) {
      spinner.fail(`${adapter.name}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  ui.blank();
}
