import { readFileSync, readdirSync, existsSync, statSync } from "node:fs";
import { join, resolve, dirname, isAbsolute } from "node:path";

// ─── Types ────────────────────────────────────────────────────────────────

export interface ContextFileEntry {
  /** Absolute path to the source file */
  path: string;
  /** 위치로 결정되는 scope: `.cockpit/context/` → "global", `.cockpit/projects/{name}/context/` → "project" */
  scope: "global" | "project";
  /** Content with frontmatter stripped */
  content: string;
}

// ─── Frontmatter Parser ──────────────────────────────────────────────────

const FRONTMATTER_RE = /^---\r?\n[\s\S]*?\r?\n---\r?\n?/;

// scope는 디렉토리 위치로만 결정되므로 frontmatter는 body 추출에만 사용
function parseFrontmatter(raw: string): string {
  const match = FRONTMATTER_RE.exec(raw);
  if (!match) return raw;
  return raw.slice(match[0].length);
}

// ─── File Loader ─────────────────────────────────────────────────────────

/**
 * Load a single context file, parsing optional frontmatter.
 */
export function loadContextFile(filePath: string): ContextFileEntry {
  const raw = readFileSync(filePath, "utf-8");
  const body = parseFrontmatter(raw);
  // scope는 호출자가 디렉토리 위치에 따라 결정 (global이 기본값)
  return { path: filePath, scope: "global", content: body.trim() };
}

// ─── Simple Glob ─────────────────────────────────────────────────────────

/**
 * Minimal glob: supports `*` and `**` wildcards.
 * Only handles patterns ending in `*.ext` or `*`.
 */
function matchGlob(pattern: string, filePath: string): boolean {
  // Convert glob pattern to regex
  // **/ → 0개 이상의 경로 세그먼트(선택적), ** → 임의 문자, * → /를 제외한 임의 문자
  const regexStr = pattern
    .replace(/[.+^${}()|[\]\\]/g, "\\$&") // 정규식 특수문자 이스케이프 (* 와 ? 제외)
    .replace(/\*\*\//g, "(?:.*/)?")        // **/ → zero or more directories (선택적)
    .replace(/\*\*/g, ".*")                // ** alone → any characters
    .replace(/\*/g, "[^/]*");              // * → any chars except /

  const re = new RegExp(`^${regexStr}$`);
  return re.test(filePath);
}

function walkDir(dir: string, depth = 0, maxDepth = 5): string[] {
  // symlink 순환 방지를 위한 depth limit
  if (!existsSync(dir) || depth > maxDepth) return [];
  const entries: string[] = [];

  for (const name of readdirSync(dir)) {
    const fullPath = join(dir, name);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      entries.push(...walkDir(fullPath, depth + 1, maxDepth));
    } else {
      entries.push(fullPath);
    }
  }

  return entries;
}

/**
 * Discover context files matching the given glob patterns relative to basePath.
 * If no patterns are provided, defaults to `**\/*.md` within `.cockpit/context/`.
 */
export function discoverContextFiles(basePath: string, patterns?: string[]): ContextFileEntry[] {
  const effectivePatterns = patterns && patterns.length > 0
    ? patterns
    : [".cockpit/context/**/*.md"];

  const results: ContextFileEntry[] = [];
  const seen = new Set<string>();

  for (const pattern of effectivePatterns) {
    // Resolve the base dir from the pattern (everything before the first wildcard segment)
    const segments = pattern.split("/");
    const firstWildcard = segments.findIndex((s) => s.includes("*"));
    const staticPart = firstWildcard === -1 ? segments.join("/") : segments.slice(0, firstWildcard).join("/");
    const searchRoot = isAbsolute(pattern) ? dirname(pattern) : resolve(basePath, staticPart);

    const allFiles = walkDir(searchRoot);

    for (const file of allFiles) {
      if (seen.has(file)) continue;

      // Build relative path from basePath for matching
      const relPath = file.startsWith(basePath + "/") ? file.slice(basePath.length + 1) : file;

      if (matchGlob(pattern, relPath) || matchGlob(pattern, file)) {
        seen.add(file);
        try {
          const entry = loadContextFile(file);
          // frontmatter scope는 무시 — 패턴 기반 탐색은 항상 global
          results.push({ ...entry, scope: "global" as const });
        } catch {
          // Skip unreadable files
        }
      }
    }
  }

  return results;
}

/**
 * Auto-discover context files from `.cockpit/context/` directory
 * when no explicit patterns are configured.
 * 위치가 scope를 결정: `.cockpit/context/` 안의 파일은 항상 global.
 */
export function autoDiscoverContextFiles(basePath: string): ContextFileEntry[] {
  const contextDir = resolve(basePath, ".cockpit", "context");
  if (!existsSync(contextDir)) return [];

  const files = walkDir(contextDir).filter((f) => f.endsWith(".md"));
  return files.flatMap((f) => {
    try {
      const entry = loadContextFile(f);
      // frontmatter scope는 무시 — 위치(`.cockpit/context/`)가 global을 결정
      return [{ ...entry, scope: "global" as const }];
    } catch {
      return [];
    }
  });
}

/**
 * Discover per-project context files from `.cockpit/projects/<projectName>/context/`.
 * 위치가 scope를 결정: 항상 project scope 강제.
 */
export function discoverProjectContextFiles(
  basePath: string,
  projectName: string,
): ContextFileEntry[] {
  const contextDir = resolve(basePath, ".cockpit", "projects", projectName, "context");
  if (!existsSync(contextDir)) return [];

  const files = walkDir(contextDir).filter((f) => f.endsWith(".md"));
  return files.flatMap((f) => {
    try {
      const entry = loadContextFile(f);
      // frontmatter scope는 무시 — 위치(`.cockpit/projects/`)가 project를 결정
      return [{ ...entry, scope: "project" as const }];
    } catch {
      return [];
    }
  });
}
