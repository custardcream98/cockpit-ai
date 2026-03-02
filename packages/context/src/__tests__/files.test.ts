import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadContextFile,
  discoverContextFiles,
  autoDiscoverContextFiles,
  discoverProjectContextFiles,
} from "../files.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-files-test-${Date.now()}`);
  mkdirSync(join(tmpDir, ".cockpit", "context"), { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── loadContextFile ──────────────────────────────────────────────────────

describe("loadContextFile", () => {
  it("loads a file without frontmatter as global scope", () => {
    const filePath = join(tmpDir, ".cockpit", "context", "rules.md");
    writeFileSync(filePath, "Use strict TypeScript.", "utf-8");

    const entry = loadContextFile(filePath);
    expect(entry.scope).toBe("global");
    expect(entry.content).toBe("Use strict TypeScript.");
    expect(entry.path).toBe(filePath);
  });

  it("frontmatter scope 필드를 무시하고 항상 global scope 반환", () => {
    const filePath = join(tmpDir, ".cockpit", "context", "project.md");
    writeFileSync(
      filePath,
      "---\nscope: project\n---\nFollow project conventions.",
      "utf-8"
    );

    const entry = loadContextFile(filePath);
    // 위치(디렉토리)가 scope를 결정하므로 frontmatter의 scope: project는 무시됨
    expect(entry.scope).toBe("global");
    expect(entry.content).toBe("Follow project conventions.");
  });

  it("defaults to global when scope is not specified in frontmatter", () => {
    const filePath = join(tmpDir, ".cockpit", "context", "global.md");
    writeFileSync(filePath, "---\ntitle: My Rules\n---\nGlobal rule here.", "utf-8");

    const entry = loadContextFile(filePath);
    expect(entry.scope).toBe("global");
    expect(entry.content).toBe("Global rule here.");
  });

  it("strips frontmatter from content", () => {
    const filePath = join(tmpDir, ".cockpit", "context", "strip.md");
    writeFileSync(
      filePath,
      "---\nscope: global\n---\n# Heading\n\nContent here.",
      "utf-8"
    );

    const entry = loadContextFile(filePath);
    expect(entry.content).toBe("# Heading\n\nContent here.");
  });
});

// ─── autoDiscoverContextFiles ─────────────────────────────────────────────

describe("autoDiscoverContextFiles", () => {
  it("returns empty array when .cockpit/context does not exist", () => {
    const emptyDir = join(tmpdir(), `cockpit-empty-${Date.now()}`);
    mkdirSync(emptyDir, { recursive: true });

    try {
      const entries = autoDiscoverContextFiles(emptyDir);
      expect(entries).toEqual([]);
    } finally {
      rmSync(emptyDir, { recursive: true, force: true });
    }
  });

  it("discovers all .md files in .cockpit/context/", () => {
    writeFileSync(join(tmpDir, ".cockpit", "context", "a.md"), "Rule A", "utf-8");
    writeFileSync(join(tmpDir, ".cockpit", "context", "b.md"), "Rule B", "utf-8");

    const entries = autoDiscoverContextFiles(tmpDir);
    expect(entries).toHaveLength(2);

    const contents = entries.map((e) => e.content).sort();
    expect(contents).toEqual(["Rule A", "Rule B"]);
  });

  it("ignores non-.md files", () => {
    writeFileSync(join(tmpDir, ".cockpit", "context", "rules.md"), "A rule", "utf-8");
    writeFileSync(join(tmpDir, ".cockpit", "context", "notes.txt"), "ignored", "utf-8");

    const entries = autoDiscoverContextFiles(tmpDir);
    expect(entries).toHaveLength(1);
    expect(entries[0]!.content).toBe("A rule");
  });

  it("discovers .md files in subdirectories", () => {
    // 서브디렉토리 내 파일도 재귀적으로 탐색해야 함
    mkdirSync(join(tmpDir, ".cockpit", "context", "testing"), { recursive: true });
    writeFileSync(join(tmpDir, ".cockpit", "context", "root.md"), "Root rule", "utf-8");
    writeFileSync(join(tmpDir, ".cockpit", "context", "testing", "vitest.md"), "Test rule", "utf-8");

    const entries = autoDiscoverContextFiles(tmpDir);
    expect(entries).toHaveLength(2);

    const contents = entries.map((e) => e.content).sort();
    expect(contents).toEqual(["Root rule", "Test rule"]);
  });

  it("위치가 scope를 결정: frontmatter scope 무시하고 항상 global 반환", () => {
    writeFileSync(
      join(tmpDir, ".cockpit", "context", "global.md"),
      "Global rule",
      "utf-8"
    );
    writeFileSync(
      join(tmpDir, ".cockpit", "context", "proj.md"),
      // frontmatter에 scope: project가 있어도 .cockpit/context/ 위치이면 global 강제
      "---\nscope: project\n---\nProject rule",
      "utf-8"
    );

    const entries = autoDiscoverContextFiles(tmpDir);
    expect(entries).toHaveLength(2);

    // 위치가 scope를 결정하므로 모든 파일이 global
    expect(entries.every((e) => e.scope === "global")).toBe(true);
    const contents = entries.map((e) => e.content).sort();
    expect(contents).toEqual(["Global rule", "Project rule"]);
  });
});

// ─── discoverProjectContextFiles ──────────────────────────────────────────

describe("discoverProjectContextFiles", () => {
  it("프로젝트 context 디렉토리가 없으면 빈 배열 반환", () => {
    const entries = discoverProjectContextFiles(tmpDir, "nonexistent");
    expect(entries).toEqual([]);
  });

  it(".md 파일을 탐색하고 scope: project 강제", () => {
    mkdirSync(join(tmpDir, ".cockpit", "projects", "workspace", "context"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".cockpit", "projects", "workspace", "context", "arch.md"),
      "Project architecture rules",
      "utf-8"
    );

    const entries = discoverProjectContextFiles(tmpDir, "workspace");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.content).toBe("Project architecture rules");
    expect(entries[0]!.scope).toBe("project");
  });

  it("frontmatter scope를 무시하고 항상 project scope 반환", () => {
    mkdirSync(join(tmpDir, ".cockpit", "projects", "myapp", "context"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".cockpit", "projects", "myapp", "context", "rules.md"),
      // frontmatter에 scope: global이 있어도 위치가 project를 결정
      "---\nscope: global\n---\nForced project rule",
      "utf-8"
    );

    const entries = discoverProjectContextFiles(tmpDir, "myapp");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.scope).toBe("project");
    expect(entries[0]!.content).toBe("Forced project rule");
  });

  it("서브디렉토리도 재귀적으로 탐색", () => {
    mkdirSync(join(tmpDir, ".cockpit", "projects", "workspace", "context", "backend"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".cockpit", "projects", "workspace", "context", "conventions.md"),
      "Top-level convention",
      "utf-8"
    );
    writeFileSync(
      join(tmpDir, ".cockpit", "projects", "workspace", "context", "backend", "api.md"),
      "Backend API rules",
      "utf-8"
    );

    const entries = discoverProjectContextFiles(tmpDir, "workspace");
    expect(entries).toHaveLength(2);
    expect(entries.every((e) => e.scope === "project")).toBe(true);

    const contents = entries.map((e) => e.content).sort();
    expect(contents).toEqual(["Backend API rules", "Top-level convention"]);
  });

  it("다른 프로젝트 파일은 포함하지 않음", () => {
    mkdirSync(join(tmpDir, ".cockpit", "projects", "workspace", "context"), { recursive: true });
    mkdirSync(join(tmpDir, ".cockpit", "projects", "blog", "context"), { recursive: true });
    writeFileSync(
      join(tmpDir, ".cockpit", "projects", "workspace", "context", "ws.md"),
      "Workspace rule",
      "utf-8"
    );
    writeFileSync(
      join(tmpDir, ".cockpit", "projects", "blog", "context", "blog.md"),
      "Blog rule",
      "utf-8"
    );

    const entries = discoverProjectContextFiles(tmpDir, "workspace");
    expect(entries).toHaveLength(1);
    expect(entries[0]!.content).toBe("Workspace rule");
  });
});

// ─── discoverContextFiles ─────────────────────────────────────────────────

describe("discoverContextFiles", () => {
  it("discovers files matching a glob pattern", () => {
    writeFileSync(join(tmpDir, ".cockpit", "context", "conventions.md"), "Convention", "utf-8");

    const entries = discoverContextFiles(tmpDir, [".cockpit/context/*.md"]);
    expect(entries.length).toBeGreaterThanOrEqual(1);

    const match = entries.find((e) => e.content === "Convention");
    expect(match).toBeDefined();
  });

  it("uses default pattern when none provided", () => {
    writeFileSync(join(tmpDir, ".cockpit", "context", "rules.md"), "Default rule", "utf-8");

    // Calling with empty patterns falls back to default
    const entries = discoverContextFiles(tmpDir, []);
    // Should find the file via default .cockpit/context/*.md
    const match = entries.find((e) => e.content === "Default rule");
    expect(match).toBeDefined();
  });

  it("returns empty array when no files match", () => {
    const entries = discoverContextFiles(tmpDir, [".cockpit/context/nonexistent/*.md"]);
    expect(entries).toEqual([]);
  });

  it("discovers files in subdirectories with **/*.md pattern", () => {
    // **/*.md 패턴이 서브디렉토리 파일도 매칭해야 함
    mkdirSync(join(tmpDir, ".cockpit", "context", "frontend"), { recursive: true });
    writeFileSync(join(tmpDir, ".cockpit", "context", "conventions.md"), "Convention", "utf-8");
    writeFileSync(join(tmpDir, ".cockpit", "context", "frontend", "react.md"), "React rule", "utf-8");

    const entries = discoverContextFiles(tmpDir, [".cockpit/context/**/*.md"]);
    expect(entries.length).toBeGreaterThanOrEqual(2);

    const contents = entries.map((e) => e.content).sort();
    expect(contents).toContain("Convention");
    expect(contents).toContain("React rule");
  });
});
