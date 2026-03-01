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
  });
});
