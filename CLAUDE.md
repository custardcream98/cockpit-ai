# Cockpit — CLAUDE.md

AI-first Development Environment Orchestrator. Write Once, Apply Anywhere.

## Project Structure

```
cockpit/
├── packages/
│   ├── core/        @cockpit/core  — types, config loader, resolver, finder
│   ├── cli/         @cockpit/cli   — commander-based CLI (cockpit binary)
│   ├── adapters/    @cockpit/adapters — AI tool adapters (Phase 2+)
│   ├── skills/      @cockpit/skills   — skill loader/registry (Phase 2+)
│   ├── agents/      @cockpit/agents   — agent spawner/tracker (Phase 4+)
│   ├── worktree/    @cockpit/worktree  — worktree orchestration (Phase 5+)
│   └── context/     @cockpit/context   — context management (Phase 6+)
├── turbo.json
├── pnpm-workspace.yaml
└── tsconfig.base.json
```

## Development Commands

```bash
pnpm install          # install all workspace deps
pnpm build            # turbo: build all packages (core first, then cli)
pnpm test             # turbo: build → test all packages
pnpm -F @cockpit/core test        # test single package
pnpm -F @cockpit/cli  build       # build single package
```

## Architecture

### Config Hierarchy (Profile → Workspace → Project)
- `~/.cockpit/profile.yaml`         — personal global preferences
- `/path/to/workspace/.cockpit/config.yaml`  — workspace-level config
- `/path/to/project/.cockpit/config.yaml`    — project-level config

Resolution: all layers deep-merged, later wins for scalars, arrays accumulated.

### Key Types (`@cockpit/core`)
- `ProfileConfig`, `WorkspaceConfig`, `ProjectConfig` — Zod-validated YAML schemas
- `ResolvedConfig` — merged result from all three layers
- `CockpitAdapter` — interface each AI tool must implement
- `SkillDefinition`, `AgentDefinition` — YAML skill/agent formats

### Config Discovery (`findConfigPaths`)
Walks up from cwd collecting ALL `.cockpit/config.yaml` occurrences:
- 1 found → workspace only (projectPath = null)
- 2+ found → nearest = project, next ancestor = workspace

### CLI (`@cockpit/cli`)
- `cockpit init [path] [--project]` — create `.cockpit/config.yaml`
- `cockpit status [path]`           — show merged config info
- `cockpit apply [--adapter=name]`  — apply to AI tools (Phase 2+)
- `cockpit skill *`                 — skill management (Phase 2+)

## Key Patterns

### Loading + validating YAML
```typescript
import { loadConfig, tryLoadConfig } from "@cockpit/core";
// Use ZodTypeAny + z.infer<S> — NOT ZodSchema<T> — to correctly handle .transform()
const config = tryLoadConfig(path, WorkspaceConfigSchema); // null if file missing
```

### Adding a new CLI command
1. Create `packages/cli/src/commands/<name>.ts` exporting `async function <name>Command(...)`
2. Register in `packages/cli/src/index.ts` via `program.command(...).action(...)`

### Adding a new adapter (Phase 2+)
1. Create `packages/adapters/src/<tool>/index.ts` implementing `CockpitAdapter`
2. Export from `packages/adapters/src/index.ts`
3. Register in the apply command

## Testing
- vitest, per-package `vitest.config.ts`
- Tests use real temp directories (via `os.tmpdir()`)
- Mock readline for non-interactive init tests

## Conventions
- ESM only (`"type": "module"`)
- Node >=20 required
- All config types defined with Zod schemas (runtime + type safety)
- `yaml` package (not js-yaml) for YAML 1.2 support
- tsup builds: ESM format, shebang added via `banner.js` for CLI binary

## Current Phase: 2 (complete) → 3 (Profile & Sync)

Phase 3 scope:
- `cockpit profile create|sync push|sync pull|export|import`
- Git-based profile sync (`~/.cockpit/` → remote git repo)
- Single-file export/import for portability
