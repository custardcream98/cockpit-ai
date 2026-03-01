import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ConfigValidationError } from "@cockpit/core";
import { loadAgentFromFile, loadAgentsFromDir } from "../loader.js";
import { AgentRegistry } from "../registry.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-agents-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeAgent(name: string, content: string): string {
  const path = join(tmpDir, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

const VALID_AGENT = `
name: test-runner
role: Test execution specialist
model: claude-sonnet-4-6
context:
  rules:
    - "Always run tests before reporting"
skills:
  - code-review
`;

const VALID_AGENT_FULL = `
name: full-agent
role: Full featured agent
model: claude-opus-4-6
context:
  include:
    - "docs/**"
  rules:
    - "Follow the style guide"
    - "Write tests"
skills:
  - code-review
  - testing
worktree:
  auto_create: true
  branch_prefix: agent/
`;

// ─── loadAgentFromFile ──────────────────────────────────────────────────────

describe("loadAgentFromFile", () => {
  it("loads a valid agent", () => {
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    const agent = loadAgentFromFile(path);
    expect(agent.name).toBe("test-runner");
    expect(agent.role).toBe("Test execution specialist");
    expect(agent.model).toBe("claude-sonnet-4-6");
    expect(agent.skills).toContain("code-review");
    expect(agent.contextRules).toContain("Always run tests before reporting");
    expect(agent.sourcePath).toBe(path);
    expect(agent.status).toBe("idle");
  });

  it("defaults to empty arrays for optional fields", () => {
    const minimal = `
name: minimal-agent
role: Minimal role
`;
    const path = writeAgent("minimal.yaml", minimal);
    const agent = loadAgentFromFile(path);
    expect(agent.skills).toEqual([]);
    expect(agent.contextRules).toEqual([]);
    expect(agent.contextIncludes).toEqual([]);
  });

  it("defaults model to claude-sonnet-4-6 when not specified", () => {
    const noModel = `
name: no-model-agent
role: Some role
`;
    const path = writeAgent("no-model.yaml", noModel);
    const agent = loadAgentFromFile(path);
    expect(agent.model).toBe("claude-sonnet-4-6");
  });

  it("resolves worktreeConfig correctly for full agent", () => {
    const path = writeAgent("full.yaml", VALID_AGENT_FULL);
    const agent = loadAgentFromFile(path);
    expect(agent.worktreeConfig.autoCreate).toBe(true);
    expect(agent.worktreeConfig.branchPrefix).toBe("agent/");
  });

  it("defaults worktreeConfig to autoCreate=false and branchPrefix=undefined", () => {
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    const agent = loadAgentFromFile(path);
    expect(agent.worktreeConfig.autoCreate).toBe(false);
    expect(agent.worktreeConfig.branchPrefix).toBeUndefined();
  });

  it("resolves contextIncludes from context.include", () => {
    const path = writeAgent("full.yaml", VALID_AGENT_FULL);
    const agent = loadAgentFromFile(path);
    expect(agent.contextIncludes).toContain("docs/**");
  });

  it("always sets status to idle when loaded from file", () => {
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    const agent = loadAgentFromFile(path);
    expect(agent.status).toBe("idle");
  });

  it("throws ConfigValidationError when required fields are missing", () => {
    const missingRole = `
name: bad-agent
`;
    const path = writeAgent("bad.yaml", missingRole);
    expect(() => loadAgentFromFile(path)).toThrow(ConfigValidationError);
  });

  it("throws ConfigValidationError when name is missing", () => {
    const missingName = `
role: Some role
`;
    const path = writeAgent("no-name.yaml", missingName);
    expect(() => loadAgentFromFile(path)).toThrow(ConfigValidationError);
  });
});

// ─── loadAgentsFromDir ──────────────────────────────────────────────────────

describe("loadAgentsFromDir", () => {
  it("loads all yaml files from directory", () => {
    writeAgent("agent1.yaml", VALID_AGENT);
    writeAgent("agent2.yaml", VALID_AGENT.replace("test-runner", "another-agent"));
    const { agents, errors } = loadAgentsFromDir(tmpDir);
    expect(agents).toHaveLength(2);
    expect(errors).toHaveLength(0);
  });

  it("loads both .yaml and .yml files", () => {
    writeAgent("agent1.yaml", VALID_AGENT);
    writeAgent("agent2.yml", VALID_AGENT.replace("test-runner", "yml-agent"));
    const { agents } = loadAgentsFromDir(tmpDir);
    expect(agents).toHaveLength(2);
  });

  it("skips non-yaml files", () => {
    writeAgent("agent.yaml", VALID_AGENT);
    writeAgent("notes.txt", "this is a text file");
    writeAgent("config.json", '{"hello": "world"}');
    const { agents } = loadAgentsFromDir(tmpDir);
    expect(agents).toHaveLength(1);
  });

  it("collects errors for invalid agents without throwing", () => {
    writeAgent("valid.yaml", VALID_AGENT);
    writeAgent("invalid.yaml", "name: broken-agent\n# missing role\n");
    const { agents, errors } = loadAgentsFromDir(tmpDir);
    expect(agents).toHaveLength(1);
    expect(errors).toHaveLength(1);
  });

  it("returns empty result for non-existent directory", () => {
    const { agents, errors } = loadAgentsFromDir(join(tmpDir, "nonexistent"));
    expect(agents).toHaveLength(0);
    expect(errors).toHaveLength(0);
  });
});

// ─── AgentRegistry ──────────────────────────────────────────────────────────

describe("AgentRegistry", () => {
  it("starts empty", () => {
    const registry = new AgentRegistry();
    expect(registry.size()).toBe(0);
    expect(registry.list()).toEqual([]);
  });

  it("add and get an agent", () => {
    const registry = new AgentRegistry();
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    const agent = loadAgentFromFile(path);
    registry.add(agent);
    expect(registry.get("test-runner")).toBe(agent);
  });

  it("has returns true for existing agent", () => {
    const registry = new AgentRegistry();
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    registry.add(loadAgentFromFile(path));
    expect(registry.has("test-runner")).toBe(true);
  });

  it("has returns false for unknown agent", () => {
    const registry = new AgentRegistry();
    expect(registry.has("nonexistent")).toBe(false);
  });

  it("list returns all agents", () => {
    const registry = new AgentRegistry();
    const path1 = writeAgent("agent1.yaml", VALID_AGENT);
    const path2 = writeAgent("agent2.yaml", VALID_AGENT.replace("test-runner", "another-agent"));
    registry.add(loadAgentFromFile(path1));
    registry.add(loadAgentFromFile(path2));
    expect(registry.list()).toHaveLength(2);
  });

  it("remove deletes an agent and returns true", () => {
    const registry = new AgentRegistry();
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    registry.add(loadAgentFromFile(path));
    expect(registry.remove("test-runner")).toBe(true);
    expect(registry.has("test-runner")).toBe(false);
    expect(registry.size()).toBe(0);
  });

  it("remove returns false for non-existent agent", () => {
    const registry = new AgentRegistry();
    expect(registry.remove("nonexistent")).toBe(false);
  });

  it("loadFromDirs loads agents from multiple directories", () => {
    const dir1 = join(tmpDir, "dir1");
    const dir2 = join(tmpDir, "dir2");
    mkdirSync(dir1, { recursive: true });
    mkdirSync(dir2, { recursive: true });
    writeFileSync(join(dir1, "agent1.yaml"), VALID_AGENT, "utf-8");
    writeFileSync(join(dir2, "agent2.yaml"), VALID_AGENT.replace("test-runner", "another-agent"), "utf-8");

    const registry = new AgentRegistry();
    const errors = registry.loadFromDirs([dir1, dir2]);
    expect(registry.size()).toBe(2);
    expect(errors).toHaveLength(0);
  });

  it("loadFromDirs returns errors for invalid files", () => {
    const dir = join(tmpDir, "agents");
    mkdirSync(dir, { recursive: true });
    writeFileSync(join(dir, "valid.yaml"), VALID_AGENT, "utf-8");
    writeFileSync(join(dir, "invalid.yaml"), "name: broken\n# missing role\n", "utf-8");

    const registry = new AgentRegistry();
    const errors = registry.loadFromDirs([dir]);
    expect(registry.size()).toBe(1);
    expect(errors).toHaveLength(1);
  });

  it("loadFromDirs silently ignores non-existent directories", () => {
    const registry = new AgentRegistry();
    const errors = registry.loadFromDirs([join(tmpDir, "nonexistent")]);
    expect(registry.size()).toBe(0);
    expect(errors).toHaveLength(0);
  });

  it("adding agent with same name overwrites previous entry", () => {
    const registry = new AgentRegistry();
    const path = writeAgent("test-runner.yaml", VALID_AGENT);
    const agent1 = loadAgentFromFile(path);
    const agent2 = { ...agent1, role: "Updated role" };
    registry.add(agent1);
    registry.add(agent2);
    expect(registry.size()).toBe(1);
    expect(registry.get("test-runner")?.role).toBe("Updated role");
  });
});
