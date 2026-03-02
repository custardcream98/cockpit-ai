import { spawn, execFileSync } from "node:child_process";
import type { ChildProcess } from "node:child_process";
import type { AgentRunner, RunConfig, RunEvent } from "../runner.js";

// ─── Claude Code Runner ──────────────────────────────────────────────────────

/**
 * Claude Code CLI를 subprocess로 실행하는 Runner.
 * `claude -p <task> --output-format stream-json` 방식으로 동작.
 */
export class ClaudeRunner implements AgentRunner {
  readonly name = "claude";

  isAvailable(): boolean {
    try {
      execFileSync("claude", ["--version"], { stdio: "pipe" });
      return true;
    } catch {
      return false;
    }
  }

  spawn(task: string, config: RunConfig): ChildProcess {
    const args = ["--print", task, "--output-format", "stream-json"];

    if (config.model) args.push("--model", config.model);
    if (config.maxTurns !== undefined) args.push("--max-turns", String(config.maxTurns));
    if (config.permissionMode) args.push("--permission-mode", config.permissionMode);
    if (config.allowedTools && config.allowedTools.length > 0) {
      args.push("--allowedTools", config.allowedTools.join(","));
    }

    return spawn("claude", args, {
      cwd: config.cwd ?? process.cwd(),
      env: { ...process.env, ...config.env },
      stdio: ["ignore", "pipe", "pipe"],
    });
  }

  parseOutput(data: string): RunEvent {
    const timestamp = new Date().toISOString();

    for (const line of data.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      try {
        const parsed = JSON.parse(trimmed) as Record<string, unknown>;

        // assistant 메시지에서 텍스트 추출
        if (parsed["type"] === "assistant" && parsed["message"]) {
          const msg = parsed["message"] as Record<string, unknown>;
          const content = msg["content"] as Array<Record<string, unknown>> | undefined;
          const text = content
            ?.filter((c) => c["type"] === "text")
            .map((c) => c["text"] as string)
            .join("") ?? "";
          if (text) return { type: "message", content: text, timestamp };
        }

        // 완료 결과
        if (parsed["type"] === "result") {
          const resultText = (parsed["result"] as string | undefined) ?? "";
          return { type: "result", content: resultText, timestamp };
        }

        return { type: "progress", content: trimmed, timestamp };
      } catch {
        // JSON이 아닌 경우 plain text로 처리
        return { type: "message", content: trimmed, timestamp };
      }
    }

    return { type: "progress", content: data.trim(), timestamp };
  }
}
