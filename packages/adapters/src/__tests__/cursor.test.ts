import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { CursorAdapter } from "../cursor/index.js";
import { makeSkill, makeContext, makeAgent } from "./helpers.js";

let tmpDir: string;
let adapter: CursorAdapter;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-cursor-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  adapter = new CursorAdapter();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── detect ────────────────────────────────────────────────────────────────

describe("detect", () => {
  it("returns true when .cursor/ directory exists", async () => {
    mkdirSync(join(tmpDir, ".cursor"), { recursive: true });
    expect(await adapter.detect(tmpDir)).toBe(true);
  });

  it("returns false when .cursor/ does not exist", async () => {
    expect(await adapter.detect(tmpDir)).toBe(false);
  });
});

// ─── applySkill ────────────────────────────────────────────────────────────

describe("applySkill", () => {
  it("creates .cursor/rules/<name>.mdc", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const path = join(tmpDir, ".cursor", "rules", "code-review.mdc");
    expect(existsSync(path)).toBe(true);
  });

  it("file contains skill prompt", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "code-review.mdc"), "utf-8");
    expect(content).toContain("Review the code for bugs");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "code-review.mdc"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });

  it("file has MDC frontmatter", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "code-review.mdc"), "utf-8");
    expect(content).toMatch(/^---\n/);
    expect(content).toContain("alwaysApply:");
    expect(content).toContain("description:");
  });

  it("creates rules dir if it doesn't exist", async () => {
    expect(existsSync(join(tmpDir, ".cursor", "rules"))).toBe(false);
    await adapter.applySkill(tmpDir, makeSkill());
    expect(existsSync(join(tmpDir, ".cursor", "rules"))).toBe(true);
  });

  it("sanitizes skill name for filename", async () => {
    await adapter.applySkill(tmpDir, makeSkill({ name: "My Skill!" }));
    expect(existsSync(join(tmpDir, ".cursor", "rules", "my-skill-.mdc"))).toBe(true);
  });

  it("respects alwaysApply from adapterConfig", async () => {
    const skill = makeSkill({ adapterConfig: { cursor: { alwaysApply: true } } });
    await adapter.applySkill(tmpDir, skill);
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "code-review.mdc"), "utf-8");
    expect(content).toContain("alwaysApply: true");
  });
});

// ─── applyContext ──────────────────────────────────────────────────────────

describe("applyContext", () => {
  it("creates .cursor/rules/cockpit-context.mdc", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    expect(existsSync(join(tmpDir, ".cursor", "rules", "cockpit-context.mdc"))).toBe(true);
  });

  it("file contains context rules", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "cockpit-context.mdc"), "utf-8");
    expect(content).toContain("Use TypeScript strict mode");
    expect(content).toContain("No console.log in production");
  });

  it("context file has alwaysApply: true", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "cockpit-context.mdc"), "utf-8");
    expect(content).toContain("alwaysApply: true");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "cockpit-context.mdc"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });

  it("멀티라인 content는 raw block으로 렌더링한다 (bullet으로 합치지 않음)", async () => {
    const multilineContext = makeContext({
      global: [{ content: "Line one\nLine two\nLine three", scope: "global" }],
      project: [],
    });
    await adapter.applyContext(tmpDir, multilineContext);
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "cockpit-context.mdc"), "utf-8");
    // 멀티라인은 raw block으로 — bullet 없이 원본 텍스트가 그대로 있어야 함
    expect(content).toContain("Line one\nLine two\nLine three");
    // bullet으로 잘못 렌더링되면 "- Line one" 형태가 됨
    expect(content).not.toContain("- Line one\nLine two");
  });
});

// ─── applyAgent ────────────────────────────────────────────────────────────

describe("applyAgent", () => {
  it("creates .cursor/rules/cockpit-agent-<name>.mdc", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    expect(existsSync(join(tmpDir, ".cursor", "rules", "cockpit-agent-test-runner.mdc"))).toBe(true);
  });

  it("file contains agent role and model", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "cockpit-agent-test-runner.mdc"), "utf-8");
    expect(content).toContain("Test execution specialist");
    expect(content).toContain("claude-sonnet-4-6");
  });

  it("file contains cockpit marker", async () => {
    await adapter.applyAgent(tmpDir, makeAgent());
    const content = readFileSync(join(tmpDir, ".cursor", "rules", "cockpit-agent-test-runner.mdc"), "utf-8");
    expect(content).toContain("<!-- cockpit:managed -->");
  });
});

// ─── clean ─────────────────────────────────────────────────────────────────

describe("clean", () => {
  it("removes cockpit-managed .mdc files", async () => {
    await adapter.applySkill(tmpDir, makeSkill());
    const path = join(tmpDir, ".cursor", "rules", "code-review.mdc");
    expect(existsSync(path)).toBe(true);

    await adapter.clean(tmpDir);
    expect(existsSync(path)).toBe(false);
  });

  it("preserves non-cockpit .mdc files", async () => {
    const rulesDir = join(tmpDir, ".cursor", "rules");
    mkdirSync(rulesDir, { recursive: true });
    const manualFile = join(rulesDir, "manual.mdc");
    const { writeFileSync } = await import("node:fs");
    writeFileSync(manualFile, "---\ndescription: manual\n---\n\nNot managed.", "utf-8");

    await adapter.applySkill(tmpDir, makeSkill());
    await adapter.clean(tmpDir);

    expect(existsSync(manualFile)).toBe(true);
  });

  it("removes context file on clean", async () => {
    await adapter.applyContext(tmpDir, makeContext());
    const path = join(tmpDir, ".cursor", "rules", "cockpit-context.mdc");
    expect(existsSync(path)).toBe(true);

    await adapter.clean(tmpDir);
    expect(existsSync(path)).toBe(false);
  });

  it("does nothing when rules dir doesn't exist", async () => {
    await expect(adapter.clean(tmpDir)).resolves.not.toThrow();
  });
});
