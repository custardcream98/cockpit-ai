import type { ChildProcess } from "node:child_process";

// ─── Run Event ──────────────────────────────────────────────────────────────

export interface RunEvent {
  type: "message" | "error" | "progress" | "result";
  content: string;
  timestamp: string;
}

// ─── Run Config ─────────────────────────────────────────────────────────────

export interface RunConfig {
  model?: string;
  maxTurns?: number;
  permissionMode?: "default" | "acceptEdits" | "bypassPermissions";
  cwd?: string;
  env?: Record<string, string>;
  allowedTools?: string[];
}

// ─── Runner Interface ───────────────────────────────────────────────────────

/**
 * AI 도구 독립적 Runner 인터페이스.
 * 각 AI 도구(claude, opencode, aider 등)는 이 인터페이스를 구현한다.
 */
export interface AgentRunner {
  /** 식별자: "claude" | "opencode" | "aider" 등 */
  readonly name: string;
  /** 프로세스 생성 및 반환 */
  spawn(task: string, config: RunConfig): ChildProcess;
  /** CLI 설치 여부 확인 */
  isAvailable(): boolean;
  /** stdout/stderr 데이터를 RunEvent로 파싱 */
  parseOutput(data: string): RunEvent;
}
