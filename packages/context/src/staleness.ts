import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { ContextRule } from "@cockpit-ai/core";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface StalenessWarning {
  rule: ContextRule;
  type: "stale-package" | "conflict";
  message: string;
}

// ─── Conflict Pairs ───────────────────────────────────────────────────────────

// 알려진 충돌 쌍: 동시에 언급되면 충돌 경고
const CONFLICT_PAIRS: Array<[string, string]> = [
  ["jest", "vitest"],
  ["webpack", "vite"],
  ["npm", "pnpm"],
  ["npm", "yarn"],
  ["yarn", "pnpm"],
  ["eslint", "biome"],
  ["prettier", "biome"],
  ["commonjs", "esm"],
  ["require()", "import "],
];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function readPackageDeps(projectPath: string): Set<string> {
  const pkgPath = join(projectPath, "package.json");
  if (!existsSync(pkgPath)) return new Set();
  try {
    const pkg = JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
    const all = {
      ...((pkg["dependencies"] as Record<string, string>) ?? {}),
      ...((pkg["devDependencies"] as Record<string, string>) ?? {}),
    };
    return new Set(Object.keys(all));
  } catch {
    return new Set();
  }
}

/**
 * 룰 텍스트에서 패키지 이름처럼 보이는 키워드 추출.
 * 소문자 + 하이픈/슬래시 포함 단어.
 */
function extractKeywords(text: string): string[] {
  const lower = text.toLowerCase();
  const matches = lower.match(/\b[a-z][@a-z0-9/-]{2,}\b/g) ?? [];
  return [...new Set(matches)];
}

// ─── Staleness Checker ────────────────────────────────────────────────────────

/**
 * rules 목록을 분석해 stale 또는 충돌 경고를 반환.
 *
 * - stale-package: 룰에 언급된 패키지가 package.json에 없고
 *   같은 카테고리의 다른 패키지가 있는 경우
 * - conflict: 서로 충돌하는 도구를 동시에 언급하는 경우
 */
export function checkStaleness(
  rules: ContextRule[],
  projectPath: string,
): StalenessWarning[] {
  const warnings: StalenessWarning[] = [];
  const deps = readPackageDeps(projectPath);

  const allContent = rules.map((r) => r.content.toLowerCase()).join("\n");

  // 1. 충돌 쌍 검사 — 전체 룰 집합에서
  for (const [a, b] of CONFLICT_PAIRS) {
    if (allContent.includes(a) && allContent.includes(b)) {
      // 어느 룰이 충돌의 원인인지 찾기
      const conflictingRules = rules.filter(
        (r) =>
          r.content.toLowerCase().includes(a) || r.content.toLowerCase().includes(b),
      );
      for (const rule of conflictingRules) {
        warnings.push({
          rule,
          type: "conflict",
          message: `Conflicting tools mentioned: '${a}' and '${b}' are typically mutually exclusive`,
        });
      }
    }
  }

  // 2. stale-package 검사 — 각 룰에서 언급된 패키지가 deps에 없는 경우
  for (const rule of rules) {
    const keywords = extractKeywords(rule.content);
    for (const kw of keywords) {
      // deps에 없는 패키지를 언급하는 경우 — 유명 패키지명만 체크
      const knownPackages = new Set([
        "jest", "vitest", "mocha", "jasmine", "ava", "tap",
        "webpack", "vite", "rollup", "parcel", "esbuild", "tsup",
        "eslint", "prettier", "biome", "oxlint",
        "react", "vue", "svelte", "angular", "solid-js",
        "next", "nuxt", "remix", "astro",
        "express", "fastify", "hono", "koa",
        "tailwindcss", "styled-components", "emotion",
      ]);

      if (knownPackages.has(kw) && !deps.has(kw)) {
        // 이미 같은 룰에 대한 stale 경고가 있으면 skip
        const alreadyWarned = warnings.some(
          (w) => w.rule === rule && w.type === "stale-package",
        );
        if (!alreadyWarned) {
          warnings.push({
            rule,
            type: "stale-package",
            message: `Rule mentions '${kw}' but it is not found in package.json dependencies`,
          });
        }
      }
    }
  }

  return warnings;
}
