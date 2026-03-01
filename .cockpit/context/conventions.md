---
scope: global
---
새 CLI 커맨드 추가: packages/cli/src/commands/<name>.ts 생성 후 index.ts에 등록.
새 어댑터 추가: packages/adapters/src/<tool>/index.ts에 CockpitAdapter 구현.
Zod 스키마는 ZodTypeAny + z.infer<S> 사용 — ZodSchema<T>는 transform()과 호환 안 됨.
테스트는 os.tmpdir()로 실제 임시 디렉토리 사용, 파일 시스템 mock 지양.
커밋 전 pnpm build && pnpm test 필수.
