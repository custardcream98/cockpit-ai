import { readFileSync, writeFileSync, mkdirSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { homedir } from "node:os";
import { type AgentStatus } from "@cockpit-ai/core";

// ─── Agent State ────────────────────────────────────────────────────────────

const STATE_FILE = join(homedir(), ".cockpit", "agent-state.json");

interface AgentStateEntry {
  status: AgentStatus;
  startedAt?: string;
  stoppedAt?: string;
  pid?: number;
}

interface AgentState {
  agents: Record<string, AgentStateEntry>;
}

/**
 * Read the agent state from disk.
 * Returns an empty state if the file does not exist.
 */
export function readAgentState(): AgentState {
  if (!existsSync(STATE_FILE)) {
    return { agents: {} };
  }

  try {
    const raw = readFileSync(STATE_FILE, "utf-8");
    return JSON.parse(raw) as AgentState;
  } catch {
    return { agents: {} };
  }
}

/**
 * Write the agent state to disk.
 * Creates the ~/.cockpit directory if it does not exist.
 */
export function writeAgentState(state: AgentState): void {
  const dir = dirname(STATE_FILE);
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true });
  }
  writeFileSync(STATE_FILE, JSON.stringify(state, null, 2), "utf-8");
}

/**
 * Set the status for a named agent, updating timestamps as appropriate.
 */
export function setAgentStatus(name: string, status: AgentStatus): void {
  const state = readAgentState();
  const existing = state.agents[name] ?? { status: "idle" };

  const updated: AgentStateEntry = { ...existing, status };

  if (status === "running") {
    updated.startedAt = new Date().toISOString();
    delete updated.stoppedAt;
  } else if (status === "stopped" || status === "error") {
    updated.stoppedAt = new Date().toISOString();
  }

  state.agents[name] = updated;
  writeAgentState(state);
}

/**
 * Get the current status for a named agent.
 * Returns "idle" if no state has been recorded.
 */
export function getAgentStatus(name: string): AgentStatus {
  const state = readAgentState();
  return state.agents[name]?.status ?? "idle";
}
