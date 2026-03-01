# Cockpit Playground

Test environment for Cockpit adapter integration.

## Setup

Build Cockpit from the workspace root first:

```bash
# From workspace root
pnpm build
```

## Usage

### Apply all adapters

```bash
cd playground
npx cockpit apply
```

This will generate:

| Adapter | Generated files |
|---------|----------------|
| Claude Code | `CLAUDE.md`, `.claude/commands/code-review.md`, `.claude/commands/refactor.md`, `.claude/agents/reviewer.md` |
| Cursor | `.cursor/rules/code-review.mdc`, `.cursor/rules/refactor.mdc`, `.cursor/rules/cockpit-context.mdc`, `.cursor/rules/cockpit-agent-reviewer.mdc` |
| OpenCode | `AGENTS.md`, `.opencode/skills/code-review.md`, `.opencode/skills/refactor.md`, `.opencode/agents/reviewer.md` |

### Apply a single adapter

```bash
npx cockpit apply --adapter claude-code
npx cockpit apply --adapter cursor
npx cockpit apply --adapter opencode
```

### Clean generated files

```bash
npx cockpit apply --clean
```

### Check config status

```bash
npx cockpit status
```

## Config

The `.cockpit/config.yaml` enables all three adapters and defines:
- 2 skills: `code-review`, `refactor`
- 1 agent: `reviewer`
- Global + project context rules
