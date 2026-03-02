import type { ResolvedSkill } from "@cockpit-ai/core";

// ─── Builtin Skill: context-update ────────────────────────────────────────

const CONTEXT_UPDATE_PROMPT = `# Update Cockpit Context

Analyze the current project and update the Cockpit context files.

## Steps

1. **Find the workspace root**: Walk up the directory tree to find the \`.cockpit/\` directory.

2. **Inspect the project** to understand its tech stack, conventions, and architecture:
   - Read \`package.json\`, \`tsconfig.json\`, \`README.md\` (if they exist)
   - Look at directory structure and key source files
   - Identify: language, framework, test runner, code style preferences

3. **Determine the right context path** based on scope:
   - **Shared (global) rules** — apply to all projects in the workspace:
     Write to \`.cockpit/context/<topic>.md\`
   - **Project-specific rules** — apply only to the current project (dirname):
     Write to \`.cockpit/projects/<projectDirname>/context/<topic>.md\`

   Example: if you are in \`/dev/workspace/\`, the project dirname is \`workspace\`,
   so project-specific files go in \`.cockpit/projects/workspace/context/\`.

## Directory Location = Scope

- \`.cockpit/context/*.md\` → **always global** (frontmatter \`scope\` is ignored)
- \`.cockpit/projects/{name}/context/*.md\` → **always project** (frontmatter \`scope\` is ignored)

## File Format

\`\`\`markdown
# Conventions
Your context rules here. Be specific and actionable.
\`\`\`

## Guidelines

- Be specific and actionable — "Use TypeScript strict mode" is better than "Use TypeScript"
- One file per topic; content within a file can be as long as needed
- Use shared \`.cockpit/context/\` for team-wide language/style rules
- Use \`.cockpit/projects/{dirname}/context/\` for project-specific architecture or conventions
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
- Organise by topic using subdirectories (e.g. \`testing/vitest.md\`, \`frontend/react.md\`)
- \`cockpit watch\` auto-applies all changes — just write the files.
- Project-specific rules go in \`.cockpit/projects/{projectDirname}/context/\` (shared rules go in \`.cockpit/context/\`)`;

// ─── Exports ──────────────────────────────────────────────────────────────

export function getBuiltinSkills(): ResolvedSkill[] {
  return [CONTEXT_UPDATE_SKILL];
}
