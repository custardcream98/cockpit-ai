/**
 * Returns the YAML content for a new skill template.
 */
export function defaultSkillTemplate(name: string): string {
  return `name: ${name}
version: 1.0.0
description: ${name} skill

# Triggers that activate this skill (for tools that support slash commands)
trigger:
  - "/${name}"

# The prompt sent to the AI when this skill is triggered
prompt: |
  Describe what this skill should do.
  Add detailed instructions here.

# Tools the AI is allowed to use (leave empty for no restriction)
tools:
  - read
  - grep
  - glob

# Per-adapter overrides (optional)
adapters:
  claude-code:
    type: skill    # creates .claude/skills/${name}/SKILL.md
  cursor:
    type: rule     # creates .cursor/rules/${name}.mdc
    alwaysApply: false
`;
}

/**
 * Returns the YAML content for a pre-built "code-review" skill.
 */
export function codeReviewTemplate(): string {
  return `name: code-review
version: 1.0.0
description: Comprehensive code review

trigger:
  - "/review"
  - "review"

prompt: |
  Review the provided code thoroughly:

  1. **Bugs & Edge Cases** — identify logic errors, unhandled cases, off-by-one errors
  2. **Performance** — flag inefficient algorithms, unnecessary re-renders, N+1 queries
  3. **Security** — check for injection, XSS, auth issues, sensitive data exposure
  4. **Readability** — suggest clearer names, simpler logic, better structure
  5. **Tests** — note missing test coverage for critical paths

  Provide specific, actionable feedback with line references where possible.

tools:
  - read
  - grep
  - glob

adapters:
  claude-code:
    type: skill
`;
}
