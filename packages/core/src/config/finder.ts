import { existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

export const COCKPIT_DIR = ".cockpit";
export const CONFIG_FILE = "config.yaml";
export const PROFILE_FILE = "profile.yaml";

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
 * Find the nearest project `.cockpit/config.yaml` from `cwd`.
 * Stops at workspace root if found (same dir is fine — workspace IS project).
 */
export function findProjectRoot(cwd: string): string | null {
  const configPath = getCockpitConfigPath(cwd);
  if (existsSync(configPath)) {
    return cwd;
  }
  return null;
}

/**
 * Locate all relevant config paths from the given working directory.
 */
export interface ConfigPaths {
  profilePath: string | null;
  workspacePath: string | null;
  projectPath: string | null;
}

export function findConfigPaths(cwd: string): ConfigPaths {
  const profilePath = existsSync(getProfilePath()) ? getProfilePath() : null;

  // Collect all `.cockpit/config.yaml` roots walking up from cwd.
  // roots[0] = nearest, roots[1] = next ancestor, etc.
  const roots: string[] = [];
  let current = cwd;
  while (true) {
    if (existsSync(getCockpitConfigPath(current))) {
      roots.push(current);
    }
    const parent = dirname(current);
    if (parent === current) break; // filesystem root
    current = parent;
  }

  if (roots.length === 0) {
    return { profilePath, workspacePath: null, projectPath: null };
  }

  if (roots.length === 1) {
    // Only one config found → it is the workspace, no project-level config
    return {
      profilePath,
      workspacePath: getCockpitConfigPath(roots[0]!),
      projectPath: null,
    };
  }

  // Two or more: nearest = project, next ancestor = workspace
  return {
    profilePath,
    workspacePath: getCockpitConfigPath(roots[1]!),
    projectPath: getCockpitConfigPath(roots[0]!),
  };
}

