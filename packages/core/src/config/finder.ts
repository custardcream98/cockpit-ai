import { existsSync } from "node:fs";
import { join, dirname, relative, basename } from "node:path";
import { homedir } from "node:os";

export const COCKPIT_DIR = ".cockpit";
export const CONFIG_FILE = "config.yaml";
export const PROFILE_FILE = "profile.yaml";
export const PROJECTS_DIR = "projects";

// ─── Path Helpers ──────────────────────────────────────────────────────────

export function getProfileDir(): string {
  return join(homedir(), COCKPIT_DIR);
}

export function getProfilePath(): string {
  return join(getProfileDir(), PROFILE_FILE);
}

export function getCockpitConfigPath(dir: string): string {
  return join(dir, COCKPIT_DIR, CONFIG_FILE);
}

/**
 * workspace root 기준으로 프로젝트 config 경로를 반환.
 * 예: /dev/.cockpit/projects/abc-juice.yaml
 */
export function getProjectConfigPath(workspaceRoot: string, projectName: string): string {
  return join(workspaceRoot, COCKPIT_DIR, PROJECTS_DIR, `${projectName}.yaml`);
}

/**
 * 프로젝트 config 경로에서 프로젝트 이름을 추출.
 */
export function projectNameFromPath(projectPath: string): string {
  return basename(projectPath, ".yaml");
}

// ─── Finder ────────────────────────────────────────────────────────────────

/**
 * Walk up the directory tree from `cwd` looking for a `.cockpit/config.yaml`.
 * Returns the directory containing `.cockpit/` (not the config file path).
 * Returns null if nothing is found up to the filesystem root.
 */
export function findWorkspaceRoot(cwd: string): string | null {
  let current = cwd;

  while (true) {
    const configPath = getCockpitConfigPath(current);
    if (existsSync(configPath)) {
      return current;
    }

    const parent = dirname(current);
    if (parent === current) {
      // Reached filesystem root
      return null;
    }

    current = parent;
  }
}

/**
 * Locate all relevant config paths from the given working directory.
 *
 * 프로젝트 config는 각 레포의 `.cockpit/config.yaml`이 아니라
 * workspace의 `.cockpit/projects/<name>.yaml`에서 찾습니다.
 *
 * 예:
 *   workspace root = /dev/
 *   cwd = /dev/abc-juice/src/
 *   projectName = "abc-juice"
 *   projectPath = /dev/.cockpit/projects/abc-juice.yaml (존재할 때만)
 */
export interface ConfigPaths {
  profilePath: string | null;
  workspacePath: string | null;
  projectPath: string | null;
  /** workspace root 디렉토리 (`.cockpit/config.yaml`이 있는 곳) */
  workspaceRoot: string | null;
  /** cwd가 속한 프로젝트 이름 (workspace root 기준 첫 번째 세그먼트) */
  projectName: string | null;
}

export function findConfigPaths(cwd: string): ConfigPaths {
  const profilePath = existsSync(getProfilePath()) ? getProfilePath() : null;

  // 1. workspace root 탐색 (상위 방향)
  const workspaceRoot = findWorkspaceRoot(cwd);
  const workspacePath = workspaceRoot ? getCockpitConfigPath(workspaceRoot) : null;

  // 2. project name = workspace root 기준 cwd의 첫 번째 세그먼트
  let projectPath: string | null = null;
  let projectName: string | null = null;

  if (workspaceRoot && cwd !== workspaceRoot) {
    const rel = relative(workspaceRoot, cwd);
    // 상위 디렉토리(..)나 빈 문자열이면 프로젝트가 아님
    const firstSegment = rel.split("/")[0];
    if (firstSegment && !firstSegment.startsWith("..")) {
      const candidate = getProjectConfigPath(workspaceRoot, firstSegment);
      if (existsSync(candidate)) {
        projectPath = candidate;
        projectName = firstSegment;
      }
    }
  }

  return { profilePath, workspacePath, projectPath, workspaceRoot, projectName };
}
