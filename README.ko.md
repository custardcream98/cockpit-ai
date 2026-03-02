# Cockpit

**AI-first 개발 환경 오케스트레이터**

> Write Once, Apply Anywhere — 하나의 설정으로 모든 AI 도구에 적용

[English](./README.md)

---

## Cockpit이란?

AI 코딩 도구(Claude Code, Cursor, OpenCode 등)와 작업할 때, 각 도구마다 설정 방식이 다릅니다:

- Claude Code → `.claude/skills/<name>/SKILL.md`, `CLAUDE.md`
- Cursor → `.cursor/rules/*.mdc`
- OpenCode → `.opencode/instructions.md`
- 모든 도구 → `AGENTS.md` (Linux Foundation 신흥 표준)

Cockpit은 **하나의 설정으로 모든 AI 도구에 적용**할 수 있는 portable, composable 워크스페이스 오케스트레이터입니다. 스킬, 컨텍스트 규칙, 에이전트 설정을 한 번 정의하면 각 도구의 네이티브 포맷으로 자동 변환됩니다.

## 핵심 가치

| 가치 | 설명 |
|------|------|
| **Write Once, Apply Anywhere** | 하나의 스킬/에이전트 정의 → Claude Code, Cursor, OpenCode, AGENTS.md 등에 자동 변환 |
| **Portable Profile** | git으로 AI 개발환경을 동기화. 어디서든 동일한 환경 |
| **Orchestration** | 실제 에이전트 프로세스 스폰, 워크트리 관리, 멀티 에이전트 조율 |

## 빠른 시작

```bash
# 설치
npm install -g @cockpit-ai/cli

# 원터치 세팅: init + 기술 스택 자동 감지 + AI 도구 전체 적용
cockpit setup
```

단계별로 진행하려면:

```bash
cockpit init                     # .cockpit/config.yaml 생성
cockpit context analyze --apply  # 기술 스택 감지 + 규칙 자동 추가
cockpit apply                    # CLAUDE.md, .cursor/rules/, AGENTS.md 등에 적용
```

## 설정 계층 구조

```
~/.cockpit/profile.yaml                              ← 개인 전역 설정
/workspace/.cockpit/config.yaml                     ← 워크스페이스 설정
/workspace/.cockpit/projects/<name>.yaml            ← 프로젝트별 설정
/workspace/.cockpit/context/*.md                    ← 전체 컨텍스트 규칙 (자동 로드)
/workspace/.cockpit/projects/<name>/context/*.md    ← 프로젝트 컨텍스트 규칙 (자동 로드)
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
  - agents-md

context:
  global:
    - "TypeScript strict mode 사용"
    - "함수형 패턴 선호"
  files:
    - ".cockpit/context/**/*.md"   # 외부 마크다운 파일에서 컨텍스트 로드
```

## 컨텍스트 파일

`.cockpit/context/` 디렉토리의 마크다운 파일은 자동으로 global 규칙으로 로드됩니다. `.cockpit/projects/<name>/context/` 하위 파일은 project 규칙으로 로드됩니다.

```markdown
모든 테스트에 vitest를 사용하세요. Jest는 사용하지 마세요.
```

scope는 **파일 위치(디렉토리)**로 결정되며, frontmatter는 내용에서 제거됩니다.

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

## 빌트인 스킬

`cockpit apply` 실행 시 두 개의 스킬이 AI 도구에 자동 설치됩니다:

| 트리거 | 설명 |
|--------|------|
| `/cockpit-context-update` | 프로젝트 분석 후 `.cockpit/context/` 파일 업데이트 |
| `/cockpit-setup` | 새 프로젝트에 Cockpit 세팅 — 단계별 안내 |

## LLM 레퍼런스

[`llms.txt`](./llms.txt) — LLM이 읽을 수 있는 레퍼런스 (설정 스키마, CLI 명령어, 파일 구조).

## CLI 명령어

```
cockpit setup                          원터치: init + analyze + apply
cockpit init [path]                    워크스페이스 초기화
cockpit status                         현재 환경 확인
cockpit apply [--adapter=name]         AI 도구에 설정 적용
cockpit apply --dry-run                파일 변경 없이 미리보기
cockpit apply --clean                  cockpit 관리 파일 제거

cockpit project init <name>            워크스페이스에 프로젝트 등록
cockpit project list                   등록된 프로젝트 목록
cockpit project remove <name>          프로젝트 제거

cockpit skill list                     스킬 목록 조회
cockpit skill add <name|path>          스킬 추가
cockpit skill create <name>            템플릿으로 스킬 생성
cockpit skill remove <name>            스킬 제거

cockpit context show                   현재 컨텍스트 규칙 확인
cockpit context add <rule> [--project] 컨텍스트 규칙 추가
cockpit context remove <rule>          컨텍스트 규칙 제거
cockpit context generate               CLAUDE.md 등 컨텍스트 파일 생성
cockpit context analyze [--apply]      기술 스택 분석 및 규칙 자동 추천
cockpit context lint                   stale/충돌 규칙 검사
cockpit context stats                  규칙별 토큰 비용 확인

cockpit agent list                     에이전트 목록
cockpit agent spawn <name> "<task>"    에이전트를 실행해 태스크 수행
cockpit agent stop <runId>             실행 중인 에이전트 중지
cockpit agent status                   에이전트 실행 대시보드
cockpit agent logs <runId>             특정 실행 로그 확인

cockpit profile sync push              프로필 원격 저장소에 푸시
cockpit profile sync pull              프로필 원격 저장소에서 가져오기

cockpit worktree create <branch>       워크트리 생성
cockpit worktree assign <wt> <agent>   에이전트를 워크트리에 할당
cockpit worktree clean                 오래된 워크트리 정리
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

## 지원 어댑터

| 어댑터 | 생성 파일 | 비고 |
|--------|-----------|------|
| `claude-code` | `CLAUDE.md`, `.claude/skills/` | Claude Code 네이티브 |
| `cursor` | `.cursor/rules/*.mdc` | Cursor 네이티브 |
| `opencode` | `.opencode/instructions.md` | OpenCode 네이티브 |
| `agents-md` | `AGENTS.md` | Linux Foundation 신흥 표준 |

## 프로젝트 상태

| 단계 | 상태 | 설명 |
|------|------|------|
| Foundation | ✅ | Monorepo, 설정 시스템, `init`/`status` |
| Skills & Adapters | ✅ | Claude Code, Cursor, OpenCode, AGENTS.md 어댑터 |
| Profile & Sync | ✅ | Git 기반 프로필 동기화 |
| Agent Orchestration | ✅ | Claude Code CLI 실제 프로세스 스폰, 워크트리 연동 |
| Context Intelligence | ✅ | 기술 스택 분석, 규칙 자동 생성, staleness 감지 |
| DX & Polish | ✅ | `--dry-run`, `--verbose`, `context lint/stats/analyze` |

## 기여하기

```bash
git clone <repo>
pnpm install
pnpm build
pnpm test
```
