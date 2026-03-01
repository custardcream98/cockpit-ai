import type { ResolvedSkill } from "@cockpit-ai/core";

// ─── Builtin Skill: context-update ────────────────────────────────────────

const CONTEXT_UPDATE_PROMPT = `# Update Cockpit Context

Analyze the current project and update the Cockpit context files in \`.cockpit/context/\`.

## Steps

1. **Inspect the project** to understand its tech stack, conventions, and architecture:
   - Read \`package.json\`, \`tsconfig.json\`, \`README.md\` (if they exist)
   - Look at directory structure and key source files
   - Identify: language, framework, test runner, code style preferences

2. **Update \`.cockpit/context/\` files** with your findings:
   - \`conventions.md\` — coding conventions, style rules, naming patterns
   - \`architecture.md\` — project architecture, key modules, design decisions
   - Create additional files as needed (e.g. \`testing.md\`, \`api.md\`)
   - Use frontmatter \`scope: global\` or \`scope: project\` as appropriate

## File Format

\`\`\`markdown
---
scope: global
---
Your context rules here. Be specific and actionable.
\`\`\`

## Guidelines

- Be specific and actionable — "Use TypeScript strict mode" is better than "Use TypeScript"
- One file per topic; content within a file can be as long as needed
- Prefer \`scope: global\` for language/style rules
- Use \`scope: project\` for project-specific architecture or conventions
- Remove outdated rules when the project evolves
- \`cockpit watch\` auto-applies changes — no need to run \`cockpit apply\` manually`;

const CONTEXT_UPDATE_SKILL: ResolvedSkill = {
  name: "cockpit-context-update",
  version: "builtin",
  description: "Analyze project and update Cockpit context files",
  trigger: ["/cockpit-context-update"],
  prompt: CONTEXT_UPDATE_PROMPT,
  tools: [],
  sourcePath: "builtin",
  adapterConfig: {
    "claude-code": { type: "command" },
    cursor: { type: "rule" },
    opencode: { type: "command" },
  },
};

// ─── Standing instruction injected into every managed CLAUDE.md ──────────

export const STANDING_INSTRUCTION = `Proactively maintain \`.cockpit/context/\` as you work:
- Discover a coding pattern → update or create the relevant \`.md\` file
- Understand the architecture better → update \`architecture.md\`
- Notice an outdated rule → remove or correct it
- \`cockpit watch\` auto-applies all changes — just write the files.`;

// ─── Exports ──────────────────────────────────────────────────────────────

export function getBuiltinSkills(): ResolvedSkill[] {
  return [CONTEXT_UPDATE_SKILL];
}
