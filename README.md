# Cockpit

**AI-first Development Environment Orchestrator**

> Write Once, Apply Anywhere

[한국어](./README.ko.md)

---

## What is Cockpit?

When you work with AI coding tools (Claude Code, Cursor, GitHub Copilot, OpenCode, etc.), each tool has its own configuration format and location:

- Claude Code → `.claude/commands/*.md`, `CLAUDE.md`
- Cursor → `.cursor/rules/*.mdc`
- GitHub Copilot → `.github/copilot-instructions.md`

Cockpit is a **portable, composable workspace orchestrator** that lets you define skills, context rules, and agent configs once — and automatically translates them into each tool's native format.

## Core Values

| Value | Description |
|-------|-------------|
| **Write Once, Apply Anywhere** | One skill/agent definition → auto-converted for Claude Code, Cursor, Copilot, etc. |
| **Portable Profile** | Sync your AI development environment via git. Same setup everywhere. |
| **Orchestration** | Manage multiple repos, worktrees, and agents from one place. |

## Quick Start

```bash
# Install
npm install -g @cockpit-ai/cli

# Initialize a workspace
cockpit init /path/to/workspace

# Initialize a project inside it
cockpit init /path/to/workspace/my-project --project

# View current environment
cockpit status

# Apply config to AI tools
cockpit apply
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

context:
  global:
    - "Use TypeScript strict mode"
    - "Prefer functional patterns"
  files:
    - ".cockpit/context/*.md"   # load context from external markdown files
```

## Context Files

Place markdown files in `.cockpit/context/` — they are loaded automatically:

```markdown
---
scope: project
---
Use vitest for all testing. Never use Jest.
```

Frontmatter `scope` can be `global` (default) or `project`.

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
    type: command    # → .claude/commands/code-review.md
  cursor:
    type: rule       # → .cursor/rules/code-review.mdc
```

## CLI Commands

```
cockpit init [path]               Initialize workspace or project
cockpit status                    Show current environment
cockpit apply [--adapter=name]    Apply config to AI tools

cockpit skill list                List available skills
cockpit skill add <name|path>     Add a skill
cockpit skill create <name>       Create a skill from template
cockpit skill remove <name>       Remove a skill

cockpit agent list                List agents
cockpit agent spawn <name>        Start an agent
cockpit agent status              Agent dashboard

cockpit profile sync push         Push profile to remote
cockpit profile sync pull         Pull profile from remote

cockpit worktree create <branch>  Create a worktree
cockpit worktree assign <wt> <agent>  Assign agent to worktree
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

## Project Status

All phases complete. ✅

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Foundation | ✅ Complete | Monorepo, config system, `init`/`status` commands |
| 2 — Skills & Adapters | ✅ Complete | Claude Code, Cursor, OpenCode adapters; skill CRUD |
| 3 — Profile & Sync | ✅ Complete | Git-based profile sync |
| 4 — Agents | ✅ Complete | Agent spawn/track |
| 5 — Worktree | ✅ Complete | Multi-repo worktree orchestration |
| 6 — Context | ✅ Complete | Rule-based context injection, external file support |

## Contributing

```bash
git clone <repo>
pnpm install
pnpm build
pnpm test
```
