// Types
export type { AdapterName, ProfileConfig, WorkspaceConfig, ProjectConfig, ResolvedConfig } from "./types/config.js";
export { ProfileConfigSchema, WorkspaceConfigSchema, ProjectConfigSchema } from "./types/config.js";

export type { SkillDefinition, ResolvedSkill } from "./types/skill.js";
export { SkillDefinitionSchema } from "./types/skill.js";

export type { AgentDefinition, ResolvedAgent, AgentStatus } from "./types/agent.js";
export { AgentDefinitionSchema } from "./types/agent.js";

export type { CockpitAdapter } from "./types/adapter.js";

export type { ContextRule, ResolvedContext } from "./types/context.js";
export { ContextRuleSchema, buildResolvedContext } from "./types/context.js";

// Config system
export { loadConfig, tryLoadConfig, ConfigLoadError, ConfigValidationError } from "./config/loader.js";
export { resolveConfig, mergeConfigs, type ResolveOptions } from "./config/resolver.js";
export {
  findWorkspaceRoot,
  findProjectRoot,
  findConfigPaths,
  getProfileDir,
  getProfilePath,
  getCockpitConfigPath,
  COCKPIT_DIR,
  CONFIG_FILE,
  PROFILE_FILE,
  type ConfigPaths,
} from "./config/finder.js";
