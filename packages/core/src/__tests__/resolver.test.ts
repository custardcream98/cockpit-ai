import { describe, it, expect } from "vitest";
import { mergeConfigs } from "../config/resolver.js";
import { type ProfileConfig, type WorkspaceConfig, type ProjectConfig } from "../types/config.js";

const paths = { profilePath: null, workspacePath: null, projectPath: null };

describe("mergeConfigs", () => {
  it("uses fallback defaults when all configs are null", () => {
    const result = mergeConfigs(paths, null, null, null);
    expect(result.name).toBe("unnamed");
    expect(result.defaultAdapter).toBe("claude-code");
    expect(result.adapters).toContain("claude-code");
    expect(result.preferences.language).toBe("en");
    expect(result.preferences.defaultModel).toBe("claude-sonnet-4-6");
  });

  it("profile preferences are used as base", () => {
    const profile: ProfileConfig = {
      cockpit: "1.0",
      profile: { name: "shiwoo" },
      preferences: {
        language: "ko",
        default_model: "claude-opus-4-6",
        default_adapter: "claude-code",
      },
      context: { global: ["I prefer Korean"] },
    };

    const result = mergeConfigs(paths, profile, null, null);
    expect(result.name).toBe("shiwoo");
    expect(result.preferences.language).toBe("ko");
    expect(result.preferences.defaultModel).toBe("claude-opus-4-6");
    expect(result.context.global).toContain("I prefer Korean");
  });

  it("workspace config overrides profile name and adapter", () => {
    const profile: ProfileConfig = {
      cockpit: "1.0",
      profile: { name: "shiwoo" },
      preferences: { language: "ko", default_model: "claude-sonnet-4-6", default_adapter: "claude-code" },
    };
    const workspace: WorkspaceConfig = {
      cockpit: "1.0",
      workspace: { name: "my-workspace", default_adapter: "cursor" },
    };

    const result = mergeConfigs(paths, profile, workspace, null);
    expect(result.name).toBe("my-workspace");
    expect(result.defaultAdapter).toBe("cursor");
  });

  it("project config overrides workspace name", () => {
    const workspace: WorkspaceConfig = {
      cockpit: "1.0",
      workspace: { name: "workspace" },
    };
    const project: ProjectConfig = {
      cockpit: "1.0",
      project: { name: "my-project" },
    };

    const result = mergeConfigs(paths, null, workspace, project);
    expect(result.name).toBe("my-project");
  });

  it("context rules are accumulated across all layers", () => {
    const profile: ProfileConfig = {
      cockpit: "1.0",
      context: { global: ["rule from profile"] },
    };
    const workspace: WorkspaceConfig = {
      cockpit: "1.0",
      context: { global: ["rule from workspace"] },
    };
    const project: ProjectConfig = {
      cockpit: "1.0",
      context: { global: ["rule from project"] },
    };

    const result = mergeConfigs(paths, profile, workspace, project);
    expect(result.context.global).toContain("rule from profile");
    expect(result.context.global).toContain("rule from workspace");
    expect(result.context.global).toContain("rule from project");
    expect(result.context.global).toHaveLength(3);
  });

  it("deduplicates context rules", () => {
    const workspace: WorkspaceConfig = {
      cockpit: "1.0",
      context: { global: ["shared rule"] },
    };
    const project: ProjectConfig = {
      cockpit: "1.0",
      context: { global: ["shared rule"] },
    };

    const result = mergeConfigs(paths, null, workspace, project);
    expect(result.context.global.filter((r) => r === "shared rule")).toHaveLength(1);
  });

  it("adapter lists are merged without duplicates", () => {
    const workspace: WorkspaceConfig = {
      cockpit: "1.0",
      adapters: ["claude-code", "cursor"],
    };
    const project: ProjectConfig = {
      cockpit: "1.0",
      adapters: ["cursor", "opencode"],
    };

    const result = mergeConfigs(paths, null, workspace, project);
    expect(result.adapters).toContain("claude-code");
    expect(result.adapters).toContain("cursor");
    expect(result.adapters).toContain("opencode");
    expect(result.adapters.filter((a) => a === "cursor")).toHaveLength(1);
  });

  it("skills and agents includes are merged", () => {
    const workspace: WorkspaceConfig = {
      cockpit: "1.0",
      skills: { include: ["./skills/"] },
      agents: { include: ["./agents/"] },
    };
    const project: ProjectConfig = {
      cockpit: "1.0",
      skills: { include: ["./local-skills/"] },
    };

    const result = mergeConfigs(paths, null, workspace, project);
    expect(result.skills.include).toContain("./skills/");
    expect(result.skills.include).toContain("./local-skills/");
    expect(result.agents.include).toContain("./agents/");
  });

  it("stores source paths in result", () => {
    const p = {
      profilePath: "/home/user/.cockpit/profile.yaml",
      workspacePath: "/dev/.cockpit/config.yaml",
      projectPath: null,
    };
    const result = mergeConfigs(p, null, null, null);
    expect(result.profilePath).toBe("/home/user/.cockpit/profile.yaml");
    expect(result.workspacePath).toBe("/dev/.cockpit/config.yaml");
    expect(result.projectPath).toBeNull();
  });
});
