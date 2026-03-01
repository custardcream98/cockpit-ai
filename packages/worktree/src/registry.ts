import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WorktreeState {
  worktrees: Record<
    string,
    { path: string; branch: string; assignedAgent?: string; createdAt: string }
  >;
}

// ─── State file path ────────────────────────────────────────────────────────

const STATE_FILE = join(homedir(), ".cockpit", "worktree-state.json");

// ─── I/O helpers ───────────────────────────────────────────────────────────

export function readWorktreeState(): WorktreeState {
  if (!existsSync(STATE_FILE)) {
    return { worktrees: {} };
  }
  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as WorktreeState;
  } catch {
    return { worktrees: {} };
  }
}

export function writeWorktreeState(state: WorktreeState): void {
  const dir = dirname(STATE_FILE);
  mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ─── Registry operations ────────────────────────────────────────────────────

export function registerWorktree(path: string, branch: string): void {
  const state = readWorktreeState();
  state.worktrees[path] = {
    path,
    branch,
    createdAt: new Date().toISOString(),
  };
  writeWorktreeState(state);
}

export function unregisterWorktree(path: string): void {
  const state = readWorktreeState();
  delete state.worktrees[path];
  writeWorktreeState(state);
}

export function assignAgent(worktreePath: string, agentName: string): void {
  const state = readWorktreeState();
  const entry = state.worktrees[worktreePath];
  if (!entry) {
    throw new Error(`Worktree not registered: ${worktreePath}`);
  }
  entry.assignedAgent = agentName;
  writeWorktreeState(state);
}

export function getWorktreeState(
  path: string
): WorktreeState["worktrees"][string] | undefined {
  const state = readWorktreeState();
  return state.worktrees[path];
}
