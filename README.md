# Cockpit

**AI-first Development Environment Orchestrator**

> Write Once, Apply Anywhere — 하나의 설정으로 모든 AI 도구에 적용

---

[English](#english) | [한국어](#한국어)

---

## English

### What is Cockpit?

When you work with AI coding tools (Claude Code, Cursor, GitHub Copilot, OpenCode, etc.), each tool has its own configuration format and location:

- Claude Code → `.claude/commands/*.md`, `CLAUDE.md`
- Cursor → `.cursor/rules/*.mdc`
- GitHub Copilot → `.github/copilot-instructions.md`

Cockpit is a **portable, composable workspace orchestrator** that lets you define skills, context rules, and agent configs once — and automatically translates them into each tool's native format.

### Core Values

| Value | Description |
|-------|-------------|
| **Write Once, Apply Anywhere** | One skill/agent definition → auto-converted for Claude Code, Cursor, Copilot, etc. |
| **Portable Profile** | Sync your AI development environment via git. Same setup everywhere. |
| **Orchestration** | Manage multiple repos, worktrees, and agents from one place. |

### Quick Start

```bash
# Install
npm install -g @cockpit-ai/cli   # coming soon

# Initialize a workspace
cockpit init /path/to/workspace

# Initialize a project inside it
cockpit init /path/to/workspace/my-project --project

# View current environment
cockpit status

# Apply config to AI tools
cockpit apply
```

### Config Hierarchy

```
~/.cockpit/profile.yaml           ← Personal global preferences
/workspace/.cockpit/config.yaml   ← Workspace-level config
/workspace/project/.cockpit/config.yaml  ← Project-level config
```

Later layers override earlier ones (deep merge). All context rules accumulate.

### workspace config.yaml

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
```

### Skill Definition

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

### CLI Commands

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

### Tech Stack

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

### Project Status

| Phase | Status | Description |
|-------|--------|-------------|
| 1 — Foundation | ✅ Complete | Monorepo, config system, `init`/`status` commands |
| 2 — Skills & Adapters | 🚧 In Progress | Claude Code adapter, skill CRUD |
| 3 — Profile & Sync | 📋 Planned | Git-based profile sync |
| 4 — Agents | 📋 Planned | Agent spawn/track |
| 5 — Worktree | 📋 Planned | Multi-repo worktree orchestration |
| 6 — Context | 📋 Planned | Rule-based context injection |

---

## 한국어

### Cockpit이란?

AI 코딩 도구(Claude Code, Cursor, GitHub Copilot, OpenCode 등)와 작업할 때, 각 도구마다 설정 방식이 다릅니다:

- Claude Code → `.claude/commands/*.md`, `CLAUDE.md`
- Cursor → `.cursor/rules/*.mdc`
- GitHub Copilot → `.github/copilot-instructions.md`

Cockpit은 **하나의 설정으로 모든 AI 도구에 적용**할 수 있는 portable, composable 워크스페이스 오케스트레이터입니다. 스킬, 컨텍스트 규칙, 에이전트 설정을 한 번 정의하면 각 도구의 네이티브 포맷으로 자동 변환됩니다.

### 핵심 가치

| 가치 | 설명 |
|------|------|
| **Write Once, Apply Anywhere** | 하나의 스킬/에이전트 정의 → Claude Code, Cursor, Copilot 등에 자동 변환 |
| **Portable Profile** | git으로 AI 개발환경을 동기화. 어디서든 동일한 환경 |
| **Orchestration** | 여러 repo, worktree, agent를 한 곳에서 관리 |

### 빠른 시작

```bash
# 워크스페이스 초기화
cockpit init /path/to/workspace

# 프로젝트 초기화 (워크스페이스 하위)
cockpit init /path/to/workspace/my-project --project

# 현재 환경 확인
cockpit status

# AI 도구에 설정 적용
cockpit apply
```

### 설정 계층 구조

```
~/.cockpit/profile.yaml                      ← 개인 전역 설정
/workspace/.cockpit/config.yaml             ← 워크스페이스 설정
/workspace/project/.cockpit/config.yaml     ← 프로젝트 설정
```

나중 레이어가 이전 레이어를 덮어씁니다(deep merge). 컨텍스트 규칙은 모두 누적됩니다.

### 스킬 정의 예시

```yaml
# .cockpit/skills/code-review.yaml
name: code-review
version: 1.0.0
description: 코드 리뷰 스킬

trigger:
  - "/review"

prompt: |
  다음 항목을 중점적으로 코드를 리뷰해 주세요:
  - 버그와 엣지 케이스
  - 성능 이슈
  - 보안 취약점

adapters:
  claude-code:
    type: command    # → .claude/commands/code-review.md로 생성
  cursor:
    type: rule       # → .cursor/rules/code-review.mdc로 생성
```

### 프로젝트 상태

| 단계 | 상태 | 설명 |
|------|------|------|
| 1 — Foundation | ✅ 완료 | Monorepo, 설정 시스템, `init`/`status` 명령어 |
| 2 — Skills & Adapters | 🚧 진행 중 | Claude Code 어댑터, 스킬 CRUD |
| 3 — Profile & Sync | 📋 예정 | Git 기반 프로필 동기화 |
| 4 — Agents | 📋 예정 | 에이전트 스폰/추적 |
| 5 — Worktree | 📋 예정 | 멀티 레포 워크트리 오케스트레이션 |
| 6 — Context | 📋 예정 | 규칙 기반 컨텍스트 자동 주입 |

### 기여하기

```bash
git clone <repo>
cd cockpit
pnpm install
pnpm build
pnpm test
```
