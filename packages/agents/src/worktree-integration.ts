import { join } from "node:path";
import type { ResolvedAgent } from "@cockpit-ai/core";
import { WorktreeManager, type WorktreeInfo } from "@cockpit-ai/worktree";

// ─── Worktree Integration ───────────────────────────────────────────────────

/**
 * task slug에서 branch-safe한 문자열로 변환.
 * 공백 → '-', 특수문자 제거, 최대 40자로 제한.
 */
function slugify(text: string): string {
  return text
    .toLowerCase()
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .slice(0, 40)
    .replace(/-+$/, "");
}

/**
 * 에이전트를 위한 worktree를 생성하고 경로를 반환.
 * agent.worktreeConfig.auto_create가 false면 null 반환.
 */
export async function createWorktreeForAgent(
  repoPath: string,
  agent: ResolvedAgent,
  taskSlug: string,
): Promise<WorktreeInfo | null> {
  if (!agent.worktreeConfig.autoCreate) return null;

  const prefix = agent.worktreeConfig.branchPrefix ?? `agent/${agent.name}/`;
  const slug = slugify(taskSlug);
  const timestamp = Date.now();
  const branch = `${prefix}${slug}-${timestamp}`;

  // worktree 경로: 레포 상위 디렉토리에 생성
  const worktreePath = join(repoPath, "..", `cockpit-wt-${agent.name}-${timestamp}`);

  const manager = new WorktreeManager(repoPath);
  return manager.create({ branch, path: worktreePath });
}

/**
 * 에이전트 완료 후 worktree 삭제 (브랜치는 유지).
 */
export async function cleanupWorktree(
  repoPath: string,
  worktreePath: string,
): Promise<void> {
  const manager = new WorktreeManager(repoPath);
  manager.remove(worktreePath);
}
