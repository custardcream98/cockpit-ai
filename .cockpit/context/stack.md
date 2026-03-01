---
scope: global
---
Node.js >= 20, TypeScript strict mode (noUncheckedIndexedAccess, noImplicitReturns 포함).
ESM only — import/export 사용, require() 금지.
pnpm 패키지 매니저, turborepo 모노레포.
zod로 런타임 타입 검증, yaml 패키지(js-yaml 아님)로 YAML 파싱.
tsup으로 빌드, vitest로 테스트.
