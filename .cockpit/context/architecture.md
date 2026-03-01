---
scope: project
---
cockpit-ai 모노레포. 패키지 구조:
- @cockpit-ai/core — 타입, config 로더/리졸버/파인더 (다른 패키지들의 기반)
- @cockpit-ai/adapters — AI 도구별 어댑터 (claude-code, cursor, opencode)
- @cockpit-ai/skills — 스킬 로더/레지스트리
- @cockpit-ai/context — 컨텍스트 관리 (파일 기반 포함)
- @cockpit-ai/agents — 에이전트 스포너/트래커
- @cockpit-ai/worktree — 워크트리 오케스트레이션
- @cockpit-ai/cli — commander 기반 CLI (cockpit 바이너리)

새 패키지 간 의존성은 turbo.json의 ^build 의존 순서를 따름.
core는 외부 패키지에 의존하지 않는 최하위 레이어.

config 계층: profile → workspace → project (deep merge, 나중이 이김).
