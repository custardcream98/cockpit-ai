import { readFileSync } from "node:fs";
import { parse as parseYaml } from "yaml";
import { type ZodTypeAny, type z, ZodError } from "zod";

// ─── Errors ────────────────────────────────────────────────────────────────

export class ConfigLoadError extends Error {
  constructor(
    public readonly path: string,
    message: string,
    public readonly cause?: unknown
  ) {
    super(`Failed to load config at ${path}: ${message}`);
    this.name = "ConfigLoadError";
  }
}

export class ConfigValidationError extends Error {
  constructor(
    public readonly path: string,
    public readonly issues: ZodError["issues"]
  ) {
    super(
      `Invalid config at ${path}:\n${issues.map((i) => `  ${i.path.join(".")}: ${i.message}`).join("\n")}`
    );
    this.name = "ConfigValidationError";
  }
}

// ─── Loader ────────────────────────────────────────────────────────────────

/**
 * Load and validate a YAML config file against a Zod schema.
 * Throws ConfigLoadError or ConfigValidationError on failure.
 * Using ZodTypeAny + z.infer ensures transforms are reflected in the return type.
 */
export function loadConfig<S extends ZodTypeAny>(path: string, schema: S): z.infer<S> {
  let raw: string;
  try {
    raw = readFileSync(path, "utf-8");
  } catch (err) {
    throw new ConfigLoadError(path, "file not found or not readable", err);
  }

  let parsed: unknown;
  try {
    parsed = parseYaml(raw);
  } catch (err) {
    throw new ConfigLoadError(path, "invalid YAML", err);
  }

  const result = schema.safeParse(parsed);
  if (!result.success) {
    throw new ConfigValidationError(path, (result.error as ZodError).issues);
  }

  return result.data as z.infer<S>;
}

/**
 * Attempt to load a config file, returning null if the file doesn't exist.
 * Still throws on parse errors or validation failures.
 */
export function tryLoadConfig<S extends ZodTypeAny>(path: string, schema: S): z.infer<S> | null {
  try {
    return loadConfig(path, schema);
  } catch (err) {
    if (err instanceof ConfigLoadError) {
      return null;
    }
    throw err;
  }
}
