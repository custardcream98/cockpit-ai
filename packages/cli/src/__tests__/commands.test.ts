import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { mkdirSync, rmSync, existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { COCKPIT_DIR, CONFIG_FILE } from "@cockpit/core";

// ─── Helpers ───────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-cli-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── init command tests ────────────────────────────────────────────────────

describe("initCommand", () => {
  it("creates .cockpit/config.yaml in the target directory", async () => {
    // Simulate non-interactive by mocking readline
    vi.mock("node:readline", () => ({
      createInterface: () => ({
        question: (_: string, cb: (ans: string) => void) => {
          cb("test-workspace");
        },
        close: vi.fn(),
      }),
    }));

    const { initCommand } = await import("../commands/init.js");
    await initCommand(tmpDir, {});

    const configPath = join(tmpDir, COCKPIT_DIR, CONFIG_FILE);
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("cockpit:");
    expect(content).toContain("workspace:");
  });

  it("creates project config when --project flag is set", async () => {
    vi.mock("node:readline", () => ({
      createInterface: () => ({
        question: (_: string, cb: (ans: string) => void) => {
          cb("my-project");
        },
        close: vi.fn(),
      }),
    }));

    const { initCommand } = await import("../commands/init.js");
    await initCommand(tmpDir, { project: true });

    const configPath = join(tmpDir, COCKPIT_DIR, CONFIG_FILE);
    expect(existsSync(configPath)).toBe(true);

    const content = readFileSync(configPath, "utf-8");
    expect(content).toContain("project:");
    expect(content).not.toContain("workspace:");
  });

  it("does not overwrite existing config", async () => {
    const cockpitDir = join(tmpDir, COCKPIT_DIR);
    mkdirSync(cockpitDir, { recursive: true });
    const configPath = join(cockpitDir, CONFIG_FILE);
    const originalContent = "cockpit: '1.0'\nworkspace:\n  name: original\n";
    require("node:fs").writeFileSync(configPath, originalContent, "utf-8");

    vi.mock("node:readline", () => ({
      createInterface: () => ({
        question: (_: string, cb: (ans: string) => void) => cb("new-name"),
        close: vi.fn(),
      }),
    }));

    const { initCommand } = await import("../commands/init.js");
    await initCommand(tmpDir, {});

    const content = readFileSync(configPath, "utf-8");
    expect(content).toBe(originalContent);
  });
});

// ─── statusCommand tests ───────────────────────────────────────────────────

describe("statusCommand", () => {
  function createConfig(dir: string, content: string): void {
    const cockpitDir = join(dir, COCKPIT_DIR);
    mkdirSync(cockpitDir, { recursive: true });
    require("node:fs").writeFileSync(join(cockpitDir, CONFIG_FILE), content, "utf-8");
  }

  it("prints warning when no config is found", async () => {
    const consoleSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { statusCommand } = await import("../commands/status.js");
    await statusCommand(tmpDir);
    expect(consoleSpy).toHaveBeenCalled();
  });

  it("prints workspace info when config exists", async () => {
    createConfig(
      tmpDir,
      "cockpit: '1.0'\nworkspace:\n  name: my-ws\nadapters:\n  - claude-code\n"
    );

    const logSpy = vi.spyOn(console, "log").mockImplementation(() => {});
    const { statusCommand } = await import("../commands/status.js");
    await statusCommand(tmpDir);

    const output = logSpy.mock.calls.flat().join("\n");
    expect(output).toContain("my-ws");
  });
});

// ─── applyCommand tests ────────────────────────────────────────────────────

describe("applyCommand", () => {
  it("exits with error when no config found", async () => {
    const exitSpy = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    const { applyCommand } = await import("../commands/apply.js");

    await expect(applyCommand({})).rejects.toThrow("process.exit called");
    exitSpy.mockRestore();
    cwdSpy.mockRestore();
  });

  it("shows skeleton message when config exists", async () => {
    const cockpitDir = join(tmpDir, COCKPIT_DIR);
    mkdirSync(cockpitDir, { recursive: true });
    require("node:fs").writeFileSync(
      join(cockpitDir, CONFIG_FILE),
      "cockpit: '1.0'\nworkspace:\n  name: test\nadapters:\n  - claude-code\n",
      "utf-8"
    );

    const cwdSpy = vi.spyOn(process, "cwd").mockReturnValue(tmpDir);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const { applyCommand } = await import("../commands/apply.js");
    await applyCommand({});

    const output = warnSpy.mock.calls.flat().join("\n");
    expect(output.toLowerCase()).toContain("not yet implemented");

    cwdSpy.mockRestore();
  });
});
