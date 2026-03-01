import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeCodeAdapter } from "../claude-code/index.js";
import { type ResolvedSkill, type ResolvedContext, type ResolvedAgent } from "@cockpit/core";

// ─── Helpers ───────────────────────────────────────────────────────────────

let tmpDir: string;
let adapter: ClaudeCodeAdapter;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-adapter-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  adapter = new ClaudeCodeAdapter();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function makeSkill(overrides: Partial<ResolvedSkill> = {}): ResolvedSkill {
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

function makeContext(overrides: Partial<ResolvedContext> = {}): ResolvedContext {
  return {
    global: [{ content: "Use TypeScript strict mode", scope: "global" }],
    project: [{ content: "No console.log in production", scope: "project" }],
    ...overrides,
  };
}

function makeAgent(overrides: Partial<ResolvedAgent> = {}): ResolvedAgent {
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

// ─── detect ────────────────────────────────────────────────────────────────

describe("detect", () => {
  it("returns true when .claude/ directory exists", async () => {
    mkdirSync(join(tmpDir, ".claude"), { recursive: true });
    expect(await adapter.detect(tmpDir)).toBe(true);
  });

  it("returns false when .claude/ does not exist", async () => {
    expect(await adapter.detect(tmpDir)).toBe(false);
  });
});

// ─── applySkill ────────────────────────────────────────────────────────────

describe("applySkill", () => {
  it("creates .claude/commands/<name>.md", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const path = join(tmpDir, ".claude", "commands", "code-review.md");
    expect(existsSync(path)).toBe(true);
  });

  it("file contains skill prompt", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".claude", "commands", "code-review.md"), "utf-8");
    expect(content).toContain("Review the code for bugs");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".claude", "commands", "code-review.md"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });

  it("creates commands dir if it doesn't exist", async () => {
    expect(existsSync(join(tmpDir, ".claude", "commands"))).toBe(false);
    await adapter.applySkill(tmpDir, makeSkill());
    expect(existsSync(join(tmpDir, ".claude", "commands"))).toBe(true);
  });

  it("sanitizes skill name for filename", async () => {
    await adapter.applySkill(tmpDir, makeSkill({ name: "My Skill!" }));
    expect(existsSync(join(tmpDir, ".claude", "commands", "my-skill-.md"))).toBe(true);
  });
});

// ─── applyContext ──────────────────────────────────────────────────────────

describe("applyContext", () => {
  it("creates CLAUDE.md with context rules", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    const claudeMdPath = join(tmpDir, "CLAUDE.md");
    expect(existsSync(claudeMdPath)).toBe(true);
    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("Use TypeScript strict mode");
    expect(content).toContain("No console.log in production");
  });

  it("preserves existing CLAUDE.md content above the marker", async () => {
    const claudeMdPath = join(tmpDir, "CLAUDE.md");
    const existingContent = "# My Project\n\nSome hand-written docs.\n";
    require("node:fs").writeFileSync(claudeMdPath, existingContent, "utf-8");

    await adapter.applyContext(tmpDir, makeContext());

    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some hand-written docs.");
    expect(content).toContain("Use TypeScript strict mode");
  });

  it("replaces previous cockpit section on re-apply", async () => {
    await adapter.applyContext(tmpDir, makeContext({
      global: [{ content: "Old rule", scope: "global" }],
      project: [],
    }));
    await adapter.applyContext(tmpDir, makeContext({
      global: [{ content: "New rule", scope: "global" }],
      project: [],
    }));

    const content = readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8");
    expect(content).not.toContain("Old rule");
    expect(content).toContain("New rule");
  });
});

// ─── applyAgent ────────────────────────────────────────────────────────────

describe("applyAgent", () => {
  it("creates .claude/agents/<name>.md", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    expect(existsSync(join(tmpDir, ".claude", "agents", "test-runner.md"))).toBe(true);
  });

  it("file contains agent role and model", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    const content = readFileSync(join(tmpDir, ".claude", "agents", "test-runner.md"), "utf-8");
    expect(content).toContain("Test execution specialist");
    expect(content).toContain("claude-sonnet-4-6");
  });
});

// ─── clean ─────────────────────────────────────────────────────────────────

describe("clean", () => {
  it("removes cockpit-managed command files", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const path = join(tmpDir, ".claude", "commands", "code-review.md");
    expect(existsSync(path)).toBe(true);

    await adapter.clean(tmpDir);
    expect(existsSync(path)).toBe(false);
  });

  it("preserves non-cockpit command files", async () => {
    const commandsDir = join(tmpDir, ".claude", "commands");
    mkdirSync(commandsDir, { recursive: true });
    const manualFile = join(commandsDir, "manual.md");
    require("node:fs").writeFileSync(manualFile, "# Manual command\n\nNot managed by cockpit.", "utf-8");

    await adapter.applySkill(tmpDir, makeSkill());
    await adapter.clean(tmpDir);

    expect(existsSync(manualFile)).toBe(true);
  });

  it("strips cockpit section from CLAUDE.md but keeps user content", async () => {
    const claudeMdPath = join(tmpDir, "CLAUDE.md");
    require("node:fs").writeFileSync(claudeMdPath, "# My Project\n\nUser content.\n", "utf-8");
    await adapter.applyContext(tmpDir, makeContext());
    await adapter.clean(tmpDir);

    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).not.toContain("<!-- cockpit:managed -->");
  });

  it("deletes CLAUDE.md if it only contained cockpit content", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    await adapter.clean(tmpDir);
    expect(existsSync(join(tmpDir, "CLAUDE.md"))).toBe(false);
  });
});
