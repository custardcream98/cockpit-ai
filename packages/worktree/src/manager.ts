import { execSync } from "node:child_process";
import { join, dirname } from "node:path";

// ─── Types ─────────────────────────────────────────────────────────────────

export interface WorktreeInfo {
  path: string;
  branch: string;
  commit: string;
  isMain: boolean;
  assignedAgent?: string;
}

export interface CreateWorktreeOptions {
  repo: string;        // path to git repo (defaults to cwd)
  branch: string;      // branch name to create/checkout
  path?: string;       // where to create the worktree (defaults to ../<branch>)
  createBranch?: boolean; // -b flag, true by default
}

// ─── WorktreeManager ───────────────────────────────────────────────────────

export class WorktreeManager {
  constructor(private readonly repoPath: string) {}

  /**
   * Create a new worktree.
   * git worktree add -b <branch> <path> [base-branch]
   */
  create(opts: Omit<CreateWorktreeOptions, "repo">): WorktreeInfo {
    const targetPath =
      opts.path ?? join(dirname(this.repoPath), opts.branch.replace(/\//g, "-"));
    const flag = opts.createBranch !== false ? "-b" : "";
    execSync(`git worktree add ${flag} ${opts.branch} ${targetPath}`, {
      cwd: this.repoPath,
      stdio: "pipe",
    });
    return { path: targetPath, branch: opts.branch, commit: "", isMain: false };
  }

  /**
   * List all worktrees in the repo.
   * git worktree list --porcelain
   */
  list(): WorktreeInfo[] {
    const output = execSync("git worktree list --porcelain", {
      cwd: this.repoPath,
      stdio: "pipe",
    }).toString("utf-8");

    const worktrees: WorktreeInfo[] = [];
    const blocks = output.trim().split(/\n\n+/);

    for (let i = 0; i < blocks.length; i++) {
      const block = blocks[i];
      if (!block) continue;

      const lines = block.split("\n");
      let path = "";
      let commit = "";
      let branch = "";

      for (const line of lines) {
        if (line.startsWith("worktree ")) {
          path = line.slice("worktree ".length).trim();
        } else if (line.startsWith("HEAD ")) {
          commit = line.slice("HEAD ".length).trim();
        } else if (line.startsWith("branch ")) {
          // refs/heads/main -> main
          const ref = line.slice("branch ".length).trim();
          branch = ref.replace(/^refs\/heads\//, "");
        }
      }

      if (path) {
        worktrees.push({
          path,
          branch,
          commit,
          isMain: i === 0,
        });
      }
    }

    return worktrees;
  }

  /**
   * Remove a worktree by path.
   * git worktree remove <path> [--force]
   */
  remove(worktreePath: string, force?: boolean): void {
    const forceFlag = force ? " --force" : "";
    execSync(`git worktree remove ${worktreePath}${forceFlag}`, {
      cwd: this.repoPath,
      stdio: "pipe",
    });
  }

  /**
   * Prune stale worktree references.
   * git worktree prune
   */
  prune(): void {
    execSync("git worktree prune", {
      cwd: this.repoPath,
      stdio: "pipe",
    });
  }
}
