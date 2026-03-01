---
"@cockpit-ai/cli": patch
"@cockpit-ai/skills": patch
---

fix: update skill template to directory-based SKILL.md format, read CLI version from package.json

- `cockpit skill create` 템플릿을 구 `type: command` → `type: skill` 포맷으로 수정
- CLI `--version` 출력이 package.json에서 동적으로 읽도록 수정 (기존 하드코딩 0.0.1 제거)
