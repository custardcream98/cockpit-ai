import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { EventEmitter } from "node:events";
import type { ChildProcess } from "node:child_process";
import type { ResolvedAgent, AgentRun } from "@cockpit-ai/core";
import { ClaudeRunner } from "../runners/claude.js";

// ─── Mocks ───────────────────────────────────────────────────────────────────

// 실제 state 모듈처럼 run을 저장하고 updateRunStatus 시 기존 필드를 보존하는 stateful mock
const mockRunStore = new Map<string, AgentRun>();

vi.mock("../state.js", () => ({
  saveRun: vi.fn(async (run: AgentRun) => {
    mockRunStore.set(run.runId, run);
  }),
  updateRunStatus: vi.fn(async (runId: string, status: string, extra: Partial<AgentRun> = {}) => {
    const existing = mockRunStore.get(runId) ?? {
      runId,
      agentName: "test-agent",
      startedAt: new Date().toISOString(),
      config: {},
    };
    const updated = { ...existing, status, ...extra } as AgentRun;
    mockRunStore.set(runId, updated);
    return updated;
  }),
  getRun: vi.fn((runId: string) => mockRunStore.get(runId)),
  listRuns: vi.fn(() => [...mockRunStore.values()]),
}));

vi.mock("../runners/claude.js", () => ({
  ClaudeRunner: vi.fn().mockImplementation(() => ({
    name: "claude",
    isAvailable: vi.fn(() => true),
    spawn: vi.fn(),
    parseOutput: vi.fn((data: string) => ({
      type: "message",
      content: data.trim(),
      timestamp: new Date().toISOString(),
    })),
  })),
}));

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeChildProcess(exitCode: number | null = 0): ChildProcess {
  const emitter = new EventEmitter() as ChildProcess;
  // stdout/stderr mock
  const stdoutEmitter = new EventEmitter() as NodeJS.ReadableStream;
  const stderrEmitter = new EventEmitter() as NodeJS.ReadableStream;
  (emitter as unknown as Record<string, unknown>).stdout = stdoutEmitter;
  (emitter as unknown as Record<string, unknown>).stderr = stderrEmitter;
  (emitter as unknown as Record<string, unknown>).pid = 12345;
  (emitter as unknown as Record<string, unknown>).kill = vi.fn(() => {
    emitter.emit("close", null);
    return true;
  });
  // 다음 tick에 자동 종료
  setTimeout(() => emitter.emit("close", exitCode), 10);
  return emitter;
}

function makeAgent(overrides: Partial<ResolvedAgent> = {}): ResolvedAgent {
  return {
    name: "test-agent",
    role: "Test runner",
    model: "claude-sonnet-4-6",
    skills: [],
    contextIncludes: [],
    contextRules: [],
    worktreeConfig: { autoCreate: false, branchPrefix: undefined },
    sourcePath: "/tmp/test-agent.yaml",
    status: "idle",
    ...overrides,
  };
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe("AgentSpawner", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunStore.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("spawns an agent and returns AgentRun with running status", async () => {
    const { AgentSpawner } = await import("../spawner.js");
    const { ClaudeRunner } = await import("../runners/claude.js");

    const mockChild = makeChildProcess(0);
    vi.mocked(ClaudeRunner).mockImplementation(() => ({
      name: "claude" as const,
      isAvailable: vi.fn(() => true),
      spawn: vi.fn(() => mockChild),
      parseOutput: vi.fn((data: string) => ({
        type: "message" as const,
        content: data.trim(),
        timestamp: new Date().toISOString(),
      })),
    }));

    const spawner = new AgentSpawner();
    const agent = makeAgent();

    const run = await spawner.spawn(agent, "run tests");

    expect(run.status).toBe("running");
    expect(run.agentName).toBe("test-agent");
    expect(run.task).toBe("run tests");
  });

  it("emits agent:spawned event when spawn starts", async () => {
    const { AgentSpawner } = await import("../spawner.js");
    const { ClaudeRunner } = await import("../runners/claude.js");

    const mockChild = makeChildProcess(0);
    vi.mocked(ClaudeRunner).mockImplementation(() => ({
      name: "claude" as const,
      isAvailable: vi.fn(() => true),
      spawn: vi.fn(() => mockChild),
      parseOutput: vi.fn((data: string) => ({
        type: "message" as const,
        content: data.trim(),
        timestamp: new Date().toISOString(),
      })),
    }));

    const spawner = new AgentSpawner();
    const spawned: unknown[] = [];
    spawner.on("agent:spawned", (e) => spawned.push(e));

    await spawner.spawn(makeAgent(), "test task");

    expect(spawned.length).toBeGreaterThan(0);
  });

  it("emits agent:completed when process exits with code 0", async () => {
    const { AgentSpawner } = await import("../spawner.js");
    const { ClaudeRunner } = await import("../runners/claude.js");

    const mockChild = makeChildProcess(0);
    vi.mocked(ClaudeRunner).mockImplementation(() => ({
      name: "claude" as const,
      isAvailable: vi.fn(() => true),
      spawn: vi.fn(() => mockChild),
      parseOutput: vi.fn((data: string) => ({
        type: "message" as const,
        content: data.trim(),
        timestamp: new Date().toISOString(),
      })),
    }));

    const spawner = new AgentSpawner();
    const completed: unknown[] = [];
    spawner.on("agent:completed", (e) => completed.push(e));

    await spawner.spawn(makeAgent(), "test task");

    // 프로세스가 종료될 때까지 대기
    await new Promise((r) => setTimeout(r, 50));

    expect(completed.length).toBeGreaterThan(0);
  });

  it("emits agent:error when process exits with non-zero code", async () => {
    const { AgentSpawner } = await import("../spawner.js");
    const { ClaudeRunner } = await import("../runners/claude.js");

    const mockChild = makeChildProcess(1);
    vi.mocked(ClaudeRunner).mockImplementation(() => ({
      name: "claude" as const,
      isAvailable: vi.fn(() => true),
      spawn: vi.fn(() => mockChild),
      parseOutput: vi.fn((data: string) => ({
        type: "message" as const,
        content: data.trim(),
        timestamp: new Date().toISOString(),
      })),
    }));

    const spawner = new AgentSpawner();
    const errors: unknown[] = [];
    spawner.on("agent:error", (e) => errors.push(e));

    await spawner.spawn(makeAgent(), "test task");
    await new Promise((r) => setTimeout(r, 50));

    expect(errors.length).toBeGreaterThan(0);
  });

  it("throws when no runner is available", async () => {
    const { AgentSpawner } = await import("../spawner.js");
    const { ClaudeRunner } = await import("../runners/claude.js");

    vi.mocked(ClaudeRunner).mockImplementation(() => ({
      name: "claude" as const,
      isAvailable: vi.fn(() => false),
      spawn: vi.fn(),
      parseOutput: vi.fn(),
    }));

    const spawner = new AgentSpawner();
    await expect(
      spawner.spawn(makeAgent(), "test task"),
    ).rejects.toThrow("No available runner found");
  });

  it("stop() kills the process and updates status", async () => {
    const { AgentSpawner } = await import("../spawner.js");
    const { updateRunStatus } = await import("../state.js");
    const { ClaudeRunner } = await import("../runners/claude.js");

    const killFn = vi.fn(() => true);
    const mockChild = new EventEmitter() as ChildProcess;
    (mockChild as unknown as Record<string, unknown>).pid = 99;
    (mockChild as unknown as Record<string, unknown>).kill = killFn;
    (mockChild as unknown as Record<string, unknown>).stdout = new EventEmitter();
    (mockChild as unknown as Record<string, unknown>).stderr = new EventEmitter();
    // 자동 종료 없음 — stop()으로만 종료

    vi.mocked(ClaudeRunner).mockImplementation(() => ({
      name: "claude" as const,
      isAvailable: vi.fn(() => true),
      spawn: vi.fn(() => mockChild),
      parseOutput: vi.fn((data: string) => ({
        type: "message" as const,
        content: data.trim(),
        timestamp: new Date().toISOString(),
      })),
    }));

    const spawner = new AgentSpawner();
    const run = await spawner.spawn(makeAgent(), "long task");

    await spawner.stop(run.runId);

    expect(vi.mocked(updateRunStatus)).toHaveBeenCalledWith(
      run.runId,
      "stopped",
      expect.objectContaining({ stoppedAt: expect.any(String) as string }),
    );
  });
});
