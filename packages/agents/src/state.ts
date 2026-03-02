import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { type AgentRun, type AgentStatus } from "@cockpit-ai/core";
import { withFileLock } from "./lock.js";

// ─── State File ──────────────────────────────────────────────────────────────

const STATE_FILE = join(homedir(), ".cockpit", "agent-state.json");

interface AgentState {
  runs: Record<string, AgentRun>;
}

// ─── Raw I/O ─────────────────────────────────────────────────────────────────

function readRaw(): AgentState {
  if (!existsSync(STATE_FILE)) return { runs: {} };
  try {
    return JSON.parse(readFileSync(STATE_FILE, "utf-8")) as AgentState;
  } catch {
    return { runs: {} };
  }
}

function writeRaw(state: AgentState): void {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * AgentRun을 상태 파일에 저장 (파일 락 적용).
 */
export async function saveRun(run: AgentRun): Promise<void> {
  await withFileLock(STATE_FILE, async () => {
    const state = readRaw();
    state.runs[run.runId] = run;
    writeRaw(state);
  });
}

/**
 * runId로 AgentRun 조회.
 */
export function getRun(runId: string): AgentRun | undefined {
  return readRaw().runs[runId];
}

/**
 * 모든 AgentRun 목록 반환.
 */
export function listRuns(): AgentRun[] {
  return Object.values(readRaw().runs);
}

/**
 * runId의 상태와 부가 정보를 업데이트 (파일 락 적용).
 */
export async function updateRunStatus(
  runId: string,
  status: AgentStatus,
  extra: Partial<Omit<AgentRun, "runId" | "agentName" | "startedAt" | "config" | "status">> = {},
): Promise<AgentRun> {
  return await withFileLock(STATE_FILE, async () => {
    const state = readRaw();
    const existing = state.runs[runId];
    if (!existing) {
      throw new Error(`Run '${runId}' not found in state.`);
    }
    const updated: AgentRun = { ...existing, status, ...extra };
    state.runs[runId] = updated;
    writeRaw(state);
    return updated;
  });
}

// ─── Legacy Compat (에이전트 이름 기반 상태 조회) ────────────────────────────

/**
 * 에이전트 이름으로 가장 최근 실행의 상태를 반환.
 * 이전 버전과의 호환성을 위해 유지.
 */
export function getAgentStatus(agentName: string): AgentStatus {
  const runs = listRuns()
    .filter((r) => r.agentName === agentName)
    .sort((a, b) => b.startedAt.localeCompare(a.startedAt));
  return runs[0]?.status ?? "idle";
}

/**
 * @deprecated Phase 1 이후 사용하지 않음. setAgentStatus → saveRun + updateRunStatus 사용.
 */
export function readAgentState(): { agents: Record<string, { status: AgentStatus; startedAt?: string; stoppedAt?: string; pid?: number }> } {
  const runs = listRuns();
  const agents: Record<string, { status: AgentStatus; startedAt?: string; stoppedAt?: string; pid?: number }> = {};
  for (const run of runs) {
    // 에이전트별로 가장 최근 run만 표시
    const existing = agents[run.agentName];
    if (!existing || run.startedAt > (existing as { startedAt?: string }).startedAt!) {
      agents[run.agentName] = {
        status: run.status,
        startedAt: run.startedAt,
        stoppedAt: run.stoppedAt,
        pid: run.pid,
      };
    }
  }
  return { agents };
}

/**
 * @deprecated Phase 1 이후 사용하지 않음.
 */
export function writeAgentState(_state: unknown): void {
  // 하위 호환성 stub — 실제 동작 없음
}

/**
 * @deprecated Phase 1 이후 사용하지 않음. spawn/stop 커맨드가 직접 saveRun을 사용.
 */
export function setAgentStatus(_name: string, _status: AgentStatus): void {
  // 하위 호환성 stub — 실제 동작 없음
}
