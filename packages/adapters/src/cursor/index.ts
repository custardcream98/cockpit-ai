import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import {
  type CockpitAdapter,
  type ResolvedSkill,
  type ResolvedContext,
  type ResolvedAgent,
} from "@cockpit/core";

// ─── Constants ─────────────────────────────────────────────────────────────

const CURSOR_DIR = ".cursor";
const RULES_DIR = "rules";
const COCKPIT_MARKER = "<!-- cockpit:managed -->";

// ─── Helpers ───────────────────────────────────────────────────────────────

function sanitizeName(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9-_]/g, "-");
}

/**
 * Build a .mdc file content with MDC frontmatter.
 * MDC format: YAML frontmatter + markdown body.
 */
function buildMdc(
  frontmatter: Record<string, unknown>,
  body: string
): string {
  const fmLines = ["---"];
  for (const [key, value] of Object.entries(frontmatter)) {
    if (Array.isArray(value)) {
      fmLines.push(`${key}:`);
      for (const item of value) {
        fmLines.push(`  - ${item}`);
      }
    } else {
      fmLines.push(`${key}: ${String(value)}`);
    }
  }
  fmLines.push("---");

  return `${fmLines.join("\n")}\n\n${body.trim()}\n\n${COCKPIT_MARKER}\n`;
}

// ─── Cursor Adapter ─────────────────────────────────────────────────────────

export class CursorAdapter implements CockpitAdapter {
  readonly name = "cursor";

  async detect(projectPath: string): Promise<boolean> {
    return existsSync(join(projectPath, CURSOR_DIR));
  }

  async applySkill(projectPath: string, skill: ResolvedSkill): Promise<void> {
    const rulesDir = join(projectPath, CURSOR_DIR, RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });

    const adapterCfg = skill.adapterConfig?.["cursor"] ?? {};
    const alwaysApply = adapterCfg.alwaysApply ?? false;

    const frontmatter: Record<string, unknown> = {
      description: skill.description ?? skill.name,
      alwaysApply,
      globs: "",
    };

    const fileName = `${sanitizeName(skill.name)}.mdc`;
    const content = buildMdc(frontmatter, skill.prompt);
    writeFileSync(join(rulesDir, fileName), content, "utf-8");
  }

  async applyContext(projectPath: string, context: ResolvedContext): Promise<void> {
    const rulesDir = join(projectPath, CURSOR_DIR, RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });

    const allRules = [...context.global, ...context.project];
    const lines: string[] = [];

    if (context.global.length > 0) {
      lines.push("## Global Rules");
      lines.push("");
      for (const rule of context.global) {
        lines.push(`- ${rule.content}`);
      }
    }

    if (context.project.length > 0) {
      if (lines.length > 0) lines.push("");
      lines.push("## Project Rules");
      lines.push("");
      for (const rule of context.project) {
        lines.push(`- ${rule.content}`);
      }
    }

    const body = allRules.length > 0
      ? lines.join("\n")
      : "<!-- No context rules defined -->";

    const content = buildMdc({ description: "Cockpit context rules", alwaysApply: true, globs: "" }, body);
    writeFileSync(join(rulesDir, "cockpit-context.mdc"), content, "utf-8");
  }

  async applyAgent(projectPath: string, agent: ResolvedAgent): Promise<void> {
    // Cursor has no native agent support; map to a rule file.
    const rulesDir = join(projectPath, CURSOR_DIR, RULES_DIR);
    mkdirSync(rulesDir, { recursive: true });

    const lines = [
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

    const frontmatter: Record<string, unknown> = {
      description: `Agent: ${agent.name} — ${agent.role}`,
      alwaysApply: false,
      globs: "",
    };

    const content = buildMdc(frontmatter, lines.join("\n"));
    const fileName = `cockpit-agent-${sanitizeName(agent.name)}.mdc`;
    writeFileSync(join(rulesDir, fileName), content, "utf-8");
  }

  async clean(projectPath: string): Promise<void> {
    const rulesDir = join(projectPath, CURSOR_DIR, RULES_DIR);
    if (!existsSync(rulesDir)) return;

    for (const file of readdirSync(rulesDir)) {
      if (!file.endsWith(".mdc")) continue;
      const filePath = join(rulesDir, file);
      const content = readFileSync(filePath, "utf-8");
      if (content.includes(COCKPIT_MARKER)) {
        rmSync(filePath);
      }
    }
  }
}
