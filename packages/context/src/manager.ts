import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { parse as parseYaml, stringify as stringifyYaml } from "yaml";
import {
  findConfigPaths,
  resolveConfig,
  buildResolvedContext,
  type ContextRule,
  type ResolvedContext,
} from "@cockpit-ai/core";
import { discoverContextFiles, autoDiscoverContextFiles } from "./files.js";

// ─── ContextManager ────────────────────────────────────────────────────────

export class ContextManager {
  constructor(private readonly cwd: string) {}

  /**
   * Get the fully resolved context from all config layers,
   * including any external `.md` context files.
   */
  getResolved(): ResolvedContext {
    const paths = findConfigPaths(this.cwd);
    const config = resolveConfig(paths);

    // Determine the base directory for resolving file patterns
    const basePath = paths.workspacePath
      ? resolve(join(paths.workspacePath, "..", ".."))
      : paths.projectPath
      ? resolve(join(paths.projectPath, "..", ".."))
      : this.cwd;

    // Load file-based context entries
    const fileEntries =
      config.context.files.length > 0
        ? discoverContextFiles(basePath, config.context.files)
        : autoDiscoverContextFiles(basePath);

    // Separate file entries by scope and append to inline rules
    const fileGlobal = fileEntries
      .filter((e) => e.scope === "global")
      .map((e) => e.content);
    const fileProject = fileEntries
      .filter((e) => e.scope === "project")
      .map((e) => e.content);

    return buildResolvedContext(
      [...config.context.global, ...fileGlobal],
      [...config.context.project, ...fileProject],
      "cockpit"
    );
  }

  /**
   * Add a context rule to the project config (or workspace if no project).
   * scope: "global" (default) | "project"
   * Writes back to the YAML file.
   */
  addRule(content: string, scope: "global" | "project"): void {
    const paths = findConfigPaths(this.cwd);
    const targetPath = paths.projectPath ?? paths.workspacePath;
    if (!targetPath) throw new Error("No config found. Run 'cockpit init' first.");

    const raw = existsSync(targetPath) ? readFileSync(targetPath, "utf-8") : "";
    const config = (parseYaml(raw) as Record<string, unknown>) ?? {};

    if (!config["context"]) config["context"] = {};
    const ctx = config["context"] as Record<string, unknown>;
    if (!ctx[scope]) ctx[scope] = [];
    (ctx[scope] as string[]).push(content);

    writeFileSync(targetPath, stringifyYaml(config), "utf-8");
  }

  /**
   * Remove a rule by exact content match from the nearest config file.
   * Returns true if found and removed.
   */
  removeRule(content: string): boolean {
    const paths = findConfigPaths(this.cwd);
    const targetPath = paths.projectPath ?? paths.workspacePath;
    if (!targetPath) return false;

    if (!existsSync(targetPath)) return false;

    const raw = readFileSync(targetPath, "utf-8");
    const config = (parseYaml(raw) as Record<string, unknown>) ?? {};

    const ctx = config["context"] as Record<string, unknown> | undefined;
    if (!ctx) return false;

    let found = false;

    for (const scope of ["global", "project"] as const) {
      const rules = ctx[scope] as string[] | undefined;
      if (!rules) continue;

      const idx = rules.indexOf(content);
      if (idx !== -1) {
        rules.splice(idx, 1);
        found = true;
        break;
      }
    }

    if (found) {
      writeFileSync(targetPath, stringifyYaml(config), "utf-8");
    }

    return found;
  }

  /**
   * Return all rules as a flat array with source info.
   */
  listAll(): Array<{ rule: ContextRule; configFile: string }> {
    const paths = findConfigPaths(this.cwd);
    const results: Array<{ rule: ContextRule; configFile: string }> = [];

    const configFiles = [
      paths.profilePath,
      paths.workspacePath,
      paths.projectPath,
    ].filter(Boolean) as string[];

    for (const configFile of configFiles) {
      if (!existsSync(configFile)) continue;

      const raw = readFileSync(configFile, "utf-8");
      const config = (parseYaml(raw) as Record<string, unknown>) ?? {};
      const ctx = config["context"] as Record<string, unknown> | undefined;
      if (!ctx) continue;

      for (const scope of ["global", "project"] as const) {
        const rules = ctx[scope] as string[] | undefined;
        if (!rules) continue;

        for (const content of rules) {
          results.push({
            rule: { content, scope, source: configFile },
            configFile,
          });
        }
      }
    }

    return results;
  }
}
