import { mkdirSync, existsSync, writeFileSync, readdirSync, unlinkSync } from "node:fs";
import { join, resolve, basename } from "node:path";
import {
  findWorkspaceRoot,
  getProjectConfigPath,
  COCKPIT_DIR,
  PROJECTS_DIR,
} from "@cockpit-ai/core";
import { ui } from "../ui/output.js";

// ─── Project Template ──────────────────────────────────────────────────────

function projectTemplate(name: string): string {
  return `cockpit: "1.0"

project:
  name: ${name}

context:
  global: []
`;
}

// ─── Project Init ──────────────────────────────────────────────────────────

export async function projectInitCommand(name: string): Promise<void> {
  const cwd = resolve(process.cwd());
  const workspaceRoot = findWorkspaceRoot(cwd);

  if (!workspaceRoot) {
    throw new Error("No workspace found. Run 'cockpit init' first.");
  }

  const projectDir = join(workspaceRoot, name);
  if (!existsSync(projectDir)) {
    ui.warn(`Directory '${name}' not found in workspace root — creating config anyway.`);
  }

  const configPath = getProjectConfigPath(workspaceRoot, name);
  const projectsDir = join(workspaceRoot, COCKPIT_DIR, PROJECTS_DIR);
  mkdirSync(projectsDir, { recursive: true });

  if (existsSync(configPath)) {
    ui.warn(`Project '${name}' is already configured.`);
    ui.dim(`  ${configPath}`);
    return;
  }

  writeFileSync(configPath, projectTemplate(name), "utf-8");

  ui.success(`Project '${name}' initialized`);
  ui.blank();
  ui.dim(`Config: ${configPath}`);
  ui.dim(`Context: ${join(workspaceRoot, COCKPIT_DIR, PROJECTS_DIR, name, "context/")}`);
  ui.blank();
  ui.dim("Next steps:");
  ui.dim(`  cd ${name} && cockpit apply  — apply config to ${name}/`);
  ui.dim(`  cockpit context add <rule> --project  — add a project-scoped rule`);
}

// ─── Project List ──────────────────────────────────────────────────────────

export async function projectListCommand(): Promise<void> {
  const cwd = resolve(process.cwd());
  const workspaceRoot = findWorkspaceRoot(cwd);

  if (!workspaceRoot) {
    throw new Error("No workspace found. Run 'cockpit init' first.");
  }

  const projectsDir = join(workspaceRoot, COCKPIT_DIR, PROJECTS_DIR);

  if (!existsSync(projectsDir)) {
    ui.info("No projects configured yet.");
    ui.dim("  cockpit project init <name>  — add a project");
    return;
  }

  const files = readdirSync(projectsDir).filter(
    (f) => f.endsWith(".yaml") || f.endsWith(".yml")
  );

  if (files.length === 0) {
    ui.info("No projects configured yet.");
    ui.dim("  cockpit project init <name>  — add a project");
    return;
  }

  ui.heading("Projects");
  ui.blank();
  for (const file of files) {
    const name = basename(file, ".yaml").replace(/\.yml$/, "");
    const projectDir = join(workspaceRoot, name);
    const exists = existsSync(projectDir);
    console.log(`  ${name}${exists ? "" : "  (directory not found)"}`);
  }
  ui.blank();
}

// ─── Project Remove ────────────────────────────────────────────────────────

export async function projectRemoveCommand(name: string): Promise<void> {
  const cwd = resolve(process.cwd());
  const workspaceRoot = findWorkspaceRoot(cwd);

  if (!workspaceRoot) {
    throw new Error("No workspace found. Run 'cockpit init' first.");
  }

  const configPath = getProjectConfigPath(workspaceRoot, name);

  if (!existsSync(configPath)) {
    ui.warn(`Project '${name}' is not configured.`);
    return;
  }

  unlinkSync(configPath);
  ui.success(`Removed project '${name}'`);
  ui.dim(`  Deleted: ${configPath}`);
  ui.dim(`  Note: project context files in .cockpit/projects/${name}/ are preserved.`);
}
