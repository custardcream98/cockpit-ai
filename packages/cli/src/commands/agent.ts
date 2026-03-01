import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { AgentRegistry, setAgentStatus, getAgentStatus, readAgentState } from "@cockpit/agents";
import { findConfigPaths, COCKPIT_DIR } from "@cockpit/core";
import { ui } from "../ui/output.js";
import chalk from "chalk";

// ─── Helpers ────────────────────────────────────────────────────────────────

function collectAgentDirs(cwd: string): string[] {
  const paths = findConfigPaths(cwd);
  const dirs: string[] = [];

  if (paths.workspacePath) {
    dirs.push(join(resolve(join(paths.workspacePath, "..", "..")), COCKPIT_DIR, "agents"));
  }
  if (paths.projectPath) {
    dirs.push(join(resolve(join(paths.projectPath, "..", "..")), COCKPIT_DIR, "agents"));
  }

  return dirs;
}

function statusColor(status: string): string {
  switch (status) {
    case "running":
      return chalk.green(status);
    case "stopped":
      return chalk.dim(status);
    case "error":
      return chalk.red(status);
    default:
      return chalk.cyan(status);
  }
}

// ─── agent list ─────────────────────────────────────────────────────────────

export async function agentListCommand(): Promise<void> {
  const cwd = process.cwd();
  const agentDirs = collectAgentDirs(cwd);

  if (agentDirs.length === 0) {
    ui.warn("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    return;
  }

  const registry = new AgentRegistry();
  const errors = registry.loadFromDirs(agentDirs);

  for (const { file, error } of errors) {
    ui.warn(`Skipped ${file}: ${error instanceof Error ? error.message : String(error)}`);
  }

  const agents = registry.list();

  if (agents.length === 0) {
    ui.info("No agents found.");
    ui.dim("Add agent YAML files to a .cockpit/agents/ directory.");
    return;
  }

  ui.heading(`Agents (${agents.length})`);
  for (const agent of agents) {
    const currentStatus = getAgentStatus(agent.name);
    console.log(
      `  ${chalk.cyan(agent.name)} ${chalk.dim("·")} ${statusColor(currentStatus)}`
    );
    console.log(`    ${chalk.dim("role:")}  ${agent.role}`);
    console.log(`    ${chalk.dim("model:")} ${agent.model}`);
    if (agent.skills.length > 0) {
      console.log(`    ${chalk.dim("skills:")} ${agent.skills.join(", ")}`);
    }
  }
  ui.blank();
}

// ─── agent spawn ─────────────────────────────────────────────────────────────

export async function agentSpawnCommand(name: string): Promise<void> {
  const cwd = process.cwd();
  const agentDirs = collectAgentDirs(cwd);

  if (agentDirs.length === 0) {
    ui.error("No Cockpit configuration found.");
    ui.info("Run 'cockpit init' to initialize a workspace.");
    process.exit(1);
  }

  const registry = new AgentRegistry();
  registry.loadFromDirs(agentDirs);

  const agent = registry.get(name);
  if (!agent) {
    ui.error(`Agent '${name}' not found.`);
    ui.dim(`Run 'cockpit agent list' to see available agents.`);
    process.exit(1);
  }

  // Track agent intent as "running" in state file.
  setAgentStatus(name, "running");

  // Write Claude Code agent context file if .claude/ directory exists.
  const claudeDir = join(cwd, ".claude");
  if (existsSync(claudeDir)) {
    const agentsDir = join(claudeDir, "agents");
    mkdirSync(agentsDir, { recursive: true });

    const contextLines: string[] = [
      `# Agent: ${agent.name}`,
      ``,
      `**Role:** ${agent.role}`,
      `**Model:** ${agent.model}`,
    ];

    if (agent.skills.length > 0) {
      contextLines.push(``, `## Skills`, ``);
      for (const skill of agent.skills) {
        contextLines.push(`- ${skill}`);
      }
    }

    if (agent.contextRules.length > 0) {
      contextLines.push(``, `## Context Rules`, ``);
      for (const rule of agent.contextRules) {
        contextLines.push(`- ${rule}`);
      }
    }

    if (agent.contextIncludes.length > 0) {
      contextLines.push(``, `## Context Includes`, ``);
      for (const include of agent.contextIncludes) {
        contextLines.push(`- ${include}`);
      }
    }

    const contextPath = join(agentsDir, `${name}.md`);
    writeFileSync(contextPath, contextLines.join("\n") + "\n", "utf-8");
    ui.dim(`Wrote context to ${contextPath}`);
  }

  ui.success(`Agent '${name}' spawned.`);
  ui.dim(`Run 'cockpit agent stop ${name}' to mark it as stopped.`);
}

// ─── agent stop ──────────────────────────────────────────────────────────────

export async function agentStopCommand(name: string): Promise<void> {
  setAgentStatus(name, "stopped");
  ui.success(`Agent '${name}' stopped.`);
}

// ─── agent status ─────────────────────────────────────────────────────────────

export async function agentStatusCommand(): Promise<void> {
  const state = readAgentState();
  const entries = Object.entries(state.agents);

  if (entries.length === 0) {
    ui.info("No agent state recorded.");
    ui.dim("Spawn an agent with 'cockpit agent spawn <name>'.");
    return;
  }

  ui.heading("Agent Status Dashboard");
  for (const [agentName, entry] of entries) {
    console.log(`  ${chalk.cyan(agentName)}`);
    console.log(`    ${chalk.dim("status:")}    ${statusColor(entry.status)}`);
    if (entry.startedAt) {
      console.log(`    ${chalk.dim("started:")}   ${entry.startedAt}`);
    }
    if (entry.stoppedAt) {
      console.log(`    ${chalk.dim("stopped:")}   ${entry.stoppedAt}`);
    }
    if (entry.pid != null) {
      console.log(`    ${chalk.dim("pid:")}       ${entry.pid}`);
    }
    ui.blank();
  }
}
