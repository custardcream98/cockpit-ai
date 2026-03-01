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

export type AgentStatus = "idle" | "running" | "stopped" | "error";

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
