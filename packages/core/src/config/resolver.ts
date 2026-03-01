import {
  type ProfileConfig,
  type WorkspaceConfig,
  type ProjectConfig,
  type ResolvedConfig,
  type AdapterName,
  ProfileConfigSchema,
  WorkspaceConfigSchema,
  ProjectConfigSchema,
} from "../types/config.js";
import { tryLoadConfig } from "./loader.js";

// ─── Deep Merge Helpers ────────────────────────────────────────────────────

function mergeStringArrays(...arrays: (string[] | undefined)[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const arr of arrays) {
    for (const item of arr ?? []) {
      if (!seen.has(item)) {
        seen.add(item);
        result.push(item);
      }
    }
  }
  return result;
}

// ─── Resolver ─────────────────────────────────────────────────────────────

export interface ResolveOptions {
  profilePath?: string | null;
  workspacePath?: string | null;
  projectPath?: string | null;
}

/**
 * Load and merge configs in order: Profile → Workspace → Project.
 * Later layers override earlier ones (deep merge for arrays).
 */
export function resolveConfig(options: ResolveOptions): ResolvedConfig {
  const { profilePath, workspacePath, projectPath } = options;

  const profile = profilePath
    ? tryLoadConfig(profilePath, ProfileConfigSchema)
    : null;

  const workspace = workspacePath
    ? tryLoadConfig(workspacePath, WorkspaceConfigSchema)
    : null;

  const project = projectPath
    ? tryLoadConfig(projectPath, ProjectConfigSchema)
    : null;

  return mergeConfigs(
    { profilePath: profilePath ?? null, workspacePath: workspacePath ?? null, projectPath: projectPath ?? null },
    profile,
    workspace,
    project
  );
}

export function mergeConfigs(
  paths: { profilePath: string | null; workspacePath: string | null; projectPath: string | null },
  profile: ProfileConfig | null,
  workspace: WorkspaceConfig | null,
  project: ProjectConfig | null
): ResolvedConfig {
  // Name resolution: project > workspace > profile > fallback
  const name =
    project?.project?.name ??
    workspace?.workspace?.name ??
    profile?.profile?.name ??
    "unnamed";

  // Default adapter
  const defaultAdapter: AdapterName =
    project?.project?.default_adapter ??
    workspace?.workspace?.default_adapter ??
    profile?.preferences?.default_adapter ??
    "claude-code";

  // Adapters list: merge all, project overrides workspace overrides profile
  const adapters: AdapterName[] = mergeStringArrays(
    profile?.preferences?.default_adapter ? [profile.preferences.default_adapter] : [],
    workspace?.adapters,
    project?.adapters
  ) as AdapterName[];

  // Ensure default adapter is in list
  if (!adapters.includes(defaultAdapter)) {
    adapters.unshift(defaultAdapter);
  }

  // Preferences: profile base, overridden by nothing in workspace/project yet
  const language = profile?.preferences?.language ?? "en";
  const defaultModel = profile?.preferences?.default_model ?? "claude-sonnet-4-6";

  // Context: accumulate all global/project rules (all layers contribute)
  const globalContext = mergeStringArrays(
    profile?.context?.global,
    workspace?.context?.global,
    project?.context?.global
  );

  const projectContext = mergeStringArrays(
    profile?.context?.project,
    workspace?.context?.project,
    project?.context?.project
  );

  const contextFiles = mergeStringArrays(
    profile?.context?.files,
    workspace?.context?.files,
    project?.context?.files
  );

  // Skills includes
  const skillIncludes = mergeStringArrays(
    workspace?.skills?.include,
    project?.skills?.include
  );

  // Agent includes
  const agentIncludes = mergeStringArrays(
    workspace?.agents?.include,
    project?.agents?.include
  );

  return {
    profilePath: paths.profilePath,
    workspacePath: paths.workspacePath,
    projectPath: paths.projectPath,
    name,
    defaultAdapter,
    adapters,
    preferences: { language, defaultModel },
    context: { global: globalContext, project: projectContext, files: contextFiles },
    skills: { include: skillIncludes },
    agents: { include: agentIncludes },
  };
}
