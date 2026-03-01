import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  type CockpitAdapter,
  type ResolvedSkill,
  type ResolvedContext,
  type ResolvedAgent,
} from "@cockpit-ai/core";

// ─── Constants ─────────────────────────────────────────────────────────────

const CLAUDE_DIR = ".claude";
const SKILLS_DIR = "skills";    // 새 방식: .claude/skills/<name>/SKILL.md
const COMMANDS_DIR = "commands"; // 구 방식: .claude/commands/<name>.md (clean 시 마이그레이션 정리)
const AGENTS_DIR = "agents";
const CLAUDE_MD = "CLAUDE.md";
const COCKPIT_MARKER = "<!-- cockpit:managed -->";

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

/**
 * Build the content for a .claude/skills/<name>/SKILL.md file.
 * 최신 Claude Code 컨벤션: YAML frontmatter + 프롬프트 본문.
 */
function buildSkillMarkdown(skill: ResolvedSkill): string {
  const lines: string[] = [];

  // YAML frontmatter (Claude Code SKILL.md 형식)
  lines.push("---");
  lines.push(`name: ${sanitizeName(skill.name)}`);
  lines.push(`description: ${skill.description ?? skill.name}`);
  lines.push("---");
  lines.push("");

  lines.push(skill.prompt.trim());

  if (skill.tools.length > 0) {
    lines.push("");
    lines.push("---");
    lines.push(`*Tools: ${skill.tools.join(", ")}*`);
  }

  lines.push("");
  lines.push(COCKPIT_MARKER);

  return lines.join("\n");
}

/**
 * Build or update CLAUDE.md with context rules.
 * Preserves existing hand-written content above the cockpit section.
 */
function buildClaudeMd(existing: string | null, context: ResolvedContext): string {
  const cockpitSection = buildCockpitContextSection(context);

  if (!existing) {
    return cockpitSection;
  }

  // Strip existing cockpit-managed section and append fresh one
  const markerIndex = existing.indexOf(COCKPIT_MARKER);
  const base = markerIndex >= 0 ? existing.slice(0, markerIndex).trimEnd() : existing.trimEnd();

  return base ? `${base}\n\n${cockpitSection}` : cockpitSection;
}

/**
 * Extract a display label from a rule's source path.
 * Returns the path relative to `.cockpit/context/` for file-based rules,
 * or null for inline/builtin rules.
 */
function contextFileLabel(source: string | undefined): string | null {
  if (!source || source === "cockpit" || source === "cockpit-builtin") return null;
  const marker = ".cockpit/context/";
  const idx = source.indexOf(marker);
  return idx !== -1 ? source.slice(idx + marker.length) : null;
}

function renderRule(lines: string[], rule: { content: string; source?: string }): void {
  const label = contextFileLabel(rule.source);
  if (label) lines.push(`<!-- ${label} -->`);

  if (rule.content.includes("\n")) {
    lines.push(rule.content);
    lines.push("");
  } else {
    lines.push(`- ${rule.content}`);
  }
}

function buildCockpitContextSection(context: ResolvedContext): string {
  const lines: string[] = [COCKPIT_MARKER];

  const allRules = [...context.global, ...context.project];
  if (allRules.length === 0) {
    lines.push("\n<!-- No context rules defined -->");
    return lines.join("\n");
  }

  if (context.global.length > 0) {
    lines.push("\n## Global Rules");
    lines.push("");
    for (const rule of context.global) renderRule(lines, rule);
  }

  if (context.project.length > 0) {
    lines.push("\n## Project Rules");
    lines.push("");
    for (const rule of context.project) renderRule(lines, rule);
  }

  return lines.join("\n");
}

// ─── Claude Code Adapter ───────────────────────────────────────────────────

export class ClaudeCodeAdapter implements CockpitAdapter {
  readonly name = "claude-code";

  async detect(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, CLAUDE_DIR));
  }

  async applySkill(projectPath: string, skill: ResolvedSkill): Promise<void> {
    // 최신 방식: .claude/skills/<name>/SKILL.md (디렉토리 기반)
    const skillDir = join(projectPath, CLAUDE_DIR, SKILLS_DIR, sanitizeName(skill.name));
    mkdirSync(skillDir, { recursive: true });

    writeFileSync(join(skillDir, "SKILL.md"), buildSkillMarkdown(skill), "utf-8");
  }

  async applyContext(projectPath: string, context: ResolvedContext): Promise<void> {
    const claudeMdPath = join(projectPath, CLAUDE_MD);

    const existing = existsSync(claudeMdPath)
      ? readFileSync(claudeMdPath, "utf-8")
      : null;

    const content = buildClaudeMd(existing, context);
    writeFileSync(claudeMdPath, content, "utf-8");
  }

  async applyAgent(projectPath: string, agent: ResolvedAgent): Promise<void> {
    // Claude Code doesn't have a native agent config format yet.
    // Write a structured markdown file to .claude/agents/ as a reference.
    const agentsDir = join(projectPath, CLAUDE_DIR, AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });

    const fileName = `${sanitizeName(agent.name)}.md`;
    const filePath = join(agentsDir, fileName);

    const lines = [
      `# Agent: ${agent.name}`,
      "",
      `**Role**: ${agent.role}`,
      `**Model**: ${agent.model}`,
      "",
    ];

    if (agent.contextRules.length > 0) {
      lines.push("## Rules");
      for (const rule of agent.contextRules) {
        lines.push(`- ${rule}`);
      }
      lines.push("");
    }

    if (agent.skills.length > 0) {
      lines.push("## Skills");
      for (const skill of agent.skills) {
        lines.push(`- ${skill}`);
      }
      lines.push("");
    }

    lines.push(COCKPIT_MARKER);

    writeFileSync(filePath, lines.join("\n"), "utf-8");
  }

  async clean(projectPath: string): Promise<void> {
    // 새 방식(.claude/skills/): cockpit 관리 스킬 디렉토리 삭제
    const skillsDir = join(projectPath, CLAUDE_DIR, SKILLS_DIR);
    if (existsSync(skillsDir)) {
      for (const dirName of readdirSync(skillsDir)) {
        const skillDir = join(skillsDir, dirName);
        const skillMdPath = join(skillDir, "SKILL.md");
        if (!existsSync(skillMdPath)) continue;
        const content = readFileSync(skillMdPath, "utf-8");
        if (content.includes(COCKPIT_MARKER)) {
          rmSync(skillDir, { recursive: true, force: true });
        }
      }
    }

    // 이전 방식(.claude/commands/) 마이그레이션 정리
    const commandsDir = join(projectPath, CLAUDE_DIR, COMMANDS_DIR);
    if (existsSync(commandsDir)) {
      for (const file of readdirSync(commandsDir)) {
        if (!file.endsWith(".md")) continue;
        const filePath = join(commandsDir, file);
        const content = readFileSync(filePath, "utf-8");
        if (content.includes(COCKPIT_MARKER)) {
          rmSync(filePath);
        }
      }
    }

    // Strip cockpit section from CLAUDE.md
    const claudeMdPath = join(projectPath, CLAUDE_MD);
    if (existsSync(claudeMdPath)) {
      const content = readFileSync(claudeMdPath, "utf-8");
      const markerIndex = content.indexOf(COCKPIT_MARKER);
      if (markerIndex >= 0) {
        const cleaned = content.slice(0, markerIndex).trimEnd();
        if (cleaned) {
          writeFileSync(claudeMdPath, cleaned + "\n", "utf-8");
        } else {
          rmSync(claudeMdPath);
        }
      }
    }

    // agents 디렉토리에서 cockpit 관리 파일 삭제
    const agentsDir = join(projectPath, CLAUDE_DIR, AGENTS_DIR);
    if (existsSync(agentsDir)) {
      for (const file of readdirSync(agentsDir)) {
        if (!file.endsWith(".md")) continue;
        const filePath = join(agentsDir, file);
        const content = readFileSync(filePath, "utf-8");
        if (content.includes(COCKPIT_MARKER)) {
          rmSync(filePath);
        }
      }
    }
  }
}
