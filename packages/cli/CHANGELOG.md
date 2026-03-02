# @cockpit-ai/cli

## 0.1.2

### Patch Changes

- Updated dependencies [4962cbe]
  - @cockpit-ai/core@0.1.1
  - @cockpit-ai/adapters@0.1.1
  - @cockpit-ai/agents@0.1.1
  - @cockpit-ai/context@0.1.1
  - @cockpit-ai/skills@0.1.2
  - @cockpit-ai/worktree@0.1.1

## 0.1.1

### Patch Changes

- 2ab8d33: fix: update skill template to directory-based SKILL.md format, read CLI version from package.json

  - `cockpit skill create` 템플릿을 구 `type: command` → `type: skill` 포맷으로 수정
  - CLI `--version` 출력이 package.json에서 동적으로 읽도록 수정 (기존 하드코딩 0.0.1 제거)

- Updated dependencies [2ab8d33]
  - @cockpit-ai/skills@0.1.1

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

### Patch Changes

- Updated dependencies
  - @cockpit-ai/adapters@0.1.0
  - @cockpit-ai/agents@0.1.0
  - @cockpit-ai/context@0.1.0
  - @cockpit-ai/core@0.1.0
  - @cockpit-ai/skills@0.1.0
  - @cockpit-ai/worktree@0.1.0
