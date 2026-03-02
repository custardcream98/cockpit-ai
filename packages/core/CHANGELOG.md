# @cockpit-ai/core

## 0.1.1

### Patch Changes

- 4962cbe: fix: add 'skill' as valid adapter type in SkillDefinition schema

  기존 'command' | 'rule'에 'skill' 추가 — 최신 Claude Code 컨벤션(.claude/skills/<name>/SKILL.md)과 일치.

## 0.1.0

### Minor Changes

- Initial public release of the @cockpit-ai packages.

  Cockpit is an AI-first development environment orchestrator. Write Once, Apply Anywhere.

  Includes:

  - `@cockpit-ai/core` — types, config loader, resolver, finder
  - `@cockpit-ai/cli` — commander-based CLI (cockpit binary)
  - `@cockpit-ai/adapters` — Claude Code, Cursor, OpenCode adapters
  - `@cockpit-ai/skills` — skill loader/registry
  - `@cockpit-ai/agents` — agent spawner/tracker
  - `@cockpit-ai/worktree` — worktree orchestration
  - `@cockpit-ai/context` — context management
