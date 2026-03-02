import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findWorkspaceRoot,
  findConfigPaths,
  getCockpitConfigPath,
  getProjectConfigPath,
  COCKPIT_DIR,
  CONFIG_FILE,
  PROJECTS_DIR,
} from "../config/finder.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-finder-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function createWorkspaceConfig(dir: string, content = "cockpit: '1.0'\nworkspace:\n  name: test\n"): string {
  const cockpitDir = join(dir, COCKPIT_DIR);
  mkdirSync(cockpitDir, { recursive: true });
  writeFileSync(join(cockpitDir, CONFIG_FILE), content, "utf-8");
  return dir;
}

function createProjectConfig(workspaceRoot: string, projectName: string): string {
  const projectsDir = join(workspaceRoot, COCKPIT_DIR, PROJECTS_DIR);
  mkdirSync(projectsDir, { recursive: true });
  const configPath = getProjectConfigPath(workspaceRoot, projectName);
  writeFileSync(configPath, `cockpit: '1.0'\nproject:\n  name: ${projectName}\n`, "utf-8");
  return configPath;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("findWorkspaceRoot", () => {
  it("finds .cockpit/config.yaml in the current directory", () => {
    createWorkspaceConfig(tmpDir);
    const result = findWorkspaceRoot(tmpDir);
    expect(result).toBe(tmpDir);
  });

  it("finds .cockpit/config.yaml in a parent directory", () => {
    createWorkspaceConfig(tmpDir);
    const nested = join(tmpDir, "sub", "deep");
    mkdirSync(nested, { recursive: true });

    const result = findWorkspaceRoot(nested);
    expect(result).toBe(tmpDir);
  });

  it("returns null when no .cockpit/config.yaml exists", () => {
    const result = findWorkspaceRoot(tmpDir);
    expect(result).toBeNull();
  });

  it("stops at the closest ancestor with .cockpit/", () => {
    createWorkspaceConfig(tmpDir);
    const child = join(tmpDir, "child");
    createWorkspaceConfig(child);
    const nested = join(child, "deep");
    mkdirSync(nested, { recursive: true });

    // Should find child's .cockpit, not tmpDir's
    const result = findWorkspaceRoot(nested);
    expect(result).toBe(child);
  });
});

describe("findConfigPaths", () => {
  it("returns null workspace and project when no configs exist", () => {
    const result = findConfigPaths(tmpDir);
    expect(result.workspacePath).toBeNull();
    expect(result.projectPath).toBeNull();
    expect(result.workspaceRoot).toBeNull();
    expect(result.projectName).toBeNull();
  });

  it("finds workspace config", () => {
    createWorkspaceConfig(tmpDir);
    const result = findConfigPaths(tmpDir);
    expect(result.workspacePath).toBe(join(tmpDir, COCKPIT_DIR, CONFIG_FILE));
    expect(result.workspaceRoot).toBe(tmpDir);
  });

  it("cwd가 workspace root이면 projectPath/projectName은 null", () => {
    createWorkspaceConfig(tmpDir);
    const result = findConfigPaths(tmpDir);
    expect(result.workspacePath).not.toBeNull();
    expect(result.projectPath).toBeNull();
    expect(result.projectName).toBeNull();
  });

  it("workspace root 하위 cwd에서 project config를 .cockpit/projects/<name>.yaml에서 찾음", () => {
    createWorkspaceConfig(tmpDir);
    createProjectConfig(tmpDir, "project-a");

    // cwd = workspace root / project-a
    const projectDir = join(tmpDir, "project-a");
    mkdirSync(projectDir, { recursive: true });

    const result = findConfigPaths(projectDir);
    expect(result.workspacePath).toBe(join(tmpDir, COCKPIT_DIR, CONFIG_FILE));
    expect(result.workspaceRoot).toBe(tmpDir);
    expect(result.projectPath).toBe(getProjectConfigPath(tmpDir, "project-a"));
    expect(result.projectName).toBe("project-a");
  });

  it("project yaml이 없으면 하위 cwd여도 projectPath는 null", () => {
    createWorkspaceConfig(tmpDir);
    const projectDir = join(tmpDir, "no-config-project");
    mkdirSync(projectDir, { recursive: true });

    const result = findConfigPaths(projectDir);
    expect(result.workspacePath).not.toBeNull();
    expect(result.projectPath).toBeNull();
    expect(result.projectName).toBeNull();
  });

  it("하위 디렉토리 깊이와 무관하게 첫 번째 세그먼트로 project 식별", () => {
    createWorkspaceConfig(tmpDir);
    createProjectConfig(tmpDir, "project-a");

    const deepDir = join(tmpDir, "project-a", "src", "lib");
    mkdirSync(deepDir, { recursive: true });

    const result = findConfigPaths(deepDir);
    expect(result.projectName).toBe("project-a");
    expect(result.projectPath).toBe(getProjectConfigPath(tmpDir, "project-a"));
  });
});

describe("getCockpitConfigPath", () => {
  it("returns expected path", () => {
    const result = getCockpitConfigPath("/some/dir");
    expect(result).toBe("/some/dir/.cockpit/config.yaml");
  });
});

describe("getProjectConfigPath", () => {
  it("returns expected path", () => {
    const result = getProjectConfigPath("/dev", "abc-juice");
    expect(result).toBe("/dev/.cockpit/projects/abc-juice.yaml");
  });
});
