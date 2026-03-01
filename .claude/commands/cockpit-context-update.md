# Update Cockpit Context

Analyze the current project and update the Cockpit context files in `.cockpit/context/`.

## Steps

1. **Inspect the project** to understand its tech stack, conventions, and architecture:
   - Read `package.json`, `tsconfig.json`, `README.md` (if they exist)
   - Look at directory structure and key source files
   - Identify: language, framework, test runner, code style preferences

2. **Update `.cockpit/context/` files** with your findings:
   - `conventions.md` — coding conventions, style rules, naming patterns
   - `architecture.md` — project architecture, key modules, design decisions
   - Create additional files as needed (e.g. `testing.md`, `api.md`)
   - Use frontmatter `scope: global` or `scope: project` as appropriate

3. **Apply the updated context** by running:
   ```
   cockpit apply
   ```

## File Format

Each context file should use this format:

```markdown
---
scope: global
---
Your context rules here. Be specific and actionable.
```

## Guidelines

- Be specific and actionable — rules like "Use TypeScript strict mode" are better than "Use TypeScript"
- Keep each file focused on one topic
- Prefer `scope: global` for language/style rules that apply everywhere
- Use `scope: project` for project-specific architecture or conventions
- Remove outdated rules when the project evolves

<!-- cockpit:managed -->