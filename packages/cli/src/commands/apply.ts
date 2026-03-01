import { resolve, join } from "node:path";
import ora from "ora";
import {
  findConfigPaths,
  resolveConfig,
  buildResolvedContext,
  COCKPIT_DIR,
  type AdapterName,
} from "@cockpit-ai/core";
import { getAdapters } from "@cockpit-ai/adapters";
import { SkillRegistry } from "@cockpit-ai/skills";
import { ui } from "../ui/output.js";

// ─── Apply Command ─────────────────────────────────────────────────────────

export interface ApplyOptions {
  adapter?: string;
  clean?: boolean;
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

  // Determine which adapters to target
  const targetAdapterNames: AdapterName[] = options.adapter
    ? [options.adapter as AdapterName]
    : config.adapters;

  const adapters = getAdapters(targetAdapterNames);

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

  const skills = registry.list();

  // ── Build context ────────────────────────────────────────────────────────

  const context = buildResolvedContext(
    config.context.global,
    config.context.project,
    "cockpit"
  );

  // ── Apply to each adapter ────────────────────────────────────────────────

  for (const adapter of adapters) {
    const spinner = ora(`Applying to ${adapter.name}…`).start();

    try {
      if (options.clean) {
        await adapter.clean(cwd);
        spinner.info(`Cleaned ${adapter.name}`);
        continue;
      }

      // Apply context rules
      if (context.global.length > 0 || context.project.length > 0) {
        await adapter.applyContext(cwd, context);
      }

      // Apply each skill
      for (const skill of skills) {
        await adapter.applySkill(cwd, skill);
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
