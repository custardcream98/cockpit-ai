import { existsSync, mkdirSync, writeFileSync, cpSync, rmSync } from "node:fs";
import { join, resolve, basename, extname } from "node:path";
import { findConfigPaths, COCKPIT_DIR } from "@cockpit/core";
import { SkillRegistry, loadSkillsFromDir, defaultSkillTemplate } from "@cockpit/skills";
import { ui } from "../ui/output.js";
import chalk from "chalk";

const SKILLS_SUBDIR = "skills";

// ─── Helpers ───────────────────────────────────────────────────────────────

function getSkillsDir(cockpitRoot: string): string {
  return join(cockpitRoot, COCKPIT_DIR, SKILLS_SUBDIR);
}

function findCockpitRoot(cwd: string): string | null {
  const paths = findConfigPaths(cwd);
  if (paths.projectPath) return resolve(join(paths.projectPath, "..", ".."));
  if (paths.workspacePath) return resolve(join(paths.workspacePath, "..", ".."));
  return null;
}

function collectAllSkillDirs(cwd: string): string[] {
  const paths = findConfigPaths(cwd);
  const dirs: string[] = [];

  if (paths.workspacePath) {
    dirs.push(getSkillsDir(resolve(join(paths.workspacePath, "..", ".."))));
  }
  if (paths.projectPath) {
    dirs.push(getSkillsDir(resolve(join(paths.projectPath, "..", ".."))));
  }

  return dirs;
}

// ─── skill list ────────────────────────────────────────────────────────────

export async function skillListCommand(): Promise<void> {
  const cwd = process.cwd();
  const skillDirs = collectAllSkillDirs(cwd);

  if (skillDirs.length === 0) {
    ui.warn("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    return;
  }

  const registry = new SkillRegistry();
  const errors = registry.loadFromDirs(skillDirs);

  for (const { file, error } of errors) {
    ui.warn(`Skipped ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const skills = registry.list();

  if (skills.length === 0) {
    ui.info("No skills found.");
    ui.dim("Use 'cockpit skill create <name>' to scaffold a new skill.");
    return;
  }

  ui.heading(`Skills (${skills.length})`);
  for (const skill of skills) {
    const triggers = skill.trigger.length > 0 ? chalk.dim(` [${skill.trigger.join(", ")}]`) : "";
    console.log(`  ${chalk.cyan(skill.name)}@${chalk.dim(skill.version)}${triggers}`);
    if (skill.description) {
      console.log(`    ${chalk.dim(skill.description)}`);
    }
  }
  ui.blank();
}

// ─── skill create ──────────────────────────────────────────────────────────

export async function skillCreateCommand(name: string): Promise<void> {
  const cwd = process.cwd();
  const cockpitRoot = findCockpitRoot(cwd);

  if (!cockpitRoot) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const skillsDir = getSkillsDir(cockpitRoot);
  mkdirSync(skillsDir, { recursive: true });

  const fileName = `${name}.yaml`;
  const filePath = join(skillsDir, fileName);

  if (existsSync(filePath)) {
    ui.warn(`Skill '${name}' already exists at ${filePath}`);
    return;
  }

  const content = defaultSkillTemplate(name);
  writeFileSync(filePath, content, "utf-8");

  ui.success(`Created skill: ${filePath}`);
  ui.dim(`Edit the file, then run 'cockpit apply' to apply it to your AI tools.`);
}

// ─── skill add ─────────────────────────────────────────────────────────────

export async function skillAddCommand(source: string): Promise<void> {
  const cwd = process.cwd();
  const cockpitRoot = findCockpitRoot(cwd);

  if (!cockpitRoot) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const sourcePath = resolve(source);
  if (!existsSync(sourcePath)) {
    ui.error(`File not found: ${sourcePath}`);
    process.exit(1);
  }

  const ext = extname(sourcePath);
  if (ext !== ".yaml" && ext !== ".yml") {
    ui.error("Only .yaml or .yml skill files are supported.");
    process.exit(1);
  }

  const skillsDir = getSkillsDir(cockpitRoot);
  mkdirSync(skillsDir, { recursive: true });

  const destPath = join(skillsDir, basename(sourcePath));
  cpSync(sourcePath, destPath);

  ui.success(`Added skill from ${sourcePath}`);
  ui.dim(`Run 'cockpit skill list' to see all skills.`);
}

// ─── skill remove ──────────────────────────────────────────────────────────

export async function skillRemoveCommand(name: string): Promise<void> {
  const cwd = process.cwd();
  const cockpitRoot = findCockpitRoot(cwd);

  if (!cockpitRoot) {
    ui.error("No Cockpit configuration found.");
    process.exit(1);
  }

  const skillsDir = getSkillsDir(cockpitRoot);

  const candidates = [`${name}.yaml`, `${name}.yml`];
  let removed = false;

  for (const fileName of candidates) {
    const filePath = join(skillsDir, fileName);
    if (existsSync(filePath)) {
      rmSync(filePath);
      ui.success(`Removed skill '${name}'`);
      removed = true;
      break;
    }
  }

  if (!removed) {
    ui.error(`Skill '${name}' not found in ${skillsDir}`);
    process.exit(1);
  }
}
