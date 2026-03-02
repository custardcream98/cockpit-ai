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
