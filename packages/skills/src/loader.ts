import { readdirSync, existsSync } from "node:fs";
import { join, extname, basename } from "node:path";
import {
  loadConfig,
  ConfigLoadError,
  ConfigValidationError,
  SkillDefinitionSchema,
  type ResolvedSkill,
  type AdapterName,
} from "@cockpit/core";

// ─── Skill Loader ──────────────────────────────────────────────────────────

/**
 * Load a single skill from a YAML file and resolve it to ResolvedSkill.
 * Throws on validation errors; returns null if file doesn't exist.
 */
export function loadSkillFromFile(filePath: string): ResolvedSkill {
  const raw = loadConfig(filePath, SkillDefinitionSchema);

  return {
    name: raw.name,
    version: raw.version,
    description: raw.description,
    trigger: raw.trigger ?? [],
    prompt: raw.prompt,
    tools: raw.tools ?? [],
    sourcePath: filePath,
    adapterConfig: (raw.adapters ?? {}) as Partial<Record<AdapterName, { type?: string; alwaysApply?: boolean }>>,
  };
}

/**
 * Load all skills from a directory (*.yaml, *.yml files).
 * Skips files that fail to load, collecting errors separately.
 */
export function loadSkillsFromDir(dirPath: string): {
  skills: ResolvedSkill[];
  errors: Array<{ file: string; error: unknown }>;
} {
  if (!existsSync(dirPath)) {
    return { skills: [], errors: [] };
  }

  const skills: ResolvedSkill[] = [];
  const errors: Array<{ file: string; error: unknown }> = [];

  for (const entry of readdirSync(dirPath, { withFileTypes: true })) {
    if (!entry.isFile()) continue;
    const ext = extname(entry.name);
    if (ext !== ".yaml" && ext !== ".yml") continue;

    const filePath = join(dirPath, entry.name);
    try {
      skills.push(loadSkillFromFile(filePath));
    } catch (err) {
      if (err instanceof ConfigLoadError || err instanceof ConfigValidationError) {
        errors.push({ file: filePath, error: err });
      } else {
        throw err;
      }
    }
  }

  return { skills, errors };
}
