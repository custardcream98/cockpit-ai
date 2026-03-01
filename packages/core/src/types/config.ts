import { z } from "zod";

// ─── Shared ────────────────────────────────────────────────────────────────

const AdapterNameSchema = z.enum([
  "claude-code",
  "cursor",
  "copilot",
  "opencode",
]);
export type AdapterName = z.infer<typeof AdapterNameSchema>;

const ContextRulesSchema = z.object({
  global: z.array(z.string()).optional(),
  project: z.array(z.string()).optional(),
  files: z.array(z.string()).optional(),
});

const IncludeListSchema = z.object({
  include: z.array(z.string()).optional(),
});

// ─── Profile Config ────────────────────────────────────────────────────────

export const ProfileConfigSchema = z.object({
  cockpit: z.union([z.string(), z.number()]).transform(String),

  profile: z
    .object({
      name: z.string(),
      sync: z
        .object({
          remote: z.string().optional(),
          auto_sync: z.boolean().default(false),
        })
        .optional(),
    })
    .optional(),

  preferences: z
    .object({
      language: z.string().default("en"),
      default_model: z.string().default("claude-sonnet-4-6"),
      default_adapter: AdapterNameSchema.default("claude-code"),
    })
    .optional(),

  context: ContextRulesSchema.optional(),
});

export type ProfileConfig = z.infer<typeof ProfileConfigSchema>;

// ─── Workspace Config ──────────────────────────────────────────────────────

export const WorkspaceConfigSchema = z.object({
  cockpit: z.union([z.string(), z.number()]).transform(String),

  workspace: z
    .object({
      name: z.string(),
      default_adapter: AdapterNameSchema.optional(),
    })
    .optional(),

  adapters: z.array(AdapterNameSchema).optional(),

  skills: IncludeListSchema.optional(),

  agents: IncludeListSchema.optional(),

  context: ContextRulesSchema.optional(),
});

export type WorkspaceConfig = z.infer<typeof WorkspaceConfigSchema>;

// ─── Project Config ────────────────────────────────────────────────────────

export const ProjectConfigSchema = z.object({
  cockpit: z.union([z.string(), z.number()]).transform(String),

  project: z
    .object({
      name: z.string().optional(),
      default_adapter: AdapterNameSchema.optional(),
    })
    .optional(),

  adapters: z.array(AdapterNameSchema).optional(),

  skills: IncludeListSchema.optional(),

  agents: IncludeListSchema.optional(),

  context: ContextRulesSchema.optional(),
});

export type ProjectConfig = z.infer<typeof ProjectConfigSchema>;

// ─── Resolved Config ───────────────────────────────────────────────────────

export interface ResolvedConfig {
  profilePath: string | null;
  workspacePath: string | null;
  projectPath: string | null;

  name: string;
  defaultAdapter: AdapterName;
  adapters: AdapterName[];

  preferences: {
    language: string;
    defaultModel: string;
  };

  context: {
    global: string[];
    project: string[];
    files: string[];
  };

  skills: {
    include: string[];
  };

  agents: {
    include: string[];
  };
}
