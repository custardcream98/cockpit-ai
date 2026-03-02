import { EventEmitter } from "node:events";
import { randomUUID } from "node:crypto";
import type { ResolvedAgent, AgentRun, AgentRunConfig } from "@cockpit-ai/core";
import type { AgentRunner } from "./runner.js";
import { ClaudeRunner } from "./runners/claude.js";
import { saveRun, updateRunStatus } from "./state.js";

// ─── Agent Spawner ───────────────────────────────────────────────────────────

/**
 * AgentSpawner: 에이전트 프로세스 생명주기를 관리하는 오케스트레이터.
 *
 * Events:
 *   "agent:spawned"   — { run: AgentRun }
 *   "agent:message"   — { runId: string; content: string }
 *   "agent:completed" — { run: AgentRun }
 *   "agent:error"     — { run: AgentRun; error: string }
 */
export class AgentSpawner extends EventEmitter {
  // runId → ChildProcess 참조 (kill용)
  private readonly processes = new Map<string, import("node:child_process").ChildProcess>();
  private readonly runners: AgentRunner[] = [new ClaudeRunner()];

  /**
   * 사용 가능한 Runner 선택.
   * agent의 model 필드나 config.model을 기반으로 적합한 runner를 반환.
   */
  private selectRunner(_agent: ResolvedAgent, _config: AgentRunConfig): AgentRunner {
    // 현재는 Claude runner만 지원 — 향후 opencode 등 추가 가능
    const runner = this.runners.find((r) => r.isAvailable());
    if (!runner) {
      throw new Error(
        "No available runner found. Ensure 'claude' CLI is installed and in PATH.",
      );
    }
    return runner;
  }

  /**
   * 에이전트를 비동기로 spawn하고 AgentRun을 반환.
   */
  async spawn(
    agent: ResolvedAgent,
    task: string,
    config: AgentRunConfig = {},
  ): Promise<AgentRun> {
    const runId = randomUUID();
    const now = new Date().toISOString();

    const run: AgentRun = {
      runId,
      agentName: agent.name,
      status: "spawning",
      startedAt: now,
      task,
      config: {
        model: config.model ?? agent.model,
        maxTurns: config.maxTurns,
        permissionMode: config.permissionMode,
        cwd: config.cwd,
        env: config.env,
        allowedTools: config.allowedTools,
      },
    };

    await saveRun(run);

    const runner = this.selectRunner(agent, config);

    const child = runner.spawn(task, {
      model: run.config.model,
      maxTurns: run.config.maxTurns,
      permissionMode: run.config.permissionMode,
      cwd: run.config.cwd,
      env: run.config.env,
      allowedTools: run.config.allowedTools,
    });

    this.processes.set(runId, child);

    // 상태를 running으로 업데이트 후 spawned 이벤트 emit
    const runningRun = await updateRunStatus(runId, "running", { pid: child.pid });
    this.emit("agent:spawned", { run: runningRun });

    // stdout 스트리밍 처리
    child.stdout?.on("data", (chunk: Buffer) => {
      const event = runner.parseOutput(chunk.toString("utf-8"));
      if (event.type === "message" || event.type === "result") {
        this.emit("agent:message", { runId, content: event.content });
      }
    });

    // stderr는 에러 이벤트로 처리
    child.stderr?.on("data", (chunk: Buffer) => {
      const msg = chunk.toString("utf-8").trim();
      if (msg) this.emit("agent:message", { runId, content: `[stderr] ${msg}` });
    });

    // 프로세스 종료 처리
    child.on("close", async (code) => {
      this.processes.delete(runId);
      if (code === 0) {
        const completedRun = await updateRunStatus(runId, "completed", {
          stoppedAt: new Date().toISOString(),
        });
        this.emit("agent:completed", { run: completedRun });
      } else {
        const errorMsg = `Process exited with code ${code}`;
        const errorRun = await updateRunStatus(runId, "error", {
          stoppedAt: new Date().toISOString(),
          error: errorMsg,
        });
        this.emit("agent:error", { run: errorRun, error: errorMsg });
      }
    });

    child.on("error", async (err) => {
      this.processes.delete(runId);
      const errorRun = await updateRunStatus(runId, "error", {
        stoppedAt: new Date().toISOString(),
        error: err.message,
      });
      this.emit("agent:error", { run: errorRun, error: err.message });
    });

    return runningRun;
  }

  /**
   * 실행 중인 에이전트를 중지.
   */
  async stop(runId: string): Promise<void> {
    const child = this.processes.get(runId);
    if (child) {
      child.kill("SIGTERM");
      this.processes.delete(runId);
    }
    await updateRunStatus(runId, "stopped", { stoppedAt: new Date().toISOString() });
  }

  /**
   * 실행 중인 모든 runId 목록 반환.
   */
  getActiveRunIds(): string[] {
    return [...this.processes.keys()];
  }
}
