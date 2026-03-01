import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  findWorkspaceRoot,
  findProjectRoot,
  findConfigPaths,
  getCockpitConfigPath,
  COCKPIT_DIR,
  CONFIG_FILE,
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

function createCockpitConfig(dir: string, content = "cockpit: '1.0'\nworkspace:\n  name: test\n"): string {
  const cockpitDir = join(dir, COCKPIT_DIR);
  mkdirSync(cockpitDir, { recursive: true });
  const configPath = join(cockpitDir, CONFIG_FILE);
  writeFileSync(configPath, content, "utf-8");
  return dir;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("findWorkspaceRoot", () => {
  it("finds .cockpit/config.yaml in the current directory", () => {
    createCockpitConfig(tmpDir);
    const result = findWorkspaceRoot(tmpDir);
    expect(result).toBe(tmpDir);
  });

  it("finds .cockpit/config.yaml in a parent directory", () => {
    createCockpitConfig(tmpDir);
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
    createCockpitConfig(tmpDir);
    const child = join(tmpDir, "child");
    createCockpitConfig(child);
    const nested = join(child, "deep");
    mkdirSync(nested, { recursive: true });

    // Should find child's .cockpit, not tmpDir's
    const result = findWorkspaceRoot(nested);
    expect(result).toBe(child);
  });
});

describe("findProjectRoot", () => {
  it("returns current directory if .cockpit/config.yaml exists there", () => {
    createCockpitConfig(tmpDir);
    expect(findProjectRoot(tmpDir)).toBe(tmpDir);
  });

  it("returns null if no .cockpit/ in current directory", () => {
    const sub = join(tmpDir, "project");
    mkdirSync(sub, { recursive: true });
    // .cockpit only in tmpDir, not in sub
    createCockpitConfig(tmpDir);
    expect(findProjectRoot(sub)).toBeNull();
  });
});

describe("findConfigPaths", () => {
  it("returns all nulls when no configs exist", () => {
    const result = findConfigPaths(tmpDir);
    expect(result.profilePath).toBeNull();
    expect(result.workspacePath).toBeNull();
    expect(result.projectPath).toBeNull();
  });

  it("finds workspace config", () => {
    createCockpitConfig(tmpDir);
    const result = findConfigPaths(tmpDir);
    expect(result.workspacePath).toBe(join(tmpDir, COCKPIT_DIR, CONFIG_FILE));
  });

  it("workspace and project are the same path when cwd is workspace root", () => {
    createCockpitConfig(tmpDir);
    const result = findConfigPaths(tmpDir);
    // cwd IS workspace root → project path should be null (same as workspace)
    expect(result.workspacePath).not.toBeNull();
    expect(result.projectPath).toBeNull();
  });

  it("detects separate workspace and project configs", () => {
    createCockpitConfig(tmpDir);
    const projectDir = join(tmpDir, "project-a");
    createCockpitConfig(projectDir, "cockpit: '1.0'\nproject:\n  name: project-a\n");

    const result = findConfigPaths(projectDir);
    expect(result.workspacePath).toBe(join(tmpDir, COCKPIT_DIR, CONFIG_FILE));
    expect(result.projectPath).toBe(join(projectDir, COCKPIT_DIR, CONFIG_FILE));
  });
});

describe("getCockpitConfigPath", () => {
  it("returns expected path", () => {
    const result = getCockpitConfigPath("/some/dir");
    expect(result).toBe("/some/dir/.cockpit/config.yaml");
  });
});
