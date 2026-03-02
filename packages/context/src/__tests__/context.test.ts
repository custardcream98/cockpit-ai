import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { parse as parseYaml } from "yaml";
import { ContextManager } from "../manager.js";

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-ctx-test-${Date.now()}`);
  mkdirSync(join(tmpDir, ".cockpit"), { recursive: true });
  writeFileSync(
    join(tmpDir, ".cockpit", "config.yaml"),
    "cockpit: '1.0'\nworkspace:\n  name: test\n",
    "utf-8"
  );
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

// ─── ContextManager tests ──────────────────────────────────────────────────

describe("ContextManager", () => {
  describe("addRule", () => {
    it("adds a global rule to the config file", () => {
      const manager = new ContextManager(tmpDir);
      manager.addRule("Always use TypeScript", "global");

      const raw = readFileSync(join(tmpDir, ".cockpit", "config.yaml"), "utf-8");
      const config = parseYaml(raw) as Record<string, unknown>;
      const ctx = config["context"] as Record<string, unknown>;

      expect(ctx).toBeDefined();
      expect(ctx["global"]).toEqual(["Always use TypeScript"]);
    });

    it("adds a project-scoped rule to the config file", () => {
      const manager = new ContextManager(tmpDir);
      manager.addRule("Follow project conventions", "project");

      const raw = readFileSync(join(tmpDir, ".cockpit", "config.yaml"), "utf-8");
      const config = parseYaml(raw) as Record<string, unknown>;
      const ctx = config["context"] as Record<string, unknown>;

      expect(ctx).toBeDefined();
      expect(ctx["project"]).toEqual(["Follow project conventions"]);
    });

    it("appends multiple rules without removing existing ones", () => {
      const manager = new ContextManager(tmpDir);
      manager.addRule("Rule one", "global");
      manager.addRule("Rule two", "global");

      const raw = readFileSync(join(tmpDir, ".cockpit", "config.yaml"), "utf-8");
      const config = parseYaml(raw) as Record<string, unknown>;
      const ctx = config["context"] as Record<string, unknown>;

      expect(ctx["global"]).toEqual(["Rule one", "Rule two"]);
    });

    it("throws when no config file exists", () => {
      const emptyDir = join(tmpdir(), `cockpit-empty-${Date.now()}`);
      mkdirSync(emptyDir, { recursive: true });

      try {
        const manager = new ContextManager(emptyDir);
        expect(() => manager.addRule("test", "global")).toThrow(
          "No config found. Run 'cockpit init' first."
        );
      } finally {
        rmSync(emptyDir, { recursive: true, force: true });
      }
    });
  });

  describe("getResolved", () => {
    it("returns merged context from config files", () => {
      writeFileSync(
        join(tmpDir, ".cockpit", "config.yaml"),
        [
          "cockpit: '1.0'",
          "workspace:",
          "  name: test",
          "context:",
          "  global:",
          "    - Use strict mode",
          "  project:",
          "    - Follow project rules",
        ].join("\n"),
        "utf-8"
      );

      const manager = new ContextManager(tmpDir);
      const resolved = manager.getResolved();

      // Check specific rules are present (profile rules may also be present)
      const globalRule = resolved.global.find((r) => r.content === "Use strict mode");
      expect(globalRule).toBeDefined();
      expect(globalRule!.scope).toBe("global");

      const projectRule = resolved.project.find((r) => r.content === "Follow project rules");
      expect(projectRule).toBeDefined();
      expect(projectRule!.scope).toBe("project");
    });

    it("returns no project-scoped context when no rules defined", () => {
      const manager = new ContextManager(tmpDir);
      const resolved = manager.getResolved();

      // project-scoped rules should be empty (profile only has global rules)
      expect(resolved.project).toHaveLength(0);
    });

    it("merges file-based context from .cockpit/context/ into resolved context (always global)", () => {
      // .cockpit/context/ 디렉토리에 파일 생성
      mkdirSync(join(tmpDir, ".cockpit", "context"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".cockpit", "context", "conventions.md"),
        "Use strict TypeScript.",
        "utf-8"
      );
      writeFileSync(
        join(tmpDir, ".cockpit", "context", "style.md"),
        // frontmatter scope: project가 있어도 위치가 global을 결정
        "---\nscope: project\n---\nFollow project style guide.",
        "utf-8"
      );

      const manager = new ContextManager(tmpDir);
      const resolved = manager.getResolved();

      // .cockpit/context/ 안의 모든 파일은 global
      const fileConventions = resolved.global.find((r) => r.content === "Use strict TypeScript.");
      expect(fileConventions).toBeDefined();
      expect(fileConventions!.scope).toBe("global");

      const fileStyle = resolved.global.find((r) => r.content === "Follow project style guide.");
      expect(fileStyle).toBeDefined();
      expect(fileStyle!.scope).toBe("global");
    });

    it("프로젝트별 컨텍스트 파일을 project scope로 포함", () => {
      // tmpDir/.cockpit/projects/myproject/context/ 에 파일 생성
      mkdirSync(join(tmpDir, ".cockpit", "projects", "myproject", "context"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".cockpit", "projects", "myproject", "context", "arch.md"),
        "My project architecture.",
        "utf-8"
      );

      // cwd를 tmpDir/myproject 로 설정해서 projectName = "myproject"가 도출되도록
      const projectCwd = join(tmpDir, "myproject");
      mkdirSync(projectCwd, { recursive: true });
      const manager = new ContextManager(projectCwd);
      const resolved = manager.getResolved();

      const projectRule = resolved.project.find((r) => r.content === "My project architecture.");
      expect(projectRule).toBeDefined();
      expect(projectRule!.scope).toBe("project");
    });

    it("다른 프로젝트 파일은 포함하지 않음", () => {
      mkdirSync(join(tmpDir, ".cockpit", "projects", "myproject", "context"), { recursive: true });
      mkdirSync(join(tmpDir, ".cockpit", "projects", "other", "context"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".cockpit", "projects", "myproject", "context", "rules.md"),
        "My project rules.",
        "utf-8"
      );
      writeFileSync(
        join(tmpDir, ".cockpit", "projects", "other", "context", "rules.md"),
        "Other project rules.",
        "utf-8"
      );

      const projectCwd = join(tmpDir, "myproject");
      mkdirSync(projectCwd, { recursive: true });
      const manager = new ContextManager(projectCwd);
      const resolved = manager.getResolved();

      const myRule = resolved.project.find((r) => r.content === "My project rules.");
      expect(myRule).toBeDefined();

      const otherRule = resolved.project.find((r) => r.content === "Other project rules.");
      expect(otherRule).toBeUndefined();
    });

    it(".cockpit/projects/ 없을 때 기존 동작 유지", () => {
      const manager = new ContextManager(tmpDir);
      const resolved = manager.getResolved();
      // project-scoped rules should be empty
      expect(resolved.project).toHaveLength(0);
    });
  });

  describe("removeRule", () => {
    it("removes an existing rule by exact content match", () => {
      const manager = new ContextManager(tmpDir);
      manager.addRule("Rule to remove", "global");
      manager.addRule("Rule to keep", "global");

      const removed = manager.removeRule("Rule to remove");
      expect(removed).toBe(true);

      const raw = readFileSync(join(tmpDir, ".cockpit", "config.yaml"), "utf-8");
      const config = parseYaml(raw) as Record<string, unknown>;
      const ctx = config["context"] as Record<string, unknown>;

      expect(ctx["global"]).toEqual(["Rule to keep"]);
    });

    it("returns false when rule does not exist", () => {
      const manager = new ContextManager(tmpDir);
      const removed = manager.removeRule("Non-existent rule");
      expect(removed).toBe(false);
    });

    it("removes a project-scoped rule", () => {
      const manager = new ContextManager(tmpDir);
      manager.addRule("Project rule", "project");

      const removed = manager.removeRule("Project rule");
      expect(removed).toBe(true);

      const raw = readFileSync(join(tmpDir, ".cockpit", "config.yaml"), "utf-8");
      const config = parseYaml(raw) as Record<string, unknown>;
      const ctx = config["context"] as Record<string, unknown>;

      expect((ctx["project"] as string[]).length).toBe(0);
    });
  });

  describe("listAll", () => {
    it("returns all rules with source info", () => {
      writeFileSync(
        join(tmpDir, ".cockpit", "config.yaml"),
        [
          "cockpit: '1.0'",
          "workspace:",
          "  name: test",
          "context:",
          "  global:",
          "    - Global rule",
          "  project:",
          "    - Project rule",
        ].join("\n"),
        "utf-8"
      );

      const manager = new ContextManager(tmpDir);
      const all = manager.listAll();

      // Filter to only rules from this tmpDir config (profile rules may also appear)
      const localRules = all.filter((e) => e.configFile.startsWith(tmpDir));
      expect(localRules).toHaveLength(2);

      const globalEntry = localRules.find((e) => e.rule.scope === "global");
      expect(globalEntry).toBeDefined();
      expect(globalEntry!.rule.content).toBe("Global rule");
      expect(globalEntry!.configFile).toContain("config.yaml");

      const projectEntry = localRules.find((e) => e.rule.scope === "project");
      expect(projectEntry).toBeDefined();
      expect(projectEntry!.rule.content).toBe("Project rule");
    });

    it("returns no rules from local config when none defined", () => {
      const manager = new ContextManager(tmpDir);
      const all = manager.listAll();
      // Only check rules from the local tmpDir config (profile rules may appear too)
      const localRules = all.filter((e) => e.configFile.startsWith(tmpDir));
      expect(localRules).toHaveLength(0);
    });

    it("파일 기반 컨텍스트 룰을 listAll 결과에 포함한다 (.cockpit/context/ → 항상 global)", () => {
      // .cockpit/context/ 디렉토리에 파일 생성
      mkdirSync(join(tmpDir, ".cockpit", "context"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".cockpit", "context", "global-rules.md"),
        "Always use TypeScript.",
        "utf-8"
      );
      writeFileSync(
        join(tmpDir, ".cockpit", "context", "style-rules.md"),
        // frontmatter scope: project가 있어도 위치가 global을 결정
        "---\nscope: project\n---\nFollow style guide.",
        "utf-8"
      );

      const manager = new ContextManager(tmpDir);
      const all = manager.listAll();

      // .cockpit/context/ 파일은 모두 global
      const globalFileRule = all.find((e) => e.rule.content === "Always use TypeScript.");
      expect(globalFileRule).toBeDefined();
      expect(globalFileRule!.rule.scope).toBe("global");
      expect(globalFileRule!.configFile).toContain("global-rules.md");

      const styleRule = all.find((e) => e.rule.content === "Follow style guide.");
      expect(styleRule).toBeDefined();
      expect(styleRule!.rule.scope).toBe("global");
      expect(styleRule!.configFile).toContain("style-rules.md");
    });

    it("프로젝트별 컨텍스트 파일을 listAll 결과에 포함한다", () => {
      mkdirSync(join(tmpDir, ".cockpit", "projects", "myproject", "context"), { recursive: true });
      writeFileSync(
        join(tmpDir, ".cockpit", "projects", "myproject", "context", "arch.md"),
        "My project arch.",
        "utf-8"
      );

      const projectCwd = join(tmpDir, "myproject");
      mkdirSync(projectCwd, { recursive: true });
      const manager = new ContextManager(projectCwd);
      const all = manager.listAll();

      const projectRule = all.find((e) => e.rule.content === "My project arch.");
      expect(projectRule).toBeDefined();
      expect(projectRule!.rule.scope).toBe("project");
      expect(projectRule!.configFile).toContain("arch.md");
    });
  });
});
