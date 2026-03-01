import { readdirSync, existsSync } from "node:fs";
import { join, extname } from "node:path";
import {
  loadConfig,
  ConfigLoadError,
  ConfigValidationError,
  AgentDefinitionSchema,
  type ResolvedAgent,
} from "@cockpit/core";

// ─── Agent Loader ───────────────────────────────────────────────────────────

/**
 * Load a single agent from a YAML file and resolve it to ResolvedAgent.
 * Throws ConfigLoadError or ConfigValidationError on failure.
 */
export function loadAgentFromFile(filePath: string): ResolvedAgent {
  const raw = loadConfig(filePath, AgentDefinitionSchema);

  return {
    name: raw.name,
    role: raw.role,
    model: raw.model,
    skills: raw.skills ?? [],
    contextIncludes: raw.context?.include ?? [],
    contextRules: raw.context?.rules ?? [],
    worktreeConfig: {
      autoCreate: raw.worktree?.auto_create ?? false,
      branchPrefix: raw.worktree?.branch_prefix,
    },
    sourcePath: filePath,
    status: "idle",
  };
}

/**
 * Load all agents from a directory (*.yaml, *.yml files).
 * Skips files that fail to load, collecting errors separately.
 */
export function loadAgentsFromDir(dirPath: string): {
  agents: ResolvedAgent[];
  errors: Array<{ file: string; error: unknown }>;
} {
  if (!existsSync(dirPath)) {
    return { agents: [], errors: [] };
  }

  const agents: ResolvedAgent[] = [];
  const errors: Array<{ file: string; error: unknown }> = [];

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name);
    if (ext !== ".yaml" && ext !== ".yml") continue;

    const filePath = join(dirPath, entry.name);
    try {
      agents.push(loadAgentFromFile(filePath));
    } catch (err) {
      if (err instanceof ConfigLoadError || err instanceof ConfigValidationError) {
        errors.push({ file: filePath, error: err });
      } else {
        throw err;
      }
    }
  }

  return { agents, errors };
}
