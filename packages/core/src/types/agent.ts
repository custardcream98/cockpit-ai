import { z } from "zod";

// ─── Agent Definition ──────────────────────────────────────────────────────

export const AgentDefinitionSchema = z.object({
  name: z.string(),
  role: z.string(),
  model: z.string().default("claude-sonnet-4-6"),

  context: z
    .object({
      include: z.array(z.string()).optional(),
      rules: z.array(z.string()).optional(),
    })
    .optional(),

  skills: z.array(z.string()).optional(),

  worktree: z
    .object({
      auto_create: z.boolean().default(false),
      branch_prefix: z.string().optional(),
    })
    .optional(),
});

export type AgentDefinition = z.infer<typeof AgentDefinitionSchema>;

// ─── Agent State ───────────────────────────────────────────────────────────

export type AgentStatus = "idle" | "spawning" | "running" | "stopped" | "error" | "completed";

// ─── Agent Run ─────────────────────────────────────────────────────────────

export interface AgentRunConfig {
  model?: string;
  maxTurns?: number;
  /** Claude Code 권한 모드 */
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  cwd?: string;
  env?: Record<string, string>;
  allowedTools?: string[];
}

export interface AgentRun {
  runId: string;
  agentName: string;
  status: AgentStatus;
  startedAt: string;
  stoppedAt?: string;
  /** Claude Code session ID (stream-json 출력에서 추출) */
  sessionId?: string;
  task?: string;
  result?: string;
  error?: string;
  config: AgentRunConfig;
  pid?: number;
  /** worktree 자동 생성 시 경로 */
  worktreePath?: string;
}

export interface ResolvedAgent {
  name: string;
  role: string;
  model: string;
  skills: string[];
  contextIncludes: string[];
  contextRules: string[];
  worktreeConfig: {
    autoCreate: boolean;
    branchPrefix: string | undefined;
  };
  sourcePath: string;
  status: AgentStatus;
}
