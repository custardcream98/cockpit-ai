import { z } from "zod";
import { type AdapterName } from "./config.js";

// ─── Skill Definition ──────────────────────────────────────────────────────

export const SkillDefinitionSchema = z.object({
  name: z.string(),
  version: z.string().default("1.0.0"),
  description: z.string().optional(),

  trigger: z.array(z.string()).optional(),

  prompt: z.string(),

  tools: z.array(z.string()).optional(),

  adapters: z
    .record(
      z.string(),
      z.object({
        type: z.enum(["command", "skill", "rule"]).optional(),
        alwaysApply: z.boolean().optional(),
      })
    )
    .optional(),
});

export type SkillDefinition = z.infer<typeof SkillDefinitionSchema>;

// ─── Resolved Skill ────────────────────────────────────────────────────────

export interface ResolvedSkill {
  name: string;
  version: string;
  description: string | undefined;
  trigger: string[];
  prompt: string;
  tools: string[];
  sourcePath: string;
  adapterConfig: Partial<Record<AdapterName, { type?: string; alwaysApply?: boolean }>>;
}
