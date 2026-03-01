import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  type CockpitAdapter,
  type ResolvedSkill,
  type ResolvedContext,
  type ResolvedAgent,
} from "@cockpit/core";

// ─── Constants ─────────────────────────────────────────────────────────────

const OPENCODE_DIR = ".opencode";
const SKILLS_DIR = "skills";
const AGENTS_DIR = "agents";
const AGENTS_MD = "AGENTS.md";
const OPENCODE_JSON = "opencode.json";
const COCKPIT_MARKER = "<!-- cockpit:managed -->";
const COCKPIT_SECTION_START = "<!-- cockpit:section:start -->";
const COCKPIT_SECTION_END = "<!-- cockpit:section:end -->";

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

function buildSkillMarkdown(skill: ResolvedSkill): string {
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

function buildCockpitSection(context: ResolvedContext): string {
  const lines = [COCKPIT_SECTION_START, ""];

  const allRules = [...context.global, ...context.project];

  if (context.global.length > 0) {
    lines.push("## Global Rules");
    lines.push("");
    for (const rule of context.global) {
      lines.push(`- ${rule.content}`);
    }
  }

  if (context.project.length > 0) {
    if (context.global.length > 0) lines.push("");
    lines.push("## Project Rules");
    lines.push("");
    for (const rule of context.project) {
      lines.push(`- ${rule.content}`);
    }
  }

  if (allRules.length === 0) {
    lines.push("<!-- No context rules defined -->");
  }

  lines.push("");
  lines.push(COCKPIT_SECTION_END);

  return lines.join("\n");
}

function updateAgentsMd(existing: string | null, context: ResolvedContext): string {
  const cockpitSection = buildCockpitSection(context);

  if (!existing) {
    return cockpitSection + "\n";
  }

  const startIdx = existing.indexOf(COCKPIT_SECTION_START);
  const endIdx = existing.indexOf(COCKPIT_SECTION_END);

  if (startIdx >= 0 && endIdx >= 0) {
    const before = existing.slice(0, startIdx).trimEnd();
    const after = existing.slice(endIdx + COCKPIT_SECTION_END.length).trimStart();
    const parts = [before, cockpitSection, after].filter(Boolean);
    return parts.join("\n\n") + "\n";
  }

  // No existing cockpit section — append
  return existing.trimEnd() + "\n\n" + cockpitSection + "\n";
}

// ─── OpenCode Adapter ───────────────────────────────────────────────────────

export class OpenCodeAdapter implements CockpitAdapter {
  readonly name = "opencode";

  async detect(projectPath: string): Promise<boolean> {
    return (
      existsSync(join(projectPath, OPENCODE_DIR)) ||
      existsSync(join(projectPath, OPENCODE_JSON))
    );
  }

  async applySkill(projectPath: string, skill: ResolvedSkill): Promise<void> {
    const skillsDir = join(projectPath, OPENCODE_DIR, SKILLS_DIR);
    mkdirSync(skillsDir, { recursive: true });

    const fileName = `${sanitizeName(skill.name)}.md`;
    const content = buildSkillMarkdown(skill);
    writeFileSync(join(skillsDir, fileName), content, "utf-8");
  }

  async applyContext(projectPath: string, context: ResolvedContext): Promise<void> {
    const agentsMdPath = join(projectPath, AGENTS_MD);

    const existing = existsSync(agentsMdPath)
      ? readFileSync(agentsMdPath, "utf-8")
      : null;

    const content = updateAgentsMd(existing, context);
    writeFileSync(agentsMdPath, content, "utf-8");
  }

  async applyAgent(projectPath: string, agent: ResolvedAgent): Promise<void> {
    const agentsDir = join(projectPath, OPENCODE_DIR, AGENTS_DIR);
    mkdirSync(agentsDir, { recursive: true });

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

    const fileName = `${sanitizeName(agent.name)}.md`;
    writeFileSync(join(agentsDir, fileName), lines.join("\n"), "utf-8");
  }

  async clean(projectPath: string): Promise<void> {
    // Remove cockpit-managed skill files
    const skillsDir = join(projectPath, OPENCODE_DIR, SKILLS_DIR);
    if (existsSync(skillsDir)) {
      for (const file of readdirSync(skillsDir)) {
        if (!file.endsWith(".md")) continue;
        const filePath = join(skillsDir, file);
        const content = readFileSync(filePath, "utf-8");
        if (content.includes(COCKPIT_MARKER)) {
          rmSync(filePath);
        }
      }
    }

    // Remove cockpit-managed agent files
    const agentsDir = join(projectPath, OPENCODE_DIR, AGENTS_DIR);
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

    // Strip cockpit section from AGENTS.md
    const agentsMdPath = join(projectPath, AGENTS_MD);
    if (existsSync(agentsMdPath)) {
      const content = readFileSync(agentsMdPath, "utf-8");
      const startIdx = content.indexOf(COCKPIT_SECTION_START);
      const endIdx = content.indexOf(COCKPIT_SECTION_END);

      if (startIdx >= 0 && endIdx >= 0) {
        const before = content.slice(0, startIdx).trimEnd();
        const after = content.slice(endIdx + COCKPIT_SECTION_END.length).trimStart();

        if (before || after) {
          const cleaned = [before, after].filter(Boolean).join("\n\n");
          writeFileSync(agentsMdPath, cleaned + "\n", "utf-8");
        } else {
          rmSync(agentsMdPath);
        }
      }
    }
  }
}
