import { type ResolvedContext, type ResolvedConfig } from "@cockpit/core";

// ─── Human-Readable Formatting ─────────────────────────────────────────────

/**
 * Format context rules as readable markdown.
 */
export function formatContextForHuman(
  context: ResolvedContext,
  config: ResolvedConfig
): string {
  const lines: string[] = [];

  lines.push("# Cockpit Context");
  lines.push("");

  // Config file sources
  lines.push("## Config Sources");
  lines.push("");
  if (config.profilePath) {
    lines.push(`- **Profile**: \`${config.profilePath}\``);
  }
  if (config.workspacePath) {
    lines.push(`- **Workspace**: \`${config.workspacePath}\``);
  }
  if (config.projectPath) {
    lines.push(`- **Project**: \`${config.projectPath}\``);
  }
  if (!config.profilePath && !config.workspacePath && !config.projectPath) {
    lines.push("- *(no config files found)*");
  }
  lines.push("");

  // Global rules
  lines.push("## Global Rules");
  lines.push("");
  if (context.global.length === 0) {
    lines.push("*(none)*");
  } else {
    for (const rule of context.global) {
      const source = rule.source ? ` *(source: ${rule.source})*` : "";
      lines.push(`- ${rule.content}${source}`);
    }
  }
  lines.push("");

  // Project-specific rules
  lines.push("## Project Rules");
  lines.push("");
  if (context.project.length === 0) {
    lines.push("*(none)*");
  } else {
    for (const rule of context.project) {
      const source = rule.source ? ` *(source: ${rule.source})*` : "";
      lines.push(`- ${rule.content}${source}`);
    }
  }
  lines.push("");

  // Summary
  const summary = contextSummary(context);
  lines.push("## Summary");
  lines.push("");
  lines.push(`- **Total rules**: ${summary.totalRules}`);
  lines.push(`- **Global**: ${summary.globalCount}`);
  lines.push(`- **Project**: ${summary.projectCount}`);

  return lines.join("\n");
}

/**
 * Generate a summary report of the context.
 */
export function contextSummary(context: ResolvedContext): {
  totalRules: number;
  globalCount: number;
  projectCount: number;
} {
  const globalCount = context.global.length;
  const projectCount = context.project.length;
  return {
    totalRules: globalCount + projectCount,
    globalCount,
    projectCount,
  };
}
