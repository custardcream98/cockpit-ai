import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { ClaudeCodeAdapter } from "../claude-code/index.js";
import { makeSkill, makeContext, makeAgent } from "./helpers.js";

// ─── Setup ─────────────────────────────────────────────────────────────────

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
  it("creates .claude/skills/<name>/SKILL.md", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const path = join(tmpDir, ".claude", "skills", "code-review", "SKILL.md");
    expect(existsSync(path)).toBe(true);
  });

  it("file contains skill prompt", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".claude", "skills", "code-review", "SKILL.md"), "utf-8");
    expect(content).toContain("Review the code for bugs");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".claude", "skills", "code-review", "SKILL.md"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });

  it("file contains YAML frontmatter with name and description", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".claude", "skills", "code-review", "SKILL.md"), "utf-8");
    expect(content).toContain("name: code-review");
    expect(content).toContain("description:");
  });

  it("creates skills dir if it doesn't exist", async () => {
    expect(existsSync(join(tmpDir, ".claude", "skills"))).toBe(false);
    await adapter.applySkill(tmpDir, makeSkill());
    expect(existsSync(join(tmpDir, ".claude", "skills"))).toBe(true);
  });

  it("sanitizes skill name for directory name", async () => {
    await adapter.applySkill(tmpDir, makeSkill({ name: "My Skill!" }));
    expect(existsSync(join(tmpDir, ".claude", "skills", "my-skill-", "SKILL.md"))).toBe(true);
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
    writeFileSync(claudeMdPath, existingContent, "utf-8");

    await adapter.applyContext(tmpDir, makeContext());

    const content = readFileSync(claudeMdPath, "utf-8");
    expect(content).toContain("# My Project");
    expect(content).toContain("Some hand-written docs.");
    expect(content).toContain("Use TypeScript strict mode");
  });

  it("프로젝트별 컨텍스트 소스 경로에 projects/ 라벨을 렌더링", async () => {
    await adapter.applyContext(tmpDir, makeContext({
      global: [],
      project: [{
        content: "Project-specific rule",
        scope: "project",
        source: "/dev/.cockpit/projects/workspace/context/arch.md",
      }],
    }));

    const content = readFileSync(join(tmpDir, "CLAUDE.md"), "utf-8");
    // .cockpit/projects/workspace/context/arch.md → "projects/workspace/context/arch.md"
    expect(content).toContain("<!-- projects/workspace/context/arch.md -->");
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
  it("removes cockpit-managed skill directories", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const skillDir = join(tmpDir, ".claude", "skills", "code-review");
    expect(existsSync(skillDir)).toBe(true);

    await adapter.clean(tmpDir);
    expect(existsSync(skillDir)).toBe(false);
  });

  it("preserves non-cockpit skill directories", async () => {
    // 수동으로 생성한 스킬 디렉토리 (cockpit marker 없음)
    const manualSkillDir = join(tmpDir, ".claude", "skills", "manual-skill");
    mkdirSync(manualSkillDir, { recursive: true });
    const manualFile = join(manualSkillDir, "SKILL.md");
    writeFileSync(manualFile, "---\nname: manual-skill\n---\n# Manual skill\n\nNot managed by cockpit.", "utf-8");

    await adapter.applySkill(tmpDir, makeSkill());
    await adapter.clean(tmpDir);

    expect(existsSync(manualFile)).toBe(true);
  });

  it("strips cockpit section from CLAUDE.md but keeps user content", async () => {
    const claudeMdPath = join(tmpDir, "CLAUDE.md");
    writeFileSync(claudeMdPath, "# My Project\n\nUser content.\n", "utf-8");
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
