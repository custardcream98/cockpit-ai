import { type ResolvedContext } from "@cockpit/core";

// ─── LLM-Oriented Formatting ───────────────────────────────────────────────

const COCKPIT_MARKER = "<!-- cockpit:managed -->";

/**
 * Format context rules as a compact system prompt string.
 * Used when injecting context into AI tool configs.
 */
export function formatContextForLLM(context: ResolvedContext): string {
  const parts: string[] = [];

  const allRules = [...context.global, ...context.project];
  if (allRules.length === 0) {
    return "";
  }

  parts.push("You must follow these rules:");
  parts.push("");

  for (const rule of allRules) {
    parts.push(`- ${rule.content}`);
  }

  return parts.join("\n");
}

/**
 * Merge context rules into a CLAUDE.md-ready string.
 */
export function buildClaudeMdSection(context: ResolvedContext): string {
  const lines: string[] = [COCKPIT_MARKER];

  const allRules = [...context.global, ...context.project];
  if (allRules.length === 0) {
    lines.push("");
    lines.push("<!-- No context rules defined -->");
    return lines.join("\n");
  }

  if (context.global.length > 0) {
    lines.push("");
    lines.push("## Global Rules");
    lines.push("");
    for (const rule of context.global) {
      lines.push(`- ${rule.content}`);
    }
  }

  if (context.project.length > 0) {
    lines.push("");
    lines.push("## Project Rules");
    lines.push("");
    for (const rule of context.project) {
      lines.push(`- ${rule.content}`);
    }
  }

  return lines.join("\n");
}
