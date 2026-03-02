import type { TechStackAnalysis } from "./analyzer.js";

// ─── Generated Rule ───────────────────────────────────────────────────────────

export interface GeneratedRule {
  content: string;
  scope: "global" | "project";
  reason: string;
}

// ─── Rule Generator ───────────────────────────────────────────────────────────

/**
 * 기술 스택 분석 결과를 기반으로 컨텍스트 룰을 자동 생성.
 */
export function generateRules(analysis: TechStackAnalysis): GeneratedRule[] {
  const rules: GeneratedRule[] = [];

  // 언어
  if (analysis.language === "typescript") {
    rules.push({
      content: "Use TypeScript with strict type annotations",
      scope: "global",
      reason: "TypeScript detected",
    });
  }

  if (analysis.strictMode === true) {
    rules.push({
      content: "TypeScript strict mode is enabled — avoid any, use explicit return types",
      scope: "global",
      reason: "tsconfig strict: true",
    });
  }

  if (analysis.moduleSystem === "esm") {
    rules.push({
      content: "Use ESM import/export syntax (no require())",
      scope: "global",
      reason: "ESM module system detected",
    });
  }

  // 테스트 러너
  if (analysis.testRunners.includes("Vitest")) {
    rules.push({
      content: "Use Vitest for testing (vi.fn(), vi.mock(), etc.)",
      scope: "global",
      reason: "Vitest detected",
    });
  } else if (analysis.testRunners.includes("Jest")) {
    rules.push({
      content: "Use Jest for testing",
      scope: "global",
      reason: "Jest detected",
    });
  }

  if (analysis.testRunners.includes("Playwright")) {
    rules.push({
      content: "Use Playwright for end-to-end tests",
      scope: "global",
      reason: "Playwright detected",
    });
  }

  // 빌드 도구
  if (analysis.buildTools.includes("Turbo")) {
    rules.push({
      content: "This is a Turborepo monorepo — add new packages under packages/ with proper tsconfig and build scripts",
      scope: "global",
      reason: "Turbo detected",
    });
  }

  if (analysis.buildTools.includes("Vite")) {
    rules.push({
      content: "Use Vite for bundling",
      scope: "global",
      reason: "Vite detected",
    });
  }

  // 프레임워크
  if (analysis.frameworks.includes("Next.js")) {
    rules.push({
      content: "Follow Next.js App Router conventions — server components by default, 'use client' only when needed",
      scope: "project",
      reason: "Next.js detected",
    });
  }

  if (analysis.frameworks.includes("React")) {
    rules.push({
      content: "Use React functional components with hooks",
      scope: "project",
      reason: "React detected",
    });
  }

  if (analysis.frameworks.includes("NestJS")) {
    rules.push({
      content: "Follow NestJS conventions — decorators, dependency injection, modules",
      scope: "project",
      reason: "NestJS detected",
    });
  }

  // 린터
  if (analysis.linters.includes("Biome")) {
    rules.push({
      content: "Use Biome for linting and formatting (not ESLint/Prettier)",
      scope: "global",
      reason: "Biome detected",
    });
  } else if (analysis.linters.includes("ESLint") && analysis.linters.includes("Prettier")) {
    rules.push({
      content: "Use ESLint for linting and Prettier for formatting",
      scope: "global",
      reason: "ESLint + Prettier detected",
    });
  } else if (analysis.linters.includes("ESLint")) {
    rules.push({
      content: "Use ESLint for linting",
      scope: "global",
      reason: "ESLint detected",
    });
  }

  // 패키지 매니저
  if (analysis.packageManager === "pnpm") {
    rules.push({
      content: "Use pnpm for package management (not npm/yarn)",
      scope: "global",
      reason: "pnpm detected",
    });
  } else if (analysis.packageManager === "bun") {
    rules.push({
      content: "Use bun for package management and running scripts",
      scope: "global",
      reason: "bun detected",
    });
  }

  return rules;
}
