import { type ResolvedSkill, type ResolvedContext, type ResolvedAgent } from "@cockpit/core";

export function makeSkill(overrides: Partial<ResolvedSkill> = {}): ResolvedSkill {
  return {
    name: "code-review",
    version: "1.0.0",
    description: "Comprehensive code review",
    trigger: ["/review"],
    prompt: "Review the code for bugs and performance issues.",
    tools: ["read", "grep"],
    sourcePath: "/tmp/skill.yaml",
    adapterConfig: {},
    ...overrides,
  };
}

export function makeContext(overrides: Partial<ResolvedContext> = {}): ResolvedContext {
  return {
    global: [{ content: "Use TypeScript strict mode", scope: "global" }],
    project: [{ content: "No console.log in production", scope: "project" }],
    ...overrides,
  };
}

export function makeAgent(overrides: Partial<ResolvedAgent> = {}): ResolvedAgent {
  return {
    name: "test-runner",
    role: "Test execution specialist",
    model: "claude-sonnet-4-6",
    skills: ["test-analysis"],
    contextIncludes: ["**/*.test.ts"],
    contextRules: ["Always run tests before reporting success"],
    worktreeConfig: { autoCreate: false, branchPrefix: undefined },
    sourcePath: "/tmp/agent.yaml",
    status: "idle",
    ...overrides,
  };
}
