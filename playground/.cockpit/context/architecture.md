---
scope: project
---
This is the Cockpit playground — used for smoke-testing all three adapters (claude-code, cursor, opencode).

The playground has no source code of its own. Its purpose is to verify that `cockpit apply` correctly generates adapter output files:
- Claude Code: CLAUDE.md and .claude/commands/*.md
- Cursor: .cursor/rules/*.mdc
- OpenCode: .opencode/context.md and .opencode/skills/*.md

When adding test scenarios, add them to .cockpit/skills/ as YAML skill definitions.
