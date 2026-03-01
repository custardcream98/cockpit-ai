import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  type CockpitAdapter,
  type ResolvedSkill,
  type ResolvedContext,
  type ResolvedAgent,
} from "@cockpit/core";

// ─── Constants ─────────────────────────────────────────────────────────────

const CLAUDE_DIR = ".claude";
const COMMANDS_DIR = "commands";
const AGENTS_DIR = "agents";
const CLAUDE_MD = "CLAUDE.md";
const COCKPIT_MARKER = "<!-- cockpit:managed -->";

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

/**
 * Build the content for a .claude/commands/<name>.md file.
 * Claude Code slash commands use a specific markdown format.
 */
function buildCommandMarkdown(skill: ResolvedSkill): string {
  const lines: string[] = [];

  if (skill.description) {
    lines.push(`# ${skill.description}`);
  } else {
    lines.push(`# ${skill.name}`);
  }

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
    for (const rule of context.global) {
      lines.push(`- ${rule.content}`);
    }
  }

  if (context.project.length > 0) {
    lines.push("\n## Project Rules");
    lines.push("");
    for (const rule of context.project) {
      lines.push(`- ${rule.content}`);
    }
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
    const commandsDir = join(projectPath, CLAUDE_DIR, COMMANDS_DIR);
    mkdirSync(commandsDir, { recursive: true });

    const fileName = `${sanitizeName(skill.name)}.md`;
    const filePath = join(commandsDir, fileName);
    const content = buildCommandMarkdown(skill);

    writeFileSync(filePath, content, "utf-8");
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
    // Remove cockpit-managed command files
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

    // Remove agents dir if cockpit-managed
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
