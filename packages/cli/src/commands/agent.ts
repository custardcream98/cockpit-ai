import { join, resolve } from "node:path";
import { AgentRegistry, AgentSpawner, listRuns, getRun, updateRunStatus } from "@cockpit-ai/agents";
import { findConfigPaths, COCKPIT_DIR } from "@cockpit-ai/core";
import { ui } from "../ui/output.js";
import chalk from "chalk";

// ─── Helpers ─────────────────────────────────────────────────────────────────

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
    case "spawning":
      return chalk.green(status);
    case "completed":
      return chalk.blue(status);
    case "stopped":
      return chalk.dim(status);
    case "error":
      return chalk.red(status);
    default:
      return chalk.cyan(status);
  }
}

// ─── agent list ──────────────────────────────────────────────────────────────

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

  // 각 에이전트의 최근 run 상태 조회
  const allRuns = listRuns();

  ui.heading(`Agents (${agents.length})`);
  for (const agent of agents) {
    const recentRun = allRuns
      .filter((r) => r.agentName === agent.name)
      .sort((a, b) => b.startedAt.localeCompare(a.startedAt))[0];
    const currentStatus = recentRun?.status ?? "idle";

    console.log(
      `  ${chalk.cyan(agent.name)} ${chalk.dim("·")} ${statusColor(currentStatus)}`,
    );
    console.log(`    ${chalk.dim("role:")}  ${agent.role}`);
    console.log(`    ${chalk.dim("model:")} ${agent.model}`);
    if (agent.skills.length > 0) {
      console.log(`    ${chalk.dim("skills:")} ${agent.skills.join(", ")}`);
    }
    if (recentRun) {
      console.log(`    ${chalk.dim("runId:")} ${chalk.dim(recentRun.runId)}`);
    }
  }
  ui.blank();
}

// ─── agent spawn ─────────────────────────────────────────────────────────────

export async function agentSpawnCommand(
  name: string,
  task: string,
  options: {
    model?: string;
    maxTurns?: number;
    worktree?: boolean;
    cleanup?: boolean;
    dryRun?: boolean;
  } = {},
): Promise<void> {
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
    ui.dim("Run 'cockpit agent list' to see available agents.");
    process.exit(1);
  }

  if (options.dryRun) {
    ui.heading("Dry Run — Agent Spawn");
    ui.blank();
    console.log(`  ${chalk.cyan("agent:")}   ${agent.name}`);
    console.log(`  ${chalk.cyan("task:")}    ${task}`);
    console.log(`  ${chalk.cyan("model:")}   ${options.model ?? agent.model}`);
    if (options.maxTurns !== undefined) {
      console.log(`  ${chalk.cyan("maxTurns:")} ${options.maxTurns}`);
    }
    console.log(`  ${chalk.cyan("worktree:")} ${options.worktree ?? agent.worktreeConfig.autoCreate}`);
    ui.blank();
    ui.info("No process will be started (--dry-run).");
    return;
  }

  ui.info(`Spawning agent '${chalk.cyan(name)}'...`);

  // worktree 자동 생성 처리
  let worktreePath: string | undefined;
  if (options.worktree ?? agent.worktreeConfig.autoCreate) {
    const { createWorktreeForAgent } = await import("@cockpit-ai/agents");
    const wtInfo = await createWorktreeForAgent(cwd, agent, task);
    if (wtInfo) {
      worktreePath = wtInfo.path;
      ui.dim(`  Worktree: ${worktreePath}`);
    }
  }

  const spawner = new AgentSpawner();

  // 실시간 출력 스트리밍
  spawner.on("agent:message", ({ content }: { runId: string; content: string }) => {
    process.stdout.write(chalk.dim("│ ") + content + "\n");
  });

  spawner.on("agent:completed", ({ run }: { run: import("@cockpit-ai/core").AgentRun }) => {
    ui.success(`Agent '${name}' completed. (runId: ${run.runId})`);
  });

  spawner.on("agent:error", ({ run, error }: { run: import("@cockpit-ai/core").AgentRun; error: string }) => {
    ui.error(`Agent '${name}' failed: ${error} (runId: ${run.runId})`);
  });

  try {
    const run = await spawner.spawn(agent, task, {
      model: options.model,
      maxTurns: options.maxTurns,
      cwd: worktreePath ?? cwd,
    });

    // worktreePath를 상태 파일에 저장 (agentStatusCommand 표시용)
    if (worktreePath) {
      await updateRunStatus(run.runId, run.status, { worktreePath });
    }

    ui.dim(`  runId: ${run.runId}`);
    ui.dim(`  pid:   ${run.pid ?? "unknown"}`);
    ui.blank();

    // 프로세스가 종료될 때까지 대기
    await new Promise<void>((resolve, reject) => {
      spawner.once("agent:completed", () => resolve());
      spawner.once("agent:error", ({ error }: { error: string }) => reject(new Error(error)));
    });

    // cleanup 옵션: worktree 자동 삭제
    if (options.cleanup && worktreePath) {
      const { cleanupWorktree } = await import("@cockpit-ai/agents");
      await cleanupWorktree(cwd, worktreePath);
      ui.dim(`Cleaned up worktree: ${worktreePath}`);
    }
  } catch (err) {
    ui.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─── agent stop ──────────────────────────────────────────────────────────────

export async function agentStopCommand(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run) {
    ui.error(`Run '${runId}' not found.`);
    ui.dim("Use 'cockpit agent status' to list active runs.");
    process.exit(1);
  }

  if (run.status !== "running" && run.status !== "spawning") {
    ui.warn(`Run '${runId}' is not active (status: ${run.status}).`);
    return;
  }

  // pid로 직접 kill — 다른 프로세스에서 spawn된 경우에도 동작
  // (new AgentSpawner()는 processes Map이 비어 있어 kill 불가)
  if (run.pid) {
    try {
      process.kill(run.pid, "SIGTERM");
    } catch {
      // 이미 종료된 경우 무시
    }
  }

  await updateRunStatus(runId, "stopped", { stoppedAt: new Date().toISOString() });

  ui.success(`Stopped run '${runId}' (agent: ${run.agentName}).`);
}

// ─── agent status ─────────────────────────────────────────────────────────────

export async function agentStatusCommand(): Promise<void> {
  const runs = listRuns().sort((a, b) => b.startedAt.localeCompare(a.startedAt));

  if (runs.length === 0) {
    ui.info("No agent runs recorded.");
    ui.dim("Spawn an agent with 'cockpit agent spawn <name> \"<task>\"'.");
    return;
  }

  ui.heading("Agent Status Dashboard");
  ui.blank();

  for (const run of runs) {
    console.log(`  ${chalk.cyan(run.agentName)} ${chalk.dim("·")} ${statusColor(run.status)}`);
    console.log(`    ${chalk.dim("runId:")}   ${chalk.dim(run.runId)}`);
    if (run.task) {
      const taskPreview = run.task.length > 60 ? run.task.slice(0, 60) + "..." : run.task;
      console.log(`    ${chalk.dim("task:")}    ${taskPreview}`);
    }
    console.log(`    ${chalk.dim("started:")} ${run.startedAt}`);
    if (run.stoppedAt) {
      console.log(`    ${chalk.dim("stopped:")} ${run.stoppedAt}`);
    }
    if (run.pid != null) {
      console.log(`    ${chalk.dim("pid:")}     ${run.pid}`);
    }
    if (run.worktreePath) {
      console.log(`    ${chalk.dim("worktree:")} ${run.worktreePath}`);
    }
    if (run.error) {
      console.log(`    ${chalk.dim("error:")}   ${chalk.red(run.error)}`);
    }
    ui.blank();
  }
}

// ─── agent logs ──────────────────────────────────────────────────────────────

export async function agentLogsCommand(runId: string): Promise<void> {
  const run = getRun(runId);
  if (!run) {
    ui.error(`Run '${runId}' not found.`);
    process.exit(1);
  }

  ui.heading(`Agent Logs — ${run.agentName}`);
  ui.blank();
  console.log(`  ${chalk.dim("runId:")}   ${run.runId}`);
  console.log(`  ${chalk.dim("status:")}  ${statusColor(run.status)}`);
  console.log(`  ${chalk.dim("started:")} ${run.startedAt}`);
  if (run.task) console.log(`  ${chalk.dim("task:")}    ${run.task}`);
  if (run.result) {
    ui.blank();
    console.log(chalk.bold("Result:"));
    console.log(run.result);
  }
  if (run.error) {
    ui.blank();
    console.log(chalk.bold("Error:"));
    console.log(chalk.red(run.error));
  }
  ui.blank();
}
