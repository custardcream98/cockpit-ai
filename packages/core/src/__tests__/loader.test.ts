import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { writeFileSync, mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { loadConfig, tryLoadConfig, ConfigLoadError, ConfigValidationError } from "../config/loader.js";
import { WorkspaceConfigSchema } from "../types/config.js";

// ─── Helpers ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
});

function writeTmp(name: string, content: string): string {
  const path = join(tmpDir, name);
  writeFileSync(path, content, "utf-8");
  return path;
}

// ─── Tests ─────────────────────────────────────────────────────────────────

describe("loadConfig", () => {
  it("loads and validates a valid workspace config", () => {
    const path = writeTmp("config.yaml", `
cockpit: "1.0"
workspace:
  name: my-workspace
adapters:
  - claude-code
  - cursor
context:
  global:
    - "Use TypeScript strict mode"
`);

    const config = loadConfig(path, WorkspaceConfigSchema);
    expect(config.workspace?.name).toBe("my-workspace");
    expect(config.adapters).toEqual(["claude-code", "cursor"]);
    expect(config.context?.global).toContain("Use TypeScript strict mode");
  });

  it("normalizes cockpit version as string", () => {
    const path = writeTmp("config.yaml", "cockpit: 1.0\nworkspace:\n  name: test\n");
    const config = loadConfig(path, WorkspaceConfigSchema);
    expect(typeof config.cockpit).toBe("string");
    expect(config.cockpit).toBe("1");
  });

  it("throws ConfigLoadError when file does not exist", () => {
    expect(() =>
      loadConfig(join(tmpDir, "nonexistent.yaml"), WorkspaceConfigSchema)
    ).toThrow(ConfigLoadError);
  });

  it("throws ConfigLoadError on invalid YAML", () => {
    const path = writeTmp("bad.yaml", "{ invalid: yaml: content:");
    expect(() => loadConfig(path, WorkspaceConfigSchema)).toThrow(ConfigLoadError);
  });

  it("throws ConfigValidationError on schema mismatch", () => {
    const path = writeTmp("config.yaml", `
cockpit: "1.0"
adapters:
  - unknown-adapter
`);
    expect(() => loadConfig(path, WorkspaceConfigSchema)).toThrow(ConfigValidationError);
  });
});

describe("tryLoadConfig", () => {
  it("returns null for missing file", () => {
    const result = tryLoadConfig(join(tmpDir, "missing.yaml"), WorkspaceConfigSchema);
    expect(result).toBeNull();
  });

  it("still throws ConfigValidationError for invalid schema", () => {
    const path = writeTmp("config.yaml", "cockpit: '1.0'\nadapters:\n  - bad-adapter\n");
    expect(() => tryLoadConfig(path, WorkspaceConfigSchema)).toThrow(ConfigValidationError);
  });

  it("returns parsed config on success", () => {
    const path = writeTmp("config.yaml", "cockpit: '1.0'\nworkspace:\n  name: test\n");
    const result = tryLoadConfig(path, WorkspaceConfigSchema);
    expect(result).not.toBeNull();
    expect(result?.workspace?.name).toBe("test");
  });
});
