import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

// ─── Types ───────────────────────────────────────────────────────────────────

export interface TechStackAnalysis {
  projectPath: string;
  frameworks: string[];
  buildTools: string[];
  testRunners: string[];
  linters: string[];
  packageManager: "pnpm" | "npm" | "yarn" | "bun" | "unknown";
  language: "typescript" | "javascript" | "unknown";
  strictMode?: boolean;
  moduleSystem?: "esm" | "cjs" | "unknown";
  directories: {
    hasSrc: boolean;
    hasTests: boolean;
    hasApp: boolean;
    hasPages: boolean;
  };
}

// ─── Package JSON Analysis ────────────────────────────────────────────────────

function readPackageJson(
  projectPath: string,
): Record<string, unknown> | null {
  const pkgPath = join(projectPath, "package.json");
  if (!existsSync(pkgPath)) return null;
  try {
    return JSON.parse(readFileSync(pkgPath, "utf-8")) as Record<string, unknown>;
  } catch {
    return null;
  }
}

function allDeps(pkg: Record<string, unknown>): Record<string, string> {
  return {
    ...((pkg["dependencies"] as Record<string, string>) ?? {}),
    ...((pkg["devDependencies"] as Record<string, string>) ?? {}),
    ...((pkg["peerDependencies"] as Record<string, string>) ?? {}),
  };
}

function detectFrameworks(deps: Record<string, string>): string[] {
  const found: string[] = [];
  const map: Record<string, string> = {
    next: "Next.js",
    react: "React",
    vue: "Vue",
    nuxt: "Nuxt",
    svelte: "Svelte",
    "@sveltejs/kit": "SvelteKit",
    astro: "Astro",
    express: "Express",
    fastify: "Fastify",
    hono: "Hono",
    koa: "Koa",
    nestjs: "NestJS",
    "@nestjs/core": "NestJS",
    "remix": "Remix",
    "@remix-run/react": "Remix",
    solid: "SolidJS",
    "solid-js": "SolidJS",
    qwik: "Qwik",
    "@angular/core": "Angular",
  };
  for (const [pkg, label] of Object.entries(map)) {
    if (pkg in deps && !found.includes(label)) found.push(label);
  }
  return found;
}

function detectBuildTools(deps: Record<string, string>, pkg: Record<string, unknown>): string[] {
  const found: string[] = [];
  const map: Record<string, string> = {
    vite: "Vite",
    webpack: "Webpack",
    rollup: "Rollup",
    esbuild: "esbuild",
    tsup: "tsup",
    turbo: "Turbo",
    turborepo: "Turbo",
    parcel: "Parcel",
    swc: "SWC",
    "@swc/core": "SWC",
    bun: "Bun",
  };
  for (const [pkg_, label] of Object.entries(map)) {
    if (pkg_ in deps && !found.includes(label)) found.push(label);
  }
  // scripts에서도 감지
  const scripts = (pkg["scripts"] as Record<string, string> | undefined) ?? {};
  if (Object.values(scripts).some((s) => s.includes("vite")) && !found.includes("Vite")) {
    found.push("Vite");
  }
  return found;
}

function detectTestRunners(deps: Record<string, string>): string[] {
  const found: string[] = [];
  const map: Record<string, string> = {
    vitest: "Vitest",
    jest: "Jest",
    "@jest/core": "Jest",
    mocha: "Mocha",
    jasmine: "Jasmine",
    ava: "AVA",
    tap: "TAP",
    playwright: "Playwright",
    "@playwright/test": "Playwright",
    cypress: "Cypress",
    "@testing-library/jest-dom": "Testing Library",
  };
  for (const [pkg, label] of Object.entries(map)) {
    if (pkg in deps && !found.includes(label)) found.push(label);
  }
  return found;
}

function detectLinters(
  deps: Record<string, string>,
  projectPath: string,
): string[] {
  const found: string[] = [];
  if ("eslint" in deps) found.push("ESLint");
  if ("biome" in deps || "@biomejs/biome" in deps) found.push("Biome");
  if ("prettier" in deps) found.push("Prettier");
  if ("oxlint" in deps) found.push("oxlint");

  // 설정 파일로도 감지
  if (!found.includes("ESLint")) {
    const eslintFiles = [".eslintrc", ".eslintrc.js", ".eslintrc.json", "eslint.config.js"];
    if (eslintFiles.some((f) => existsSync(join(projectPath, f)))) found.push("ESLint");
  }
  if (!found.includes("Biome")) {
    if (existsSync(join(projectPath, "biome.json"))) found.push("Biome");
  }
  return found;
}

function detectPackageManager(projectPath: string): TechStackAnalysis["packageManager"] {
  if (existsSync(join(projectPath, "pnpm-lock.yaml"))) return "pnpm";
  if (existsSync(join(projectPath, "bun.lockb")) || existsSync(join(projectPath, "bun.lock"))) return "bun";
  if (existsSync(join(projectPath, "yarn.lock"))) return "yarn";
  if (existsSync(join(projectPath, "package-lock.json"))) return "npm";
  return "unknown";
}

// ─── TypeScript Analysis ──────────────────────────────────────────────────────

function analyzeTypeScript(
  projectPath: string,
): { strictMode?: boolean; moduleSystem?: "esm" | "cjs" | "unknown" } {
  const tsconfigPath = join(projectPath, "tsconfig.json");
  if (!existsSync(tsconfigPath)) return {};
  try {
    const raw = readFileSync(tsconfigPath, "utf-8");
    // JSON5 호환 파싱 (주석 제거)
    const json = raw.replace(/\/\/.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");
    const tsconfig = JSON.parse(json) as Record<string, unknown>;
    const opts = (tsconfig["compilerOptions"] as Record<string, unknown>) ?? {};
    const strict = opts["strict"] === true;
    const module_ = (opts["module"] as string | undefined)?.toLowerCase() ?? "";
    const moduleSystem: "esm" | "cjs" | "unknown" =
      module_.includes("nodenext") || module_.includes("esnext") || module_.includes("es2020")
        ? "esm"
        : module_.includes("commonjs")
        ? "cjs"
        : "unknown";
    return { strictMode: strict, moduleSystem };
  } catch {
    return {};
  }
}

// ─── Directory Analysis ───────────────────────────────────────────────────────

function analyzeDirs(projectPath: string): TechStackAnalysis["directories"] {
  return {
    hasSrc: existsSync(join(projectPath, "src")),
    hasTests: existsSync(join(projectPath, "tests")) || existsSync(join(projectPath, "__tests__")),
    hasApp: existsSync(join(projectPath, "app")),
    hasPages: existsSync(join(projectPath, "pages")),
  };
}

// ─── Main Analyzer ────────────────────────────────────────────────────────────

/**
 * 프로젝트 경로를 분석해 기술 스택 정보를 반환.
 */
export function analyzeProject(projectPath: string): TechStackAnalysis {
  const pkg = readPackageJson(projectPath);
  const deps = pkg ? allDeps(pkg) : {};

  const hasTsConfig = existsSync(join(projectPath, "tsconfig.json"));
  const hasTs = Object.keys(deps).includes("typescript") || hasTsConfig;
  const language: TechStackAnalysis["language"] = hasTs ? "typescript" : "javascript";

  const tsInfo = hasTsConfig ? analyzeTypeScript(projectPath) : {};

  return {
    projectPath,
    frameworks: detectFrameworks(deps),
    buildTools: detectBuildTools(deps, pkg ?? {}),
    testRunners: detectTestRunners(deps),
    linters: detectLinters(deps, projectPath),
    packageManager: detectPackageManager(projectPath),
    language,
    strictMode: tsInfo.strictMode,
    moduleSystem: tsInfo.moduleSystem,
    directories: analyzeDirs(projectPath),
  };
}
