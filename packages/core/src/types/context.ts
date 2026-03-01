import { z } from "zod";

// ─── Context Rule ──────────────────────────────────────────────────────────

export const ContextRuleSchema = z.object({
  content: z.string(),
  scope: z.enum(["global", "project"]).default("global"),
  source: z.string().optional(),
});

export type ContextRule = z.infer<typeof ContextRuleSchema>;

// ─── Resolved Context ──────────────────────────────────────────────────────

export interface ResolvedContext {
  global: ContextRule[];
  project: ContextRule[];
}

// ─── Helpers ───────────────────────────────────────────────────────────────

export function buildResolvedContext(
  globalRules: string[],
  projectRules: string[],
  source?: string
): ResolvedContext {
  return {
    global: globalRules.map((content) => ({ content, scope: "global", source })),
    project: projectRules.map((content) => ({ content, scope: "project", source })),
  };
}
