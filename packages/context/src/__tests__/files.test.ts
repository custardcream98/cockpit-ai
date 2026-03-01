import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  loadContextFile,
  discoverContextFiles,
  autoDiscoverContextFiles,
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

  it("parses frontmatter scope: project", () => {
    const filePath = join(tmpDir, ".cockpit", "context", "project.md");
    writeFileSync(
      filePath,
      "---\nscope: project\n---\nFollow project conventions.",
      "utf-8"
    );

    const entry = loadContextFile(filePath);
    expect(entry.scope).toBe("project");
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

  it("correctly parses scope from discovered files", () => {
    writeFileSync(
      join(tmpDir, ".cockpit", "context", "global.md"),
      "Global rule",
      "utf-8"
    );
    writeFileSync(
      join(tmpDir, ".cockpit", "context", "proj.md"),
      "---\nscope: project\n---\nProject rule",
      "utf-8"
    );

    const entries = autoDiscoverContextFiles(tmpDir);
    expect(entries).toHaveLength(2);

    const globalEntry = entries.find((e) => e.scope === "global");
    const projectEntry = entries.find((e) => e.scope === "project");

    expect(globalEntry?.content).toBe("Global rule");
    expect(projectEntry?.content).toBe("Project rule");
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
});
