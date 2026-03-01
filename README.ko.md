# Cockpit

**AI-first 개발 환경 오케스트레이터**

> Write Once, Apply Anywhere — 하나의 설정으로 모든 AI 도구에 적용

[English](./README.md)

---

## Cockpit이란?

AI 코딩 도구(Claude Code, Cursor, GitHub Copilot, OpenCode 등)와 작업할 때, 각 도구마다 설정 방식이 다릅니다:

- Claude Code → `.claude/skills/<name>/SKILL.md`, `CLAUDE.md`
- Cursor → `.cursor/rules/*.mdc`
- GitHub Copilot → `.github/copilot-instructions.md`

Cockpit은 **하나의 설정으로 모든 AI 도구에 적용**할 수 있는 portable, composable 워크스페이스 오케스트레이터입니다. 스킬, 컨텍스트 규칙, 에이전트 설정을 한 번 정의하면 각 도구의 네이티브 포맷으로 자동 변환됩니다.

## 핵심 가치

| 가치 | 설명 |
|------|------|
| **Write Once, Apply Anywhere** | 하나의 스킬/에이전트 정의 → Claude Code, Cursor, Copilot 등에 자동 변환 |
| **Portable Profile** | git으로 AI 개발환경을 동기화. 어디서든 동일한 환경 |
| **Orchestration** | 여러 repo, worktree, agent를 한 곳에서 관리 |

## 빠른 시작

```bash
# 설치
npm install -g @cockpit-ai/cli

# 워크스페이스 초기화
cockpit init /path/to/workspace

# 프로젝트 초기화 (워크스페이스 하위)
cockpit init /path/to/workspace/my-project --project

# 현재 환경 확인
cockpit status

# AI 도구에 설정 적용
cockpit apply
```

## 설정 계층 구조

```
~/.cockpit/profile.yaml                      ← 개인 전역 설정
/workspace/.cockpit/config.yaml             ← 워크스페이스 설정
/workspace/project/.cockpit/config.yaml     ← 프로젝트 설정
```

나중 레이어가 이전 레이어를 덮어씁니다(deep merge). 컨텍스트 규칙은 모두 누적됩니다.

## config.yaml 예시

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
    - "TypeScript strict mode 사용"
    - "함수형 패턴 선호"
  files:
    - ".cockpit/context/**/*.md"   # 외부 마크다운 파일에서 컨텍스트 로드
```

## 컨텍스트 파일

`.cockpit/context/` 디렉토리에 마크다운 파일을 놓으면 자동으로 로드됩니다:

```markdown
---
scope: project
---
모든 테스트에 vitest를 사용하세요. Jest는 사용하지 마세요.
```

frontmatter의 `scope`는 `global`(기본값) 또는 `project`로 지정할 수 있습니다.

## 스킬 정의 예시

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
    type: skill    # → .claude/skills/code-review/SKILL.md로 생성
  cursor:
    type: rule     # → .cursor/rules/code-review.mdc로 생성
```

## CLI 명령어

```
cockpit init [path]               워크스페이스 또는 프로젝트 초기화
cockpit status                    현재 환경 확인
cockpit apply [--adapter=name]    AI 도구에 설정 적용

cockpit skill list                스킬 목록 조회
cockpit skill add <name|path>     스킬 추가
cockpit skill create <name>       템플릿으로 스킬 생성
cockpit skill remove <name>       스킬 제거

cockpit agent list                에이전트 목록
cockpit agent spawn <name>        에이전트 시작
cockpit agent status              에이전트 대시보드

cockpit profile sync push         프로필 원격 저장소에 푸시
cockpit profile sync pull         프로필 원격 저장소에서 가져오기

cockpit worktree create <branch>  워크트리 생성
cockpit worktree assign <wt> <agent>  에이전트를 워크트리에 할당
```

## 기술 스택

| | |
|---|---|
| 런타임 | Node.js ≥ 20 |
| 언어 | TypeScript (strict) |
| 패키지 매니저 | pnpm |
| 모노레포 | turborepo |
| 설정 검증 | zod |
| CLI 프레임워크 | commander |
| 빌드 | tsup |
| 테스트 | vitest |

## 프로젝트 상태

모든 Phase 완료 ✅

| 단계 | 상태 | 설명 |
|------|------|------|
| 1 — Foundation | ✅ 완료 | Monorepo, 설정 시스템, `init`/`status` 명령어 |
| 2 — Skills & Adapters | ✅ 완료 | Claude Code, Cursor, OpenCode 어댑터, 스킬 CRUD |
| 3 — Profile & Sync | ✅ 완료 | Git 기반 프로필 동기화 |
| 4 — Agents | ✅ 완료 | 에이전트 스폰/추적 |
| 5 — Worktree | ✅ 완료 | 멀티 레포 워크트리 오케스트레이션 |
| 6 — Context | ✅ 완료 | 규칙 기반 컨텍스트 자동 주입, 외부 파일 지원 |

## 기여하기

```bash
git clone <repo>
pnpm install
pnpm build
pnpm test
```
