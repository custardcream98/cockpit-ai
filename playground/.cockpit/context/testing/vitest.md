---
scope: global
---
Use vitest for all tests. Never use Jest.
Test files live in `src/__tests__/` alongside source code.
Use real temp directories via `os.tmpdir()` — avoid fs mocks.
