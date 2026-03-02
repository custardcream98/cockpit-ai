import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import {
  type CockpitAdapter,
  type ResolvedSkill,
  type ResolvedContext,
  type ResolvedAgent,
} from "@cockpit-ai/core";

// ─── Constants ──────────────────────────────────────────────────────────────

const AGENTS_MD = "AGENTS.md";
const COCKPIT_MARKER = "<!-- cockpit:managed -->";

// ─── AgentsMdAdapter ────────────────────────────────────────────────────────

/**
 * AGENTS.md를 직접 관리하는 어댑터.
 * AGENTS.md는 Linux Foundation의 표준으로 부상 중이며
 * Claude Code, OpenCode 등 다수 AI 도구가 지원.
 */
export class AgentsMdAdapter implements CockpitAdapter {
  readonly name = "agents-md";

  async detect(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, AGENTS_MD));
  }

  async applySkill(_projectPath: string, _skill: ResolvedSkill): Promise<void> {
    // AGENTS.md는 skill 적용을 직접 지원하지 않음
    // 필요 시 다른 어댑터(ClaudeCodeAdapter 등)와 함께 사용
  }

  async applyContext(projectPath: string, context: ResolvedContext): Promise<void> {
    const agentsMdPath = join(projectPath, AGENTS_MD);
    const section = buildAgentsMdSection(context);

    const existing = existsSync(agentsMdPath)
      ? readFileSync(agentsMdPath, "utf-8")
      : null;

    let finalContent: string;

    if (!existing) {
      finalContent = section;
    } else {
      // cockpit 관리 섹션을 교체하고 기존 내용 보존
      const markerIndex = existing.indexOf(COCKPIT_MARKER);
      const base =
        markerIndex >= 0
          ? existing.slice(0, markerIndex).trimEnd()
          : existing.trimEnd();

      finalContent = base ? `${base}\n\n${section}` : section;
    }

    writeFileSync(agentsMdPath, finalContent, "utf-8");
  }

  async applyAgent(projectPath: string, agent: ResolvedAgent): Promise<void> {
    // AGENTS.md에 에이전트 섹션 추가
    const agentsMdPath = join(projectPath, AGENTS_MD);
    const existing = existsSync(agentsMdPath)
      ? readFileSync(agentsMdPath, "utf-8")
      : "";

    const agentSection = [
      `\n## Agent: ${agent.name}`,
      ``,
      `**Role:** ${agent.role}`,
      `**Model:** ${agent.model}`,
    ];

    if (agent.contextRules.length > 0) {
      agentSection.push("", "### Rules", "");
      for (const rule of agent.contextRules) {
        agentSection.push(`- ${rule}`);
      }
    }

    // 이미 이 에이전트가 정의되어 있으면 건너뜀
    const agentHeader = `## Agent: ${agent.name}`;
    if (existing.includes(agentHeader)) return;

    writeFileSync(agentsMdPath, existing.trimEnd() + "\n" + agentSection.join("\n") + "\n", "utf-8");
  }

  async clean(projectPath: string): Promise<void> {
    const agentsMdPath = join(projectPath, AGENTS_MD);
    if (!existsSync(agentsMdPath)) return;

    const content = readFileSync(agentsMdPath, "utf-8");
    const markerIndex = content.indexOf(COCKPIT_MARKER);

    if (markerIndex >= 0) {
      // cockpit 관리 섹션만 제거
      const cleaned = content.slice(0, markerIndex).trimEnd();
      if (cleaned) {
        writeFileSync(agentsMdPath, cleaned + "\n", "utf-8");
      } else {
        // 남은 내용이 없으면 파일 삭제하지 않고 빈 파일 유지
        writeFileSync(agentsMdPath, "", "utf-8");
      }
    }
  }
}

// ─── Helpers ────────────────────────────────────────────────────────────────

function buildAgentsMdSection(context: ResolvedContext): string {
  const lines: string[] = [
    COCKPIT_MARKER,
    "",
    "## Cockpit Context",
    "",
  ];

  if (context.global.length > 0) {
    lines.push("### Global Rules", "");
    for (const rule of context.global) {
      lines.push(`- ${rule.content}`);
    }
    lines.push("");
  }

  if (context.project.length > 0) {
    lines.push("### Project Rules", "");
    for (const rule of context.project) {
      lines.push(`- ${rule.content}`);
    }
    lines.push("");
  }

  return lines.join("\n");
}
