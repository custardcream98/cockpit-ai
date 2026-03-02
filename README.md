# Cockpit

**AI-first Development Environment Orchestrator**

> Write Once, Apply Anywhere

[한국어](./README.ko.md)

---

## What is Cockpit?

When you work with AI coding tools (Claude Code, Cursor, OpenCode, etc.), each tool has its own configuration format and location:

- Claude Code → `.claude/skills/<name>/SKILL.md`, `CLAUDE.md`
- Cursor → `.cursor/rules/*.mdc`
- OpenCode → `.opencode/instructions.md`
- Any tool → `AGENTS.md` (Linux Foundation standard)

Cockpit is a **portable, composable workspace orchestrator** that lets you define skills, context rules, and agent configs once — and automatically translates them into each tool's native format.

## Core Values

| Value | Description |
|-------|-------------|
| **Write Once, Apply Anywhere** | One skill/agent definition → auto-converted for Claude Code, Cursor, OpenCode, AGENTS.md, etc. |
| **Portable Profile** | Sync your AI development environment via git. Same setup everywhere. |
| **Orchestration** | Spawn real agent processes, manage worktrees, and coordinate multi-agent workflows. |

## Quick Start

```bash
# Install
npm install -g @cockpit-ai/cli

# One-touch setup: init + auto-detect stack + apply to all AI tools
cockpit setup
```

Or step by step:

```bash
cockpit init               # create .cockpit/config.yaml
cockpit context analyze --apply  # detect tech stack, add rules
cockpit apply              # write to CLAUDE.md, .cursor/rules/, AGENTS.md…
```

## Config Hierarchy

```
~/.cockpit/profile.yaml                      ← Personal global preferences
/workspace/.cockpit/config.yaml             ← Workspace-level config
/workspace/project/.cockpit/config.yaml     ← Project-level config
```

Later layers override earlier ones (deep merge). All context rules accumulate.

## workspace config.yaml

```yaml
cockpit: "1.0"

workspace:
  name: my-workspace
  default_adapter: claude-code

adapters:
  - claude-code
  - cursor
  - agents-md

context:
  global:
    - "Use TypeScript strict mode"
    - "Prefer functional patterns"
  files:
    - ".cockpit/context/**/*.md"   # load context from external markdown files
```

## Context Files

Place markdown files in `.cockpit/context/` — they are loaded automatically as global rules. Files in `.cockpit/projects/<name>/context/` are loaded as project-scoped rules.

```markdown
Use vitest for all testing. Never use Jest.
```

Scope is determined by **directory location**, not frontmatter. Frontmatter is stripped from content.

## Skill Definition

```yaml
# .cockpit/skills/code-review.yaml
name: code-review
version: 1.0.0
description: Comprehensive code review

trigger:
  - "/review"

prompt: |
  Review the code for:
  - Bugs and edge cases
  - Performance issues
  - Security vulnerabilities

adapters:
  claude-code:
    type: skill    # → .claude/skills/code-review/SKILL.md
  cursor:
    type: rule     # → .cursor/rules/code-review.mdc
```

## Built-in Skills

When you run `cockpit apply`, two skills are installed to your AI tools automatically:

| Trigger | Description |
|---------|-------------|
| `/cockpit-context-update` | Analyze project and update `.cockpit/context/` files |
| `/cockpit-setup` | Set up Cockpit in any project — guided walkthrough |

## LLM Reference

[`llms.txt`](./llms.txt) — machine-readable reference for LLMs (config schema, CLI commands, file structure).

## CLI Commands

```
cockpit setup                          One-touch: init + analyze + apply
cockpit init [path]                    Initialize workspace or project
cockpit status                         Show current environment
cockpit apply [--adapter=name]         Apply config to AI tools
cockpit apply --dry-run                Preview changes without writing files
cockpit apply --clean                  Remove cockpit-managed files

cockpit skill list                     List available skills
cockpit skill add <name|path>          Add a skill
cockpit skill create <name>            Create a skill from template
cockpit skill remove <name>            Remove a skill

cockpit context show                   Show current context rules
cockpit context add <rule> [--project] Add a context rule
cockpit context remove <rule>          Remove a context rule
cockpit context generate               Write context to CLAUDE.md etc.
cockpit context analyze [--apply]      Detect tech stack and suggest rules
cockpit context lint                   Check for stale/conflicting rules
cockpit context stats                  Show token cost per rule

cockpit agent list                     List agents
cockpit agent spawn <name> "<task>"    Spawn an agent to run a task
cockpit agent stop <runId>             Stop a running agent
cockpit agent status                   Agent run dashboard
cockpit agent logs <runId>             Show logs for a run

cockpit profile sync push              Push profile to remote
cockpit profile sync pull              Pull profile from remote

cockpit worktree create <branch>       Create a worktree
cockpit worktree assign <wt> <agent>   Assign agent to worktree
cockpit worktree clean                 Clean up stale worktrees
```

## Tech Stack

| | |
|---|---|
| Runtime | Node.js ≥ 20 |
| Language | TypeScript (strict) |
| Package Manager | pnpm |
| Monorepo | turborepo |
| Config Validation | zod |
| CLI Framework | commander |
| Build | tsup |
| Test | vitest |

## Supported Adapters

| Adapter | Config Written | Notes |
|---------|---------------|-------|
| `claude-code` | `CLAUDE.md`, `.claude/skills/` | Claude Code native format |
| `cursor` | `.cursor/rules/*.mdc` | Cursor native format |
| `opencode` | `.opencode/instructions.md` | OpenCode native format |
| `agents-md` | `AGENTS.md` | Linux Foundation emerging standard |

## Project Status

| Phase | Status | Description |
|-------|--------|-------------|
| Foundation | ✅ | Monorepo, config system, `init`/`status` |
| Skills & Adapters | ✅ | Claude Code, Cursor, OpenCode, AGENTS.md adapters |
| Profile & Sync | ✅ | Git-based profile sync |
| Agent Orchestration | ✅ | Real process spawn via Claude Code CLI, worktree integration |
| Context Intelligence | ✅ | Tech stack analysis, rule auto-generation, staleness detection |
| DX & Polish | ✅ | `--dry-run`, `--verbose`, `context lint/stats/analyze` |

## Contributing

```bash
git clone <repo>
pnpm install
pnpm build
pnpm test
```
