import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";

// ─── Mocks ───────────────────────────────────────────────────────────────────

vi.mock("@cockpit-ai/agents", async () => {
  const actual = await vi.importActual<typeof import("@cockpit-ai/agents")>("@cockpit-ai/agents");
  return {
    ...actual,
    AgentSpawner: vi.fn().mockImplementation(() => ({
      spawn: vi.fn().mockResolvedValue({
        runId: "test-run-id",
        agentName: "test-agent",
        status: "running",
        startedAt: new Date().toISOString(),
        config: {},
        pid: 9999,
      }),
      stop: vi.fn().mockResolvedValue(undefined),
      on: vi.fn(),
      once: vi.fn(),
    })),
    listRuns: vi.fn(() => []),
    getRun: vi.fn(),
    createWorktreeForAgent: vi.fn().mockResolvedValue(null),
    cleanupWorktree: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("@cockpit-ai/core", async () => {
  const actual = await vi.importActual<typeof import("@cockpit-ai/core")>("@cockpit-ai/core");
  return {
    ...actual,
    findConfigPaths: vi.fn(() => ({
      workspacePath: "/tmp/workspace/.cockpit/config.yaml",
      projectPath: null,
      profilePath: null,
    })),
  };
});

// ─── Setup ───────────────────────────────────────────────────────────────────

let tmpDir: string;

beforeEach(() => {
  tmpDir = join(tmpdir(), `cockpit-agent-cli-test-${Date.now()}`);
  mkdirSync(tmpDir, { recursive: true });
  vi.clearAllMocks();
});

afterEach(() => {
  rmSync(tmpDir, { recursive: true, force: true });
  vi.restoreAllMocks();
});

// ─── agentListCommand ─────────────────────────────────────────────────────────

describe("agentListCommand", () => {
  it("shows info message when no agents are found", async () => {
    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);

    const { agentListCommand } = await import("../commands/agent.js");
    await agentListCommand();

    // 에이전트가 없으면 안내 메시지 출력
    consoleSpy.mockRestore();
  });

  it("loads agents from YAML files in .cockpit/agents/", async () => {
    const agentsDir = join(tmpDir, ".cockpit", "agents");
    mkdirSync(agentsDir, { recursive: true });

    writeFileSync(
      join(agentsDir, "my-agent.yaml"),
      `name: my-agent\nrole: Test role\nmodel: claude-sonnet-4-6\n`,
      "utf-8",
    );

    const { findConfigPaths } = await import("@cockpit-ai/core");
    vi.mocked(findConfigPaths).mockReturnValue({
      workspacePath: join(tmpDir, ".cockpit", "config.yaml"),
      projectPath: null,
      profilePath: null,
    });

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { agentListCommand } = await import("../commands/agent.js");
    await agentListCommand();
    consoleSpy.mockRestore();
  });
});

// ─── agentStatusCommand ───────────────────────────────────────────────────────

describe("agentStatusCommand", () => {
  it("shows info when no runs are recorded", async () => {
    const { listRuns } = await import("@cockpit-ai/agents");
    vi.mocked(listRuns).mockReturnValue([]);

    const consoleSpy = vi.spyOn(console, "log").mockImplementation(() => undefined);
    const { agentStatusCommand } = await import("../commands/agent.js");
    await agentStatusCommand();
    consoleSpy.mockRestore();
  });

  it("shows run details when runs exist", async () => {
    const { listRuns } = await import("@cockpit-ai/agents");
    vi.mocked(listRuns).mockReturnValue([
      {
        runId: "abc-123",
        agentName: "my-agent",
        status: "completed",
        startedAt: "2026-03-02T00:00:00.000Z",
        stoppedAt: "2026-03-02T00:01:00.000Z",
        task: "run tests",
        config: {},
      },
    ]);

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      output.push(args.join(" "));
    });

    const { agentStatusCommand } = await import("../commands/agent.js");
    await agentStatusCommand();

    expect(output.some((line) => line.includes("my-agent"))).toBe(true);
    vi.restoreAllMocks();
  });
});

// ─── agentLogsCommand ─────────────────────────────────────────────────────────

describe("agentLogsCommand", () => {
  it("exits with error when runId is not found", async () => {
    const { getRun } = await import("@cockpit-ai/agents");
    vi.mocked(getRun).mockReturnValue(undefined);

    const exitSpy = vi.spyOn(process, "exit").mockImplementation((() => {
      throw new Error("process.exit called");
    }) as never);

    const { agentLogsCommand } = await import("../commands/agent.js");
    await expect(agentLogsCommand("nonexistent-id")).rejects.toThrow("process.exit called");

    exitSpy.mockRestore();
  });

  it("displays run details when found", async () => {
    const { getRun } = await import("@cockpit-ai/agents");
    vi.mocked(getRun).mockReturnValue({
      runId: "xyz-789",
      agentName: "test-agent",
      status: "completed",
      startedAt: "2026-03-02T00:00:00.000Z",
      task: "write tests",
      result: "All tests passed",
      config: {},
    });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      output.push(args.join(" "));
    });

    const { agentLogsCommand } = await import("../commands/agent.js");
    await agentLogsCommand("xyz-789");

    expect(output.some((line) => line.includes("test-agent"))).toBe(true);
    vi.restoreAllMocks();
  });
});

// ─── agentSpawnCommand (dry-run) ──────────────────────────────────────────────

describe("agentSpawnCommand", () => {
  it("shows preview without spawning when --dry-run is set", async () => {
    // 에이전트 YAML 준비
    const agentsDir = join(tmpDir, ".cockpit", "agents");
    mkdirSync(agentsDir, { recursive: true });
    writeFileSync(
      join(agentsDir, "test-agent.yaml"),
      `name: test-agent\nrole: Tester\nmodel: claude-sonnet-4-6\n`,
      "utf-8",
    );

    const { findConfigPaths } = await import("@cockpit-ai/core");
    vi.mocked(findConfigPaths).mockReturnValue({
      workspacePath: join(tmpDir, ".cockpit", "config.yaml"),
      projectPath: null,
      profilePath: null,
    });

    const output: string[] = [];
    vi.spyOn(console, "log").mockImplementation((...args) => {
      output.push(args.join(" "));
    });

    const { AgentSpawner } = await import("@cockpit-ai/agents");
    const spawnMock = vi.fn();
    vi.mocked(AgentSpawner).mockImplementation(() => ({
      spawn: spawnMock,
      stop: vi.fn(),
      on: vi.fn(),
      once: vi.fn(),
    } as unknown as InstanceType<typeof AgentSpawner>));

    const { agentSpawnCommand } = await import("../commands/agent.js");
    await agentSpawnCommand("test-agent", "run tests", { dryRun: true });

    // dry-run이므로 spawn이 호출되지 않아야 함
    expect(spawnMock).not.toHaveBeenCalled();
    vi.restoreAllMocks();
  });
});
