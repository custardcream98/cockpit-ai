import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { OpenCodeAdapter } from "../opencode/index.js";
import { makeSkill, makeContext, makeAgent } from "./helpers.js";

let tmpDir: string;
let adapter: OpenCodeAdapter;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-opencode-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  adapter = new OpenCodeAdapter();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── detect ────────────────────────────────────────────────────────────────

describe("detect", () => {
  it("returns true when .opencode/ directory exists", async () => {
    mkdirSync(join(tmpDir, ".opencode"), { recursive: true });
    expect(await adapter.detect(tmpDir)).toBe(true);
  });

  it("returns true when opencode.json exists", async () => {
    writeFileSync(join(tmpDir, "opencode.json"), "{}", "utf-8");
    expect(await adapter.detect(tmpDir)).toBe(true);
  });

  it("returns false when neither .opencode/ nor opencode.json exist", async () => {
    expect(await adapter.detect(tmpDir)).toBe(false);
  });
});

// ─── applySkill ────────────────────────────────────────────────────────────

describe("applySkill", () => {
  it("creates .opencode/skills/<name>/SKILL.md", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const path = join(tmpDir, ".opencode", "skills", "code-review", "SKILL.md");
    expect(existsSync(path)).toBe(true);
  });

  it("file contains skill prompt", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".opencode", "skills", "code-review", "SKILL.md"), "utf-8");
    expect(content).toContain("Review the code for bugs");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".opencode", "skills", "code-review", "SKILL.md"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });

  it("file contains YAML frontmatter with name and description", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".opencode", "skills", "code-review", "SKILL.md"), "utf-8");
    expect(content).toContain("name: code-review");
    expect(content).toContain("description:");
  });

  it("creates skills dir if it doesn't exist", async () => {
    expect(existsSync(join(tmpDir, ".opencode", "skills"))).toBe(false);
    await adapter.applySkill(tmpDir, makeSkill());
    expect(existsSync(join(tmpDir, ".opencode", "skills"))).toBe(true);
  });

  it("sanitizes skill name for directory name", async () => {
    await adapter.applySkill(tmpDir, makeSkill({ name: "My Skill!" }));
    expect(existsSync(join(tmpDir, ".opencode", "skills", "my-skill-", "SKILL.md"))).toBe(true);
  });
});

// ─── applyContext ──────────────────────────────────────────────────────────

describe("applyContext", () => {
  it("creates AGENTS.md with context rules", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    const path = join(tmpDir, "AGENTS.md");
    expect(existsSync(path)).toBe(true);
    const content = readFileSync(path, "utf-8");
    expect(content).toContain("Use TypeScript strict mode");
    expect(content).toContain("No console.log in production");
  });

  it("preserves existing AGENTS.md content outside cockpit section", async () => {
    const agentsMdPath = join(tmpDir, "AGENTS.md");
    writeFileSync(agentsMdPath, "# My Project\n\nHand-written docs.\n", "utf-8");

    await adapter.applyContext(tmpDir, makeContext());

    const content = readFileSync(agentsMdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Hand-written docs.");
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

    const content = readFileSync(join(tmpDir, "AGENTS.md"), "utf-8");
    expect(content).not.toContain("Old rule");
    expect(content).toContain("New rule");
  });
});

// ─── applyAgent ────────────────────────────────────────────────────────────

describe("applyAgent", () => {
  it("creates .opencode/agents/<name>.md", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    expect(existsSync(join(tmpDir, ".opencode", "agents", "test-runner.md"))).toBe(true);
  });

  it("file contains agent role and model", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    const content = readFileSync(join(tmpDir, ".opencode", "agents", "test-runner.md"), "utf-8");
    expect(content).toContain("Test execution specialist");
    expect(content).toContain("claude-sonnet-4-6");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    const content = readFileSync(join(tmpDir, ".opencode", "agents", "test-runner.md"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });
});

// ─── clean ─────────────────────────────────────────────────────────────────

describe("clean", () => {
  it("removes cockpit-managed skill directories", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const skillDir = join(tmpDir, ".opencode", "skills", "code-review");
    expect(existsSync(skillDir)).toBe(true);

    await adapter.clean(tmpDir);
    expect(existsSync(skillDir)).toBe(false);
  });

  it("preserves non-cockpit skill directories", async () => {
    // 수동으로 생성한 스킬 디렉토리 (cockpit marker 없음)
    const manualSkillDir = join(tmpDir, ".opencode", "skills", "manual-skill");
    mkdirSync(manualSkillDir, { recursive: true });
    const manualFile = join(manualSkillDir, "SKILL.md");
    writeFileSync(manualFile, "---\nname: manual-skill\n---\n# Manual skill\n\nNot managed by cockpit.", "utf-8");

    await adapter.applySkill(tmpDir, makeSkill());
    await adapter.clean(tmpDir);

    expect(existsSync(manualFile)).toBe(true);
  });

  it("strips cockpit section from AGENTS.md but keeps user content", async () => {
    const agentsMdPath = join(tmpDir, "AGENTS.md");
    writeFileSync(agentsMdPath, "# My Project\n\nUser content.\n", "utf-8");
    await adapter.applyContext(tmpDir, makeContext());
    await adapter.clean(tmpDir);

    const content = readFileSync(agentsMdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).not.toContain("<!-- cockpit:section:start -->");
  });

  it("deletes AGENTS.md if it only contained cockpit content", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    await adapter.clean(tmpDir);
    expect(existsSync(join(tmpDir, "AGENTS.md"))).toBe(false);
  });

  it("removes cockpit-managed agent files", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    const path = join(tmpDir, ".opencode", "agents", "test-runner.md");
    expect(existsSync(path)).toBe(true);

    await adapter.clean(tmpDir);
    expect(existsSync(path)).toBe(false);
  });
});
