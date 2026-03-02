---
scope: global
---
새 CLI 커맨드 추가: packages/cli/src/commands/<name>.ts 생성 후 index.ts에 등록.
새 어댑터 추가: packages/adapters/src/<tool>/index.ts에 CockpitAdapter 구현.
Zod 스키마는 ZodTypeAny + z.infer<S> 사용 — ZodSchema<T>는 transform()과 호환 안 됨.
테스트는 os.tmpdir()로 실제 임시 디렉토리 사용, 파일 시스템 mock 지양.
커밋 전 pnpm build && pnpm test 필수.

어댑터 스킬 출력 형식:
- Claude Code: .claude/skills/<name>/SKILL.md (YAML frontmatter: name, description)
- OpenCode: .opencode/skills/<name>/SKILL.md (YAML frontmatter: name, description 필수)
- Cursor: .cursor/rules/<name>.mdc (YAML frontmatter: description, globs, alwaysApply)

SkillDefinition adapter type 허용값: 'command' | 'skill' | 'rule' (packages/core/src/types/skill.ts).
'command'는 레거시 — 새 스킬은 'skill' 사용.

applyCommand에서 process.exit 대신 Error throw — watch 등 호출자에서 catch 가능.
discoverContextFiles 기본 패턴: .cockpit/context/**/*.md (서브디렉토리 포함).

릴리스는 changesets 사용 — 변경 시 .changeset/*.md 파일 추가 후 push하면 Release PR 자동 생성.
cockpit apply --clean: 기존 cockpit 관리 파일 제거 후 재적용 (구 commands → 새 skills 마이그레이션 시 사용).

항상 한국어로 주석 작성.
